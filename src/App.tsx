import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { MonthKey, PockitData } from './types'
import { currentMonth } from './lib/finance'
import { makeDemoData, makeInitialData } from './lib/defaults'
import { loadCloud, readDemo, saveCloud, saveDemo, supabase } from './lib/storage'
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
import { Coach } from './screens/Coach'

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
  const [tab, setTab] = useState<Tab>('Home')
  const [month, setMonth] = useState<MonthKey>(currentMonth())
  const [coachOpen, setCoachOpen] = useState(false)
  const saveQueue = useRef(Promise.resolve())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ready = useRef(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth
      .getSession()
      .then(({ data: result }) => setSession(result.session))
      .finally(() => setLoading(false))
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (!next) {
        setData(null)
        ready.current = false
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || demo) return
    let cancelled = false
    ready.current = false
    setLoading(true)
    loadCloud(session)
      .then((cloud) => {
        if (!cancelled) {
          setData(cloud || makeInitialData(session.user.user_metadata?.name || ''))
          ready.current = true
          setError('')
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            `Could not load your budget: ${e.message}. Check that you ran supabase/schema.sql.`,
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
          .then(() => saveCloud(session, data))
          .then(() => setError(''))
          .catch((e) => {
            setError(`Changes could not sync: ${e.message}`)
          })
    }, 400)
    saveTimer.current = timer
    return () => {
      clearTimeout(timer)
      if (saveTimer.current === timer) saveTimer.current = null
    }
  }, [data, demo, session])

  function startDemo() {
    setDemo(true)
    ready.current = true
    setData(readDemo() || makeDemoData())
  }
  function update(recipe: (current: PockitData) => PockitData) {
    setData((current) => (current ? recipe(current) : current))
  }
  function exitDemo() {
    setDemo(false)
    setData(null)
    ready.current = false
    setTab('Home')
  }
  async function logout() {
    if (demo) exitDemo()
    else await supabase?.auth.signOut()
  }
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
  if (!data.onboarded)
    return (
      <Onboarding
        initial={data}
        onChange={setData}
        onSave={async (next) => {
          if (!session) throw new Error('Your session has expired. Sign in again.')
          if (saveTimer.current) {
            clearTimeout(saveTimer.current)
            saveTimer.current = null
          }
          saveQueue.current = saveQueue.current
            .catch(() => undefined)
            .then(() => saveCloud(session, next))
          await saveQueue.current
          setError('')
        }}
        onDone={setData}
      />
    )
  return (
    <div className="app-shell">
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
              <strong>Money Coach</strong>
              <small>Ask Pockit anything</small>
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
              className="theme-button"
              title="Toggle theme"
              aria-label="Toggle theme"
              onClick={() =>
                update((d) => ({
                  ...d,
                  settings: {
                    ...d.settings,
                    theme: d.settings.theme === 'dark' ? 'light' : 'dark',
                  },
                }))
              }
            >
              <Icon name={data.settings.theme === 'dark' ? 'Sun' : 'Moon'} size={19} />
            </button>
            <button className="coach-top" onClick={() => setCoachOpen(true)}>
              <Icon name="Sparkles" size={17} /> Ask Pockit
            </button>
            <div className="avatar small">{data.profile.name?.[0]?.toUpperCase() || 'P'}</div>
          </div>
        </header>
        {error && (
          <div className="sync-error" role="alert">
            {error}
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
            {tab !== 'More' && tab !== 'Goals' && tab !== 'Compare' && (
              <MonthPicker month={month} setMonth={setMonth} />
            )}
          </div>
          {tab === 'Home' && (
            <HomeScreen
              data={data}
              month={month}
              setTab={setTab}
              openCoach={() => setCoachOpen(true)}
            />
          )}
          {tab === 'Activity' && <ActivityScreen data={data} month={month} update={update} />}
          {tab === 'Budget' && <BudgetScreen data={data} month={month} update={update} />}
          {tab === 'Calendar' && <CalendarScreen data={data} month={month} update={update} />}
          {tab === 'Goals' && <GoalsScreen data={data} month={month} update={update} />}
          <div hidden={tab !== 'Compare'}>
            <CompareScreen data={data} month={month} />
          </div>
          {tab === 'More' && (
            <MoreScreen
              data={data}
              update={update}
              logout={logout}
              onDeleted={() => {
                if (saveTimer.current) clearTimeout(saveTimer.current)
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
        {tabs.map(([name, icon]) => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>
            <Icon name={icon} size={21} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {coachOpen && <Coach data={data} month={month} onClose={() => setCoachOpen(false)} />}
    </div>
  )
}
