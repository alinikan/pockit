import { num } from '../lib/numbers'
import { useState } from 'react'
import type { Frequency, PockitData } from '../types'
import { currentMonth, monthLabel, monthSummary, money, todayISO } from '../lib/finance'
import { validISODate } from '../lib/numbers'
import { downloadJSON, supabase } from '../lib/storage'
import { unsubscribeBrowserPush } from '../lib/push'
import { Field, Icon, SectionHead, Toggle } from '../components/UI'
import { PasskeySettings } from '../components/Passkeys'
import { PushSettings } from '../components/PushSettings'
import { AccountsSettings } from '../components/AccountsSettings'
import { parseBackup } from '../lib/backup'
import { WaypointImport } from '../components/WaypointImport'
import { palettes } from '../lib/themes'
import {
  allMobileTabs,
  moveMobileTab,
  normalizedMobileTabs,
  type MobileTab,
} from '../lib/mobileNavigation'

const moneyTerms = [
  [
    'Take-home pay',
    'The amount you usually receive after tax and deductions. Pockit uses it to plan paydays; record the amount that actually arrives in Activity.',
  ],
  [
    'Income',
    'Money received, such as a paycheque. A transfer between your accounts is not new income.',
  ],
  ['Expense', 'Money spent on a purchase or bill. Pockit counts it on the date you record it.'],
  [
    'Allocated',
    'Money assigned to a category. It is a plan, not a payment that has already happened.',
  ],
  [
    'Remaining',
    'Your plan or category amount minus recorded spending. It is not your bank balance.',
  ],
  ['Category limit', 'The amount you intend to spend in one category during a month.'],
  ['Rollover', 'Unspent category money carries forward, like a jar you keep filling.'],
  ['Contribution', 'Money added to a savings goal or paid toward a debt.'],
  ['Transfer', 'Money moved between places you own. It does not count as income or spending.'],
  ['Recurring', 'Something expected to happen again on a schedule, such as a monthly bill.'],
  ['Debt principal', 'The amount still owed before future interest is added.'],
  ['Interest', 'The cost of borrowing, or money earned on savings, shown as a rate over time.'],
  [
    'Projection',
    'An estimate from today’s numbers. New spending, rates, or payments can change it.',
  ],
  ['Cleared', 'A transaction you have confirmed against an account record.'],
] as const

