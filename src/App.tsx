import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { Session } from '@supabase/supabase-js'
import type { MonthKey, PockitData } from './types'
import { currentMonth, setMoneyPrivacy } from './lib/finance'
import { disablePushForCurrentAccount } from './lib/push'
import { makeDemoData, makeInitialData } from './lib/defaults'
import {
  clearCache,
  clearPending,
  downloadJSON,
  hasPendingEdits,
  isConflictError,
  loadCloud,
  mergeSnapshots,
  readCache,
  readDemo,
  readPending,
  saveCloud,
  saveDemo,
  sameData,
  supabase,
  writeCache,
  writePending,
  type CloudSnapshot,
  type PendingSnapshot,
} from './lib/storage'
import { Auth } from './components/Auth'
import { Onboarding } from './components/Onboarding'
import { Brand, Icon, MonthPicker } from './components/UI'
import { HomeScreen } from './screens/Home'
import { ActivityScreen } from './screens/Activity'
import { BudgetScreen } from './screens/Budget'
import { CalendarScreen } from './screens/Calendar'
import { GoalsScreen } from './screens/Goals'
import { CompareScreen } from './screens/Compare'
import { MoreScreen } from './screens/More'
import { Coach, openingMessage, type InsightMessage } from './screens/Coach'
import { Guide } from './components/Guide'
import { QuickActions, type QuickAction } from './components/QuickActions'
import { themeBackground } from './lib/themes'
import { syncGoalPlans } from './lib/goalPlans'
import { animateThemeChange } from './lib/themeMotion'
import { normalizedMobileTabs } from './lib/mobileNavigation'