export function MoreScreen({
  data,
  update,
  changeTheme,
  logout,
  onDeleted,
  demo,
  navigate,
}: {
  data: PockitData
  update: (recipe: (value: PockitData) => PockitData) => void
  changeTheme?: (theme: 'light' | 'dark', origin?: Element | null) => void
  logout: () => void
  onDeleted: () => void
  demo: boolean
  navigate?: (tab: 'Compare') => void
}) {
  const [activeSection, setActiveSection] = useState('')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')
  const [restoreDraft, setRestoreDraft] = useState<PockitData | null>(null)
  const [restoreMessage, setRestoreMessage] = useState('')
  const [rulePayee, setRulePayee] = useState('')
  const [ruleCategory, setRuleCategory] = useState('')
  const mobileTabs = normalizedMobileTabs(data.settings.mobileTabs)
  const thisMonth = currentMonth()
  const incomeThisMonth = monthSummary(data, thisMonth)
  const setMobileTabs = (tabs: MobileTab[]) =>
    update((current) => ({
      ...current,
      settings: { ...current.settings, mobileTabs: tabs },
    }))
  const setProfile = (patch: Partial<PockitData['profile']>) =>
    update((d) => ({ ...d, profile: { ...d.profile, ...patch } }))
  function exportData() {
    downloadJSON(data, `pockit-backup-${new Date().toISOString().slice(0, 10)}.json`)
  }
  async function changePassword() {
    if (!supabase || password.length < 6) return
    const { error } = await supabase.auth.updateUser({ password })
    setMessage(error ? error.message : 'Password updated.')
    if (!error) setPassword('')
  }
  async function deleteAccount() {
    if (!supabase || deletePhrase !== 'DELETE' || !deletePassword || deleting) return
    setDeleting(true)
    setDeleteMessage('')
    try {
      const { data: current, error: currentError } = await supabase.auth.getUser()
      if (currentError || !current.user?.email) throw new Error('Sign in again and try once more.')
      const { data: sessionResult } = await supabase.auth.getSession()
      if (!sessionResult.session) throw new Error('Sign in again and try once more.')
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionResult.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: deletePassword }),
      })
      const result = (await response.json()) as { error?: string; deleted?: boolean }
      if (!response.ok || !result.deleted)
        throw new Error(result.error || 'Could not delete your account. Please try again.')
      await unsubscribeBrowserPush().catch(() => {})
      await supabase.auth.signOut({ scope: 'local' })
      onDeleted()
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : 'Could not delete your account.')
    } finally {
      setDeleting(false)
    }
  }
  const menu = [
    { label: 'Profile', icon: 'CircleDot', target: 'profile' },
    { label: 'Accounts', icon: 'Wallet', target: 'accounts' },
    { label: 'Paycheques', icon: 'CalendarClock', target: 'paycheques' },
    { label: 'Compare months', icon: 'GitCompareArrows', target: 'reports' },
    { label: 'Appearance', icon: 'Palette', target: 'preferences' },
    { label: 'Notifications', icon: 'CalendarCheck2', target: 'notifications' },
    { label: 'Imports & data', icon: 'Download', target: 'imports' },
    {
      label: demo ? 'Install Pockit' : 'Security',
      icon: demo ? 'Smartphone' : 'ShieldCheck',
      target: demo ? 'install' : 'security',
    },
    { label: 'Help & terms', icon: 'CircleHelp', target: 'help' },
  ]
  function openMenuItem(target: string) {
    if (target === 'reports' && navigate) return navigate('Compare')
    if (target === 'help') {
      const help = document.querySelector<HTMLDetailsElement>('[data-more-section="help"]')
      if (help) help.open = true
    }
    const section = document.querySelector<HTMLElement>(`[data-more-section="${target}"]`)
    if (!section) return
    setActiveSection(target)
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    section.focus({ preventScroll: true })
  }
  return (
    <>
      <section className="more-menu" aria-label="More menu">
        <div className="more-menu-handle" aria-hidden="true" />
        <div className="more-menu-heading">
          <div>
            <span>YOUR POCKIT</span>
            <h2>More</h2>
            <p>Choose what you’d like to manage.</p>
          </div>
          <span className="more-menu-avatar" aria-hidden="true">
            {data.profile.name?.[0]?.toUpperCase() || 'P'}
          </span>
        </div>
        <div className="more-menu-grid">
          {menu.map((item) => (
            <button
              key={item.target}
              type="button"
              className={activeSection === item.target ? 'more-menu-tile active' : 'more-menu-tile'}
              onClick={() => openMenuItem(item.target)}
            >
              <span className="more-menu-icon">
                <Icon name={item.icon} size={22} />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="more-menu-actions">
          <button type="button" onClick={() => openMenuItem('profile')}>
            <span className="more-menu-mini-avatar" aria-hidden="true">
              {data.profile.name?.[0]?.toUpperCase() || 'P'}
            </span>
            <span>
              <strong>{data.profile.name || 'Your Pockit'}</strong>
              <small>{demo ? 'Preview mode' : 'Manage your profile'}</small>
            </span>
            <Icon name="ChevronRight" size={18} />
          </button>
          <button type="button" className="more-menu-signout" onClick={logout}>
            <Icon name="LogOut" size={18} /> {demo ? 'Exit preview' : 'Sign out on this device'}
          </button>
        </div>
      </section>
      <div className="settings-grid">
        <div className="settings-main">
          <section className="panel settings-panel" data-more-section="profile" tabIndex={-1}>
            <SectionHead
              title="Your profile"
              help="Dated paydays build your monthly income plan when you set them. Otherwise Pockit uses an imported monthly plan or an average of your usual take-home pay. Record each real paycheque separately in Activity, including overtime or a shorter shift. Recording income does not silently change the plan."
            />
            <div className="form-grid">
              <Field label="Your name">
                <input
                  value={data.profile.name}
                  onChange={(e) => setProfile({ name: e.target.value })}
                />
              </Field>
              <Field
                label="Usual take-home pay per payday"
                hint={
                  data.profile.plannedMonthlyIncome !== undefined
                    ? 'Your imported monthly plan is used for months without dated paydays. Choose “Use my pay details instead” below to remove it.'
                    : 'The after-tax amount you normally expect. Record each actual paycheque in Activity.'
                }
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={data.profile.payAmount || ''}
                  onChange={(e) => setProfile({ payAmount: num(e.target.value) })}
                />
              </Field>
              <Field label="Pay frequency">
                <select
                  value={data.profile.payFrequency}
                  onChange={(e) => setProfile({ payFrequency: e.target.value as Frequency })}
                >
                  <option value="weekly">Once a week</option>
                  <option value="biweekly">Every two weeks</option>
                  <option value="twice-monthly">Twice a month</option>
                  <option value="monthly">Once a month</option>
                </select>
              </Field>
              <Field label="Main reason for using Pockit">
                <select
                  value={data.profile.reason}
                  onChange={(e) => setProfile({ reason: e.target.value })}
                >
                  <option>See where my money goes</option>
                  <option>Stop living paycheque to paycheque</option>
                  <option>Get out of debt</option>
                  <option>Save for something big</option>
                </select>
              </Field>
              <Field label="Housing">
                <select
                  value={data.profile.housing}
                  onChange={(e) => setProfile({ housing: e.target.value })}
                >
                  <option>I rent</option>
                  <option>I own a home</option>
                  <option>No rent or mortgage</option>
                </select>
              </Field>
              <Field label="Getting around">
                <select
                  value={data.profile.transport}
                  onChange={(e) => setProfile({ transport: e.target.value })}
                >
                  <option>Car</option>
                  <option>Public transit</option>
                  <option>Rideshare or taxi</option>
                  <option>Walk or bike</option>
                </select>
              </Field>
            </div>
            <div className="extras-setting">
              <strong>Other things you spend on</strong>
              <div>
                {[
                  'Healthcare',
                  'Personal Care',
                  'Gym',
                  'Pets',
                  'Donations',
                  'Gifts',
                  'Investments',
                  'Travel',
                  'Video Games',
                ].map((item) => (
                  <label key={item}>
                    <input
                      type="checkbox"
                      checked={data.profile.extras.includes(item)}
                      onChange={(e) =>
                        setProfile({
                          extras: e.target.checked
                            ? [...data.profile.extras, item]
                            : data.profile.extras.filter((x) => x !== item),
                        })
                      }
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <div className="settings-income-preview" aria-label="Planned and recorded income">
              <div>
                <span>Planned for {monthLabel(thisMonth)}</span>
                <strong>{money(incomeThisMonth.income, data.settings.currency, true)}</strong>
              </div>
              <div>
                <span>Received and recorded</span>
                <strong>{money(incomeThisMonth.actualIncome, data.settings.currency, true)}</strong>
              </div>
            </div>
            <p className="settings-footnote">
              Dated weekly or biweekly paydays count the cheques in each month. Without dates,
              Pockit uses your imported plan or an average of your usual pay. Recording a real
              paycheque updates the received amount, even if it differs from your plan. Check dates
              in Calendar.
            </p>
            {data.profile.plannedMonthlyIncome !== undefined && (
              <div className="waypoint-income-setting">
                <Field
                  label="Monthly income estimate from Waypoint"
                  hint="Used when no dated payday schedule is set. Scheduled pay dates take priority; recording a paycheque does not change this plan."
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.profile.plannedMonthlyIncome}
                    onChange={(event) =>
                      setProfile({ plannedMonthlyIncome: num(event.target.value) })
                    }
                  />
                </Field>
                <button
                  className="text-button"
                  onClick={() =>
                    update((current) => {
                      const profile = { ...current.profile }
                      delete profile.plannedMonthlyIncome
                      delete profile.plannedIncomeStarts
                      return { ...current, profile }
                    })
                  }
                >
                  Use my pay details instead
                </button>
              </div>
            )}
          </section>
          <section className="panel settings-panel" data-more-section="paycheques" tabIndex={-1}>
            <SectionHead
              title="Your paycheque rhythm"
              help="Your payday tells Pockit when to expect pay. Money available now is a separate starting amount for the Until your next paycheque estimate. For example, if you can spend $600 today and have a $100 bill before payday, Pockit estimates $500 until payday. This is not your monthly budget or a live bank balance."
            />
            <div className="form-grid">
              {data.profile.payFrequency === 'twice-monthly' ? (
                <>
                  <Field label="First payday each month">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={data.profile.paydayDays?.[0] ?? 1}
                      onChange={(e) =>
                        setProfile({
                          paydayDays: [
                            Math.min(31, Math.max(1, Math.floor(num(e.target.value)))),
                            data.profile.paydayDays?.[1] ?? 15,
                          ],
                        })
                      }
                    />
                  </Field>
                  <Field label="Second payday each month">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={data.profile.paydayDays?.[1] ?? 15}
                      onChange={(e) =>
                        setProfile({
                          paydayDays: [
                            data.profile.paydayDays?.[0] ?? 1,
                            Math.min(31, Math.max(1, Math.floor(num(e.target.value)))),
                          ],
                        })
                      }
                    />
                  </Field>
                </>
              ) : (
                <Field label="A payday on your schedule">
                  <input
                    type="date"
                    value={data.profile.paydayAnchor || ''}
                    onChange={(e) =>
                      setProfile({
                        paydayAnchor: validISODate(e.target.value) ? e.target.value : '',
                      })
                    }
                  />
                </Field>
              )}
              {!data.accounts?.some(
                (account) =>
                  !account.archived && (account.kind === 'chequing' || account.kind === 'cash'),
              ) && (
                <Field label="Money available now (optional)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={data.profile.cashOnHand ?? ''}
                    onChange={(e) =>
                      setProfile({
                        cashOnHand: e.target.value ? num(e.target.value) : undefined,
                        cashAsOf: e.target.value ? todayISO() : undefined,
                        cashUpdatedAt: e.target.value ? new Date().toISOString() : undefined,
                      })
                    }
                    placeholder="0.00"
                  />
                </Field>
              )}
            </div>
            <details className="inline-help">
              <summary>
                <Icon name="CircleHelp" size={17} />
                {data.accounts?.some(
                  (account) =>
                    !account.archived && (account.kind === 'chequing' || account.kind === 'cash'),
                )
                  ? 'How is the payday estimate calculated?'
                  : 'What does “Money available now” mean?'}
                <Icon name="ChevronDown" size={16} />
              </summary>
              <p>
                {data.accounts?.some(
                  (account) =>
                    !account.archived && (account.kind === 'chequing' || account.kind === 'cash'),
                )
                  ? 'Pockit starts from your first active chequing or cash account, then uses recorded transactions and unpaid bills before your next payday. Check the account balance in Accounts whenever it differs from reality. This is an estimate, not a bank connection.'
                  : 'Enter what you can spend today from your spending money, after purchases already made. For example, enter $600 if that is what is available now; if a $100 bill is due before payday, Pockit estimates $500 left. Later recorded income and spending adjust the estimate. Update this amount when it no longer matches reality. Leave it empty if you do not know it.'}
              </p>
            </details>
            {data.profile.cashAsOf && (
              <small>Starting amount entered on {data.profile.cashAsOf}.</small>
            )}
          </section>
          <div data-more-section="accounts" tabIndex={-1}>
            <AccountsSettings data={data} update={update} />
          </div>
          <section className="panel settings-panel" data-more-section="preferences" tabIndex={-1}>
            <SectionHead
              title="Preferences"
              help="Choose what Pockit suggests and how it looks on this device. For example, turn off Smart Features if you want to assign every transaction category yourself. Your recorded amounts stay the same."
            />
            <Toggle
              label="Smart Features"
              description="Suggest categories, read receipts on your device, and spot recurring charges."
              checked={data.settings.smart}
              onChange={(smart) => update((d) => ({ ...d, settings: { ...d.settings, smart } }))}
            />
            <details className="merchant-rules-setting">
              <summary>
                <span>
                  <strong>Merchant category rules</strong>
                  <small>
                    When a payee matches exactly, Pockit suggests this category next time. You can
                    still change it for any transaction.
                  </small>
                </span>
                <Icon name="ChevronDown" size={18} />
              </summary>
              {(data.settings.merchantRules || []).length > 0 && (
                <div className="merchant-rule-list">
                  {data.settings.merchantRules!.map((rule) => (
                    <div className="merchant-rule-row" key={rule.payee}>
                      <strong>{rule.payee}</strong>
                      <select
                        aria-label={`Category for ${rule.payee}`}
                        value={rule.categoryId}
                        onChange={(event) =>
                          update((current) => ({
                            ...current,
                            settings: {
                              ...current.settings,
                              merchantRules: current.settings.merchantRules?.map((item) =>
                                item.payee === rule.payee
                                  ? { ...item, categoryId: event.target.value }
                                  : item,
                              ),
                            },
                          }))
                        }
                      >
                        {!data.categories.some((category) => category.id === rule.categoryId) && (
                          <option value={rule.categoryId}>Category removed</option>
                        )}
                        {data.categories
                          .filter((category) => !category.archived)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`Remove rule for ${rule.payee}`}
                        onClick={() =>
                          update((current) => ({
                            ...current,
                            settings: {
                              ...current.settings,
                              merchantRules: current.settings.merchantRules?.filter(
                                (item) => item.payee !== rule.payee,
                              ),
                            },
                          }))
                        }
                      >
                        <Icon name="X" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="merchant-rule-add">
                <input
                  aria-label="Payee for new rule"
                  placeholder="Payee name"
                  value={rulePayee}
                  maxLength={120}
                  onChange={(event) => setRulePayee(event.target.value)}
                />
                <select
                  aria-label="Category for new rule"
                  value={ruleCategory}
                  onChange={(event) => setRuleCategory(event.target.value)}
                >
                  <option value="">Choose category</option>
                  {data.categories
                    .filter((category) => !category.archived)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="secondary-button compact"
                  disabled={!rulePayee.trim() || !ruleCategory}
                  onClick={() => {
                    const payee = rulePayee.trim().toLowerCase()
                    update((current) => ({
                      ...current,
                      settings: {
                        ...current.settings,
                        merchantRules: [
                          ...(current.settings.merchantRules || []).filter(
                            (rule) => rule.payee !== payee,
                          ),
                          { payee, categoryId: ruleCategory },
                        ],
                      },
                    }))
                    setRulePayee('')
                    setRuleCategory('')
                  }}
                >
                  <Icon name="Plus" size={16} /> Add rule
                </button>
              </div>
            </details>
            <Toggle
              label="Light mode"
              description="Choose a light or dark background. Your colour choice below works in both."
              checked={data.settings.theme === 'light'}
              onChange={(light, origin) =>
                changeTheme
                  ? changeTheme(light ? 'light' : 'dark', origin)
                  : update((d) => ({
                      ...d,
                      settings: { ...d.settings, theme: light ? 'light' : 'dark' },
                    }))
              }
            />
            <div className="theme-choice" role="radiogroup" aria-label="Colour theme">
              <div>
                <strong>Colour theme</strong>
                <small>
                  Choose the look that is easiest for you to read. You can change it anytime.
                </small>
              </div>
              <div className="theme-choice-grid">
                {palettes.map((palette) => (
                  <button
                    key={palette.id}
                    type="button"
                    role="radio"
                    aria-checked={(data.settings.palette || 'pockit') === palette.id}
                    className={`theme-choice-card ${(data.settings.palette || 'pockit') === palette.id ? 'selected' : ''}`}
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        settings: { ...current.settings, palette: palette.id },
                      }))
                    }
                  >
                    <span className="theme-swatches" aria-hidden="true">
                      {palette.swatches.map((colour) => (
                        <i key={colour} style={{ background: colour }} />
                      ))}
                    </span>
                    <strong>{palette.name}</strong>
                    <small>{palette.description}</small>
                  </button>
                ))}
              </div>
              <small>
                The Waypoint style is a colour choice inspired by Waypoint’s visual language; Pockit
                remains its own app.
              </small>
            </div>
            <details className="mobile-nav-setting">
              <summary>
                <span>
                  <strong>iPhone bottom tabs</strong>
                  <small>
                    Choose four to seven shortcuts. Every page stays available from Search.
                  </small>
                </span>
                <Icon name="ChevronDown" size={18} />
              </summary>
              <p className="settings-footnote">
                Home and More always stay in the bar. Use the arrows to change the order.
              </p>
              <div className="mobile-nav-list">
                {[...mobileTabs, ...allMobileTabs.filter((name) => !mobileTabs.includes(name))].map(
                  (name) => {
                    const chosen = mobileTabs.includes(name)
                    const index = mobileTabs.indexOf(name)
                    const required = name === 'Home' || name === 'More'
                    return (
                      <div className="mobile-nav-row" key={name}>
                        <label>
                          <input
                            type="checkbox"
                            checked={chosen}
                            disabled={required || (chosen && mobileTabs.length <= 4)}
                            onChange={() =>
                              setMobileTabs(
                                chosen
                                  ? mobileTabs.filter((item) => item !== name)
                                  : [...mobileTabs, name],
                              )
                            }
                          />
                          <span>
                            {name}
                            {required && <small>Always shown</small>}
                          </span>
                        </label>
                        {chosen && (
                          <div className="home-layout-move">
                            <button
                              type="button"
                              aria-label={`Move ${name} tab up`}
                              disabled={index === 0}
                              onClick={() => setMobileTabs(moveMobileTab(mobileTabs, name, -1))}
                            >
                              <Icon name="ArrowUp" size={17} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${name} tab down`}
                              disabled={index === mobileTabs.length - 1}
                              onClick={() => setMobileTabs(moveMobileTab(mobileTabs, name, 1))}
                            >
                              <Icon name="ArrowDown" size={17} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  },
                )}
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    settings: { ...current.settings, mobileTabs: undefined },
                  }))
                }
              >
                Reset bottom tabs
              </button>
            </details>
            <Toggle
              label="Show optional guides"
              description="Short, illustrated explanations can open from the question mark in each part of Pockit."
              checked={data.settings.guide !== false}
              onChange={(guide) => update((d) => ({ ...d, settings: { ...d.settings, guide } }))}
            />
            <Toggle
              label="Hide money amounts"
              description="Blur amounts while someone is near your screen. Tap the eye in the top bar to switch quickly."
              checked={!!data.settings.hideAmounts}
              onChange={(hideAmounts) =>
                update((d) => ({ ...d, settings: { ...d.settings, hideAmounts } }))
              }
            />
            <div className="soft-note">Pockit uses Canadian dollars throughout your budget.</div>
          </section>
          <section
            className="panel settings-panel install-panel"
            data-more-section="install"
            tabIndex={-1}
          >
            <SectionHead
              title="Put Pockit on your Home Screen"
              help="The installed web app opens in its own window with Pockit’s icon. Your account and budget stay the same."
            />
            <div className="install-steps">
              <div>
                <span>1</span>
                <strong>On iPhone</strong>
                <p>Open your Pockit website in Safari. Tap Share, then Add to Home Screen.</p>
              </div>
              <div>
                <span>2</span>
                <strong>Open the icon</strong>
                <p>
                  Launch Pockit from its new Home Screen icon and sign in. Face ID can work through
                  a passkey you add in Account security.
                </p>
              </div>
              <div>
                <span>3</span>
                <strong>On a computer</strong>
                <p>
                  Open the same website in your browser. In Chrome or Edge, use the browser’s
                  Install option if you want a separate window.
                </p>
              </div>
            </div>
          </section>
          <div data-more-section="notifications" tabIndex={-1}>
            <PushSettings demo={demo} />
          </div>
          <div data-more-section="imports" tabIndex={-1}>
            <WaypointImport data={data} update={update} />
          </div>
          <section className="panel settings-panel">
            <SectionHead
              title="Your data"
              help="Download a private copy of your budget before making a big change. For example, save a backup before importing another app's data. Restore replaces the current budget only after you review the file."
            />
            <div className="settings-action">
              <div>
                <strong>Download a backup</strong>
                <small>
                  Save a JSON copy of your categories, transactions, goals, and settings.
                </small>
              </div>
              <button className="secondary-button compact" onClick={exportData}>
                <Icon name="Download" size={16} /> Export
              </button>
            </div>
            <div className="settings-action">
              <div>
                <strong>Restore a backup</strong>
                <small>
                  Review a JSON backup before replacing this budget. Pockit downloads your current
                  copy first.
                </small>
              </div>
              <label className="secondary-button compact restore-button">
                <Icon name="FileUp" size={16} /> Choose file
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    setRestoreMessage('')
                    try {
                      if (file.size > 5_000_000)
                        throw new Error('Choose a backup smaller than 5 MB.')
                      setRestoreDraft(parseBackup(await file.text()))
                    } catch (error) {
                      setRestoreDraft(null)
                      setRestoreMessage(
                        error instanceof Error ? error.message : 'Could not read backup.',
                      )
                    }
                    event.target.value = ''
                  }}
                />
              </label>
            </div>
            {restoreDraft && (
              <div className="restore-review" role="group" aria-label="Review backup restore">
                <strong>Review before restoring</strong>
                <p>
                  {restoreDraft.transactions.length} transactions · {restoreDraft.categories.length}{' '}
                  categories · {restoreDraft.goals.length} goals. This replaces the current budget
                  for this account.
                </p>
                <button
                  className="primary-button compact"
                  onClick={() => {
                    downloadJSON(data, `pockit-before-restore-${todayISO()}.json`)
                    update(() => restoreDraft)
                    setRestoreDraft(null)
                    setRestoreMessage(
                      'Backup restored. Check your budget before making more changes.',
                    )
                  }}
                >
                  Download current copy and restore
                </button>
                <button className="text-button" onClick={() => setRestoreDraft(null)}>
                  Cancel
                </button>
              </div>
            )}
            {restoreMessage && (
              <p className="form-message" role="status">
                {restoreMessage}
              </p>
            )}
            <div className="settings-action">
              <div>
                <strong>{demo ? 'Preview data' : 'Cloud sync'}</strong>
                <small>
                  {demo
                    ? 'Stored in this browser only. Create an account to sync across devices.'
                    : 'Your budget is saved in your private Supabase account.'}
                </small>
              </div>
              <Icon name={demo ? 'HardDrive' : 'Cloud'} size={21} />
            </div>
          </section>
          {!demo && (
            <section className="panel settings-panel" data-more-section="security" tabIndex={-1}>
              <SectionHead
                title="Account security"
                help="Change your sign-in password here. For example, choose a new password if someone else may know your old one. A passkey can also help you sign in with your device."
              />
              <Field
                label="New password"
                hint="At least 6 characters. Your current session stays signed in."
              >
                <input
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                />
              </Field>
              <button
                className="secondary-button compact"
                disabled={password.length < 6}
                onClick={changePassword}
              >
                Update password
              </button>
              {message && <div className="form-message">{message}</div>}
            </section>
          )}
          {!demo && <PasskeySettings />}
          {!demo && (
            <section className="panel settings-panel delete-account-panel">
              <SectionHead
                title="Delete account"
                help="This permanently removes your Pockit sign-in and the budget saved with it. Download a backup above first if you want one."
              />
              <p className="soft-note">
                We’ll email a confirmation to your account address after deletion. This cannot be
                undone.
              </p>
              {!showDelete ? (
                <button
                  className="secondary-button compact delete-account-trigger"
                  onClick={() => setShowDelete(true)}
                >
                  <Icon name="Trash2" size={16} /> Delete my account
                </button>
              ) : (
                <div className="delete-account-form">
                  <Field label="Current password">
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={deletePassword}
                      onChange={(event) => setDeletePassword(event.target.value)}
                      placeholder="Enter your password"
                    />
                  </Field>
                  <Field label="Type DELETE to confirm">
                    <input
                      value={deletePhrase}
                      onChange={(event) => setDeletePhrase(event.target.value)}
                      placeholder="DELETE"
                      autoComplete="off"
                    />
                  </Field>
                  <div className="delete-account-actions">
                    <button
                      className="secondary-button compact"
                      disabled={deleting}
                      onClick={() => {
                        setShowDelete(false)
                        setDeletePassword('')
                        setDeletePhrase('')
                        setDeleteMessage('')
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="delete-account-button"
                      disabled={deleting || !deletePassword || deletePhrase !== 'DELETE'}
                      onClick={deleteAccount}
                    >
                      {deleting ? 'Deleting…' : 'Permanently delete account'}
                    </button>
                  </div>
                  {deleteMessage && (
                    <div className="form-message" role="alert">
                      {deleteMessage}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
        <aside className="settings-side">
          <details className="panel glossary" data-more-section="help" tabIndex={-1}>
            <summary>
              <span>
                <Icon name="CircleHelp" size={19} /> A few handy terms
              </span>
              <Icon name="ChevronDown" size={18} />
            </summary>
            <p className="glossary-intro">Plain words for the numbers you see in Pockit.</p>
            <div className="glossary-terms">
              {moneyTerms.map(([term, meaning]) => (
                <div key={term}>
                  <strong>{term}</strong>
                  <p>{meaning}</p>
                </div>
              ))}
            </div>
          </details>
        </aside>
      </div>
    </>
  )
}