type Tab = 'Home' | 'Activity' | 'Budget' | 'Calendar' | 'Goals' | 'Compare' | 'More'
const tabs: [Tab, string][] = [
  ['Home', 'House'],
  ['Activity', 'ListFilter'],
  ['Budget', 'ChartPie'],
  ['Calendar', 'CalendarDays'],
  ['Goals', 'Target'],
  ['Compare', 'GitCompareArrows'],
  ['More', 'Grid2X2'],
]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [recovering, setRecovering] = useState(
    () =>
      window.location.hash.includes('type=recovery') ||
      new URLSearchParams(window.location.search).get('type') === 'recovery',
  )
  const [demo, setDemo] = useState(false)
  const [data, setData] = useState<PockitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>(() =>
    new URLSearchParams(window.location.search).get('open') === 'calendar' ? 'Calendar' : 'Home',
  )
  const [quickAdd, setQuickAdd] = useState(0)
  const [month, setMonth] = useState<MonthKey>(currentMonth())
  const [coachOpen, setCoachOpen] = useState(false)
  const [insightMessages, setInsightMessages] = useState<InsightMessage[]>([openingMessage])
  const [guideOpen, setGuideOpen] = useState(false)
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<
    'saved' | 'saving' | 'offline' | 'conflict' | 'error'
  >('saved')
  const [conflict, setConflict] = useState<{
    local: PendingSnapshot
    remote: CloudSnapshot
  } | null>(null)
  const [retry, setRetry] = useState(0)
  const [cloudEpoch, setCloudEpoch] = useState(0)
  const saveQueue = useRef(Promise.resolve())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ready = useRef(false)
  const revision = useRef(0)
  const suppressNextSave = useRef(false)
  const dataRef = useRef(data)
  const conflictRef = useRef(conflict)
  dataRef.current = data
  conflictRef.current = conflict

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuickActionsOpen(true)
      }
    }
    window.addEventListener('keydown', openSearch)
    return () => window.removeEventListener('keydown', openSearch)
  }, [])

  useEffect(() => {
    let cancelled = false
    let checkingCloud = false
    const retryPending = async () => {
      if (
        !session ||
        demo ||
        !navigator.onLine ||
        !ready.current ||
        conflictRef.current ||
        checkingCloud
      )
        return
      checkingCloud = true
      try {
        const remote = await loadCloud(session)
        if (cancelled || !ready.current || conflictRef.current) return
        const pending = readPending(session.user.id)
        if (remote && remote.revision > revision.current) {
          if (pending && hasPendingEdits(pending) && !sameData(pending.data, remote.data)) {
            setConflict({ local: pending, remote })
            setSyncStatus('conflict')
            return
          }
          if (pending) clearPending(session.user.id)
          revision.current = remote.revision
          writeCache(session.user.id, remote)
          suppressNextSave.current = true
          setData(remote.data)
          setCloudEpoch((value) => value + 1)
          setSyncStatus('saved')
        } else if (pending && !hasPendingEdits(pending)) clearPending(session.user.id)
        else if (pending && navigator.onLine) setRetry((value) => value + 1)
      } catch {
        // Keep the device copy; the next foreground or online check can retry.
      } finally {
        checkingCloud = false
      }
    }
    window.addEventListener('online', retryPending)
    window.addEventListener('focus', retryPending)
    window.addEventListener('pageshow', retryPending)
    const onVisible = () => {
      if (document.visibilityState === 'visible') retryPending()
    }
    document.addEventListener('visibilitychange', onVisible)
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void retryPending()
    }, 30_000)
    return () => {
      cancelled = true
      window.removeEventListener('online', retryPending)
      window.removeEventListener('focus', retryPending)
      window.removeEventListener('pageshow', retryPending)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(poll)
    }
  }, [session?.user.id, demo])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth
      .getSession()
      .then(({ data: result }) => setSession(result.session))
      .catch(() =>
        setError('Could not restore your sign-in. Check your connection and reopen Pockit.'),
      )
      .finally(() => setLoading(false))
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (!next) {
        setData(null)
        ready.current = false
        setConflict(null)
        setInsightMessages([openingMessage])
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || demo) return
    if (import.meta.env.PROD)
      void fetch('/api/ensure-signup-alert', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => {})
    let cancelled = false
    ready.current = false
    setLoading(true)
    loadCloud(session)
      .then((cloud) => {
        if (!cancelled) {
          const pending = readPending(session.user.id)
          revision.current = cloud?.revision || 0
          if (cloud) writeCache(session.user.id, cloud)
          if (
            pending &&
            hasPendingEdits(pending) &&
            (!cloud || !sameData(pending.data, cloud.data))
          ) {
            setData(pending.data)
            if (pending.revision !== revision.current) {
              setConflict({
                local: pending,
                remote: cloud || { data: makeInitialData(), revision: 0 },
              })
              setSyncStatus('conflict')
            } else setSyncStatus(navigator.onLine ? 'saving' : 'offline')
          } else {
            if (pending) clearPending(session.user.id)
            suppressNextSave.current = !!cloud
            setData(cloud?.data || makeInitialData(session.user.user_metadata?.name || ''))
            setSyncStatus('saved')
          }
          ready.current = true
          setError('')
        }
      })
      .catch((e) => {
        if (cancelled) return
        const local = readPending(session.user.id) || readCache(session.user.id)
        if (local) {
          revision.current = local.revision
          setData(local.data)
          ready.current = true
          setSyncStatus('offline')
          setError('Working from this device’s saved copy. Reconnect to check for newer edits.')
        } else
          setError(
            `Could not load your budget: ${e.message}. Run the updated supabase/schema.sql in Supabase.`,
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session?.user.id, demo])

  useEffect(() => {
    if (!data || !ready.current) return
    document.documentElement.dataset.theme = data.settings.theme
    document.documentElement.dataset.palette = data.settings.palette || 'pockit'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        'content',
        themeBackground(data.settings.palette || 'pockit', data.settings.theme),
      )
    document
      .querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
      ?.setAttribute('content', data.settings.theme === 'light' ? 'default' : 'black')
    if (conflict) return
    if (suppressNextSave.current) {
      suppressNextSave.current = false
      return
    }
    if (!demo && session) {
      try {
        writePending(session.user.id, {
          data,
          revision: revision.current,
          changedAt: new Date().toISOString(),
          base: readPending(session.user.id)?.base || readCache(session.user.id)?.data,
        })
        setSyncStatus(navigator.onLine ? 'saving' : 'offline')
      } catch {
        setSyncStatus('error')
        setError(
          'This device could not keep a pending copy. Free up browser storage before making more changes.',
        )
        return
      }
      if (!navigator.onLine) return
    }
    const timer = setTimeout(() => {
      saveTimer.current = null
      if (demo) {
        try {
          saveDemo(data)
          setError('')
        } catch {
          setError('This browser could not save your preview. Free up storage and try again.')
        }
      } else if (session)
        saveQueue.current = saveQueue.current
          .then(async () => {
            if (!ready.current || conflictRef.current) return
            const nextRevision = await saveCloud(session, data, revision.current)
            revision.current = nextRevision
            writeCache(session.user.id, { data, revision: nextRevision })
            if (dataRef.current === data) {
              clearPending(session.user.id)
              setSyncStatus('saved')
            } else if (dataRef.current)
              writePending(session.user.id, {
                data: dataRef.current,
                revision: nextRevision,
                changedAt: new Date().toISOString(),
                base: data,
              })
            setError('')
          })
          .catch(async (e) => {
            if (isConflictError(e)) {
              try {
                const remote = await loadCloud(session)
                const local = readPending(session.user.id)
                if (remote && local) {
                  setConflict({ local, remote })
                  setSyncStatus('conflict')
                  return
                }
              } catch {
                /* Show the sync error below. */
              }
            }
            setSyncStatus(navigator.onLine ? 'error' : 'offline')
            setError(`Changes are saved on this device but could not sync: ${e.message}`)
          })
    }, 400)
    saveTimer.current = timer
    return () => {
      clearTimeout(timer)
      if (saveTimer.current === timer) saveTimer.current = null
    }
  }, [data, demo, session?.user.id, conflict, retry])

  async function resolveConflict(
    choice: 'device' | 'cloud' | 'merge' | 'merge-device' | 'merge-cloud',
  ) {
    if (!conflict || !session) return
    if (choice === 'cloud') {
      revision.current = conflict.remote.revision
      writeCache(session.user.id, conflict.remote)
      clearPending(session.user.id)
      suppressNextSave.current = true
      setData(conflict.remote.data)
      setCloudEpoch((value) => value + 1)
      setConflict(null)
      setSyncStatus('saved')
      setError('')
      return
    }
    setSyncStatus('saving')
    try {
      const merged = conflict.local.base
        ? mergeSnapshots(
            conflict.local.base,
            conflict.local.data,
            conflict.remote.data,
            choice === 'merge-cloud' ? 'cloud' : 'device',
          )
        : null
      if (choice === 'merge' && (!merged || merged.conflicts.length))
        throw new Error('These changes overlap. Save a backup and choose which copy to keep.')
      const selected = choice.startsWith('merge') ? merged!.data : conflict.local.data
      const nextRevision = await saveCloud(session, selected, conflict.remote.revision)
      revision.current = nextRevision
      writeCache(session.user.id, { data: selected, revision: nextRevision })
      clearPending(session.user.id)
      suppressNextSave.current = true
      setData(selected)
      setCloudEpoch((value) => value + 1)
      setConflict(null)
      setSyncStatus('saved')
      setError('')
    } catch (e) {
      const remote = await loadCloud(session).catch(() => null)
      if (remote) setConflict({ ...conflict, remote })
      setSyncStatus('conflict')
      setError(
        `Could not finish resolving the conflict: ${e instanceof Error ? e.message : 'Try again.'}`,
      )
    }
  }

  function startDemo() {
    setDemo(true)
    ready.current = true
    setData(readDemo() || makeDemoData())
  }
  function update(recipe: (current: PockitData) => PockitData) {
    setData((current) => (current ? syncGoalPlans(current, recipe(current)) : current))
  }
  function changeTheme(theme: 'light' | 'dark', origin?: Element | null) {
    animateThemeChange(() => {
      document.documentElement.dataset.theme = theme
      flushSync(() =>
        update((current) => ({
          ...current,
          settings: { ...current.settings, theme },
        })),
      )
    }, origin)
  }
  function exitDemo() {
    setDemo(false)
    setData(null)
    ready.current = false
    setTab('Home')
    setInsightMessages([openingMessage])
  }
  async function logout() {
    if (demo) exitDemo()
    else {
      await disablePushForCurrentAccount().catch(() => {
        setError(
          'Signed out, but this device may still receive generic reminders. Turn off Pockit notifications in device settings if needed.',
        )
      })
      await supabase?.auth.signOut({ scope: 'local' })
    }
  }
  setMoneyPrivacy(!!data?.settings.hideAmounts)
  if (loading)
    return (
      <div className="loading-screen">
        <Brand />
        <div className="loading-pulse" />
        <p>Making room for clarity…</p>
      </div>
    )
  if (recovering)
    return (
      <Auth
        key="recovery"
        onDemo={startDemo}
        recovery
        onRecovered={() => {
          setRecovering(false)
          window.history.replaceState({}, '', window.location.pathname)
        }}
      />
    )
  if (!data)
    return (
      <>
        <Auth onDemo={startDemo} />
        {error && <div className="global-error">{error}</div>}
      </>
    )
  if (conflict)
    return (
      <div className="sync-conflict-screen">
        <Brand />
        <section
          className="panel sync-conflict-card"
          role="alertdialog"
          aria-label="Review changes from two devices"
        >
          <Icon name="CloudAlert" size={30} />
          <h1>Review changes from two devices</h1>
          <p>
            This device has changes that differ from your cloud copy. Download this device’s copy
            before choosing if you want to keep a backup.
          </p>
          {conflict.remote.data.onboarded && !conflict.local.data.onboarded && (
            <p>
              You finished setup on another device. Choose “Use cloud copy” to open your completed
              Pockit here, or save this device’s draft first.
            </p>
          )}
          {conflict.local.base &&
            (() => {
              const merged = mergeSnapshots(
                conflict.local.base!,
                conflict.local.data,
                conflict.remote.data,
              )
              return merged.conflicts.length ? (
                <p>
                  {merged.conflicts.length} overlapping{' '}
                  {merged.conflicts.length === 1 ? 'change needs' : 'changes need'} your choice.
                  Pockit will not guess which edit to keep.
                </p>
              ) : (
                <p>Changes to different items can be combined safely.</p>
              )
            })()}
          <div className="sync-conflict-actions">
            <button
              className="secondary-button"
              onClick={() => downloadJSON(conflict.local.data, 'pockit-device-backup.json')}
            >
              Download this device’s copy
            </button>
            <button className="secondary-button" onClick={() => void resolveConflict('cloud')}>
              Use cloud copy
            </button>
            {conflict.local.base &&
              mergeSnapshots(conflict.local.base, conflict.local.data, conflict.remote.data)
                .conflicts.length === 0 && (
                <button className="primary-button" onClick={() => void resolveConflict('merge')}>
                  Combine both devices
                </button>
              )}
            {conflict.local.base &&
              mergeSnapshots(conflict.local.base, conflict.local.data, conflict.remote.data)
                .conflicts.length > 0 && (
                <>
                  <button
                    className="secondary-button"
                    onClick={() => void resolveConflict('merge-cloud')}
                  >
                    Combine both, use cloud for overlaps
                  </button>
                  <button
                    className="primary-button"
                    onClick={() => void resolveConflict('merge-device')}
                  >
                    Combine both, use this device for overlaps
                  </button>
                </>
              )}
            <button className="primary-button" onClick={() => void resolveConflict('device')}>
              Use this device’s copy
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </section>
      </div>
    )
  if (!data.onboarded)
    return (
      <Onboarding
        key={`${session?.user.id || 'preview'}:${cloudEpoch}`}
        initial={data}
        accountEmail={session?.user.email}
        syncStatus={syncStatus}
        onChange={setData}
        onSave={async (next) => {
          if (!session) throw new Error('Your session has expired. Sign in again.')
          setSyncStatus('saving')
          if (saveTimer.current) {
            clearTimeout(saveTimer.current)
            saveTimer.current = null
          }
          saveQueue.current = saveQueue.current
            .catch(() => undefined)
            .then(async () => {
              writePending(session.user.id, {
                data: next,
                revision: revision.current,
                changedAt: new Date().toISOString(),
                base: readPending(session.user.id)?.base || readCache(session.user.id)?.data,
              })
              const nextRevision = await saveCloud(session, next, revision.current)
              revision.current = nextRevision
              writeCache(session.user.id, { data: next, revision: nextRevision })
              clearPending(session.user.id)
              suppressNextSave.current = true
              setSyncStatus('saved')
            })
          try {
            await saveQueue.current
          } catch (cause) {
            if (isConflictError(cause)) {
              const remote = await loadCloud(session).catch(() => null)
              const local = readPending(session.user.id)
              if (remote && local) {
                setConflict({ local, remote })
                setSyncStatus('conflict')
              }
            } else setSyncStatus(navigator.onLine ? 'error' : 'offline')
            throw cause
          }
          setError('')
        }}
        onDone={setData}
      />
    )
  const quickActions: QuickAction[] = [
    ...tabs.map(([name, icon]): QuickAction => ({
      label: name === 'More' ? 'More and settings' : name,
      description:
        name === 'Compare'
          ? 'Compare spending and budget plans across months'
          : name === 'Activity'
            ? 'Search and review your transactions'
            : `Open ${name.toLowerCase()}`,
      group: 'Pages',
      icon,
      run: () => setTab(name),
    })),
    {
      label: 'Add transaction',
      description: 'Record an expense, paycheque, or transfer',
      group: 'Actions',
      icon: 'Plus',
      run: () => {
        setMonth(currentMonth())
        setTab('Activity')
        setQuickAdd((value) => value + 1)
      },
    },
    {
      label: 'Open a guide',
      description: 'Plain-language help for the current page',
      group: 'Actions',
      icon: 'CircleHelp',
      run: () => setGuideOpen(true),
    },
    {
      label: 'Change appearance',
      description: 'Choose dark, light, and colour themes',
      group: 'Actions',
      icon: 'Palette',
      run: () => setTab('More'),
    },
  ]
  return (
    <div
      className={`app-shell ${data.settings.hideAmounts ? 'private-amounts' : ''}`}
      data-guides={data.settings.guide === false ? 'off' : 'on'}
    >
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-section-label">YOUR SPACE</div>
        <nav className="side-nav">
          {tabs.map(([name, icon]) => (
            <button
              key={name}
              className={tab === name ? 'active' : ''}
              onClick={() => setTab(name)}
            >
              <Icon name={icon} size={20} />
              <span>{name}</span>
              {tab === name && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="coach-nav" onClick={() => setCoachOpen(true)}>
            <div className="coach-nav-icon">
              <Icon name="Sparkles" size={19} />
            </div>
            <span>
              <strong>Pockit Insights</strong>
              <small>Guided answers from your entries</small>
            </span>
            <Icon name="ArrowUpRight" size={17} />
          </button>
          <div className="account-mini">
            <div className="avatar">{data.profile.name?.[0]?.toUpperCase() || 'P'}</div>
            <span>
              <strong>{data.profile.name || 'Your Pockit'}</strong>
              <small>{demo ? 'Preview mode' : session?.user.email}</small>
            </span>
            <button aria-label="Settings" onClick={() => setTab('More')}>
              <Icon name="Settings2" size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="mobile-only">
              <Brand compact />
            </div>
            <span className="topbar-title">{tab}</span>
            <span className="topbar-separator">/</span>
            <span className="topbar-subtitle">Your money, in focus</span>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button top-utility"
              aria-label="Search pages and actions"
              title="Search pages and actions (⌘K / Ctrl+K)"
              onClick={() => setQuickActionsOpen(true)}
            >
              <Icon name="Search" size={19} />
            </button>
            <button
              className="icon-button top-utility"
              aria-label={`Open ${tab} guide`}
              title="Guide"
              onClick={() => setGuideOpen(true)}
            >
              <Icon name="Info" size={19} />
            </button>
            <button
              className="icon-button top-utility"
              aria-label={data.settings.hideAmounts ? 'Show money amounts' : 'Hide money amounts'}
              title={data.settings.hideAmounts ? 'Show amounts' : 'Hide amounts'}
              onClick={() =>
                update((current) => ({
                  ...current,
                  settings: { ...current.settings, hideAmounts: !current.settings.hideAmounts },
                }))
              }
            >
              <Icon name="ScanEye" size={19} />
            </button>
            <button
              className="theme-button"
              title={`Switch to ${data.settings.theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${data.settings.theme === 'dark' ? 'light' : 'dark'} mode`}
              onClick={(event) =>
                changeTheme(data.settings.theme === 'dark' ? 'light' : 'dark', event.currentTarget)
              }
            >
              <Icon name={data.settings.theme === 'dark' ? 'Sun' : 'Moon'} size={19} />
            </button>
            <button className="coach-top" onClick={() => setCoachOpen(true)}>
              <Icon name="Sparkles" size={17} /> Ask Pockit
            </button>
            <button
              className="avatar small"
              aria-label="Open More and settings"
              title="More and settings"
              onClick={() => setTab('More')}
            >
              {data.profile.name?.[0]?.toUpperCase() || 'P'}
            </button>
          </div>
        </header>
        {!demo && (
          <div className={`sync-chip ${syncStatus}`} role="status">
            <Icon
              name={
                syncStatus === 'saved'
                  ? 'CloudCheck'
                  : syncStatus === 'offline'
                    ? 'CloudOff'
                    : 'CloudUpload'
              }
              size={15}
            />
            {syncStatus === 'saved'
              ? 'Saved'
              : syncStatus === 'saving'
                ? 'Saving…'
                : syncStatus === 'offline'
                  ? 'Offline copy'
                  : syncStatus === 'conflict'
                    ? 'Review changes'
                    : 'Sync needs attention'}
          </div>
        )}
        {error && (
          <div className="sync-error" role="alert">
            {error}
            {!demo && session && readPending(session.user.id) && !conflict && (
              <button onClick={() => setRetry((value) => value + 1)}>Retry sync</button>
            )}
            <button onClick={() => setError('')} aria-label="Dismiss">
              <Icon name="X" size={15} />
            </button>
          </div>
        )}
        <main className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {tab === 'Home' ? 'YOUR OVERVIEW' : `YOUR ${tab.toUpperCase()}`}
              </div>
              <h1>
                {tab === 'Home'
                  ? `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${data.profile.name || 'friend'}.`
                  : tab === 'More'
                    ? 'Make it yours.'
                    : tab === 'Goals'
                      ? 'Every step counts.'
                      : tab === 'Compare'
                        ? 'Put your months in perspective.'
                        : tab === 'Activity'
                          ? 'The full picture.'
                          : tab === 'Budget'
                            ? 'Give every dollar a direction.'
                            : 'See what’s ahead.'}
              </h1>
            </div>
            {tab !== 'More' && tab !== 'Goals' && tab !== 'Compare' && tab !== 'Calendar' && (
              <MonthPicker month={month} setMonth={setMonth} />
            )}
          </div>
          {tab === 'Home' && (
            <HomeScreen
              data={data}
              month={month}
              setTab={setTab}
              openCoach={() => setCoachOpen(true)}
              update={update}
            />
          )}
          {tab === 'Activity' && (
            <ActivityScreen
              data={data}
              month={month}
              update={update}
              quickAdd={quickAdd}
              onQuickAddConsumed={() => setQuickAdd(0)}
            />
          )}
          {tab === 'Budget' && <BudgetScreen data={data} month={month} update={update} />}
          {tab === 'Calendar' && (
            <CalendarScreen data={data} month={month} setMonth={setMonth} update={update} />
          )}
          {tab === 'Goals' && <GoalsScreen data={data} month={month} update={update} />}
          <div hidden={tab !== 'Compare'}>
            <CompareScreen data={data} month={month} />
          </div>
          {tab === 'More' && (
            <MoreScreen
              data={data}
              update={update}
              changeTheme={changeTheme}
              logout={logout}
              onDeleted={() => {
                if (saveTimer.current) clearTimeout(saveTimer.current)
                if (session) {
                  clearPending(session.user.id)
                  clearCache(session.user.id)
                }
                ready.current = false
                setSession(null)
                setData(null)
                setTab('Home')
              }}
              demo={demo}
            />
          )}
        </main>
      </div>
      <nav className="bottom-nav">
        {normalizedMobileTabs(data.settings.mobileTabs).map((name) => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
            <Icon name={tabs.find(([label]) => label === name)?.[1] || 'Circle'} size={25} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {tab === 'Home' && (
        <button
          className="quick-add-fab"
          aria-label="Quick add transaction"
          title="Quick add transaction"
          onClick={() => {
            setMonth(currentMonth())
            setTab('Activity')
            setQuickAdd((value) => value + 1)
          }}
        >
          <Icon name="Plus" size={24} />
        </button>
      )}
      {coachOpen && (
        <Coach
          data={data}
          month={month}
          onClose={() => setCoachOpen(false)}
          messages={insightMessages}
          setMessages={setInsightMessages}
        />
      )}
      {guideOpen && <Guide topic={tab} onClose={() => setGuideOpen(false)} />}
      {quickActionsOpen && (
        <QuickActions actions={quickActions} onClose={() => setQuickActionsOpen(false)} />
      )}
    </div>
  )
}
