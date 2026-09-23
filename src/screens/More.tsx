import { num } from '../lib/numbers'
import { useState } from 'react'
import type { Frequency, PockitData } from '../types'
import { monthlyPay, money } from '../lib/finance'
import { supabase } from '../lib/storage'
import { Field, Icon, SectionHead, Toggle } from '../components/UI'

export function MoreScreen({
  data,
  update,
  logout,
  onDeleted,
  demo,
}: {
  data: PockitData
  update: (recipe: (value: PockitData) => PockitData) => void
  logout: () => void
  onDeleted: () => void
  demo: boolean
}) {
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState('')
  const setProfile = (patch: Partial<PockitData['profile']>) =>
    update((d) => ({ ...d, profile: { ...d.profile, ...patch } }))
  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pockit-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
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
      await supabase.auth.signOut({ scope: 'local' })
      onDeleted()
    } catch (error) {
      setDeleteMessage(error instanceof Error ? error.message : 'Could not delete your account.')
    } finally {
      setDeleting(false)
    }
  }
  return (
    <div className="settings-grid">
      <div className="settings-main">
        <section className="panel settings-panel">
          <SectionHead
            title="Your profile"
            help="Your take-home pay helps Pockit estimate monthly income if you haven’t recorded paycheques yet."
          />
          <div className="form-grid">
            <Field label="Your name">
              <input
                value={data.profile.name}
                onChange={(e) => setProfile({ name: e.target.value })}
              />
            </Field>
            <Field label="Take-home pay each period">
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
          <div className="settings-footnote">
            Expected monthly income:{' '}
            {money(
              monthlyPay(data.profile.payAmount, data.profile.payFrequency),
              data.settings.currency,
              true,
            )}
            . Edit or add categories in Budget when your spending changes.
          </div>
        </section>
        <section className="panel settings-panel">
          <SectionHead title="Preferences" />
          <Toggle
            label="Smart Features"
            description="Suggest categories, read receipts on your device, and spot recurring charges."
            checked={data.settings.smart}
            onChange={(smart) => update((d) => ({ ...d, settings: { ...d.settings, smart } }))}
          />
          <Toggle
            label="Light mode"
            description="Switch between Pockit’s light and dark palettes."
            checked={data.settings.theme === 'light'}
            onChange={(light) =>
              update((d) => ({
                ...d,
                settings: { ...d.settings, theme: light ? 'light' : 'dark' },
              }))
            }
          />
          <Field label="Currency">
            <select
              value={data.settings.currency}
              onChange={(e) =>
                update((d) => ({
                  ...d,
                  settings: { ...d.settings, currency: e.target.value as 'CAD' | 'USD' },
                }))
              }
            >
              <option value="CAD">Canadian dollar (CAD)</option>
              <option value="USD">US dollar (USD)</option>
            </select>
          </Field>
          <div className="soft-note">
            Changing currency changes the symbol only; it does not convert balances.
          </div>
        </section>
        <section className="panel settings-panel">
          <SectionHead title="Your data" />
          <div className="settings-action">
            <div>
              <strong>Download a backup</strong>
              <small>Save a JSON copy of your categories, transactions, goals, and settings.</small>
            </div>
            <button className="secondary-button compact" onClick={exportData}>
              <Icon name="Download" size={16} /> Export
            </button>
          </div>
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
          <section className="panel settings-panel">
            <SectionHead title="Account security" />
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
        <div className="settings-profile-card">
          <div className="avatar large">{data.profile.name?.[0]?.toUpperCase() || 'P'}</div>
          <h3>{data.profile.name || 'Your Pockit'}</h3>
          <p>{demo ? 'Preview mode' : 'Your personal budget'}</p>
          <div>
            <Icon name="LockKeyhole" size={18} /> Your money is yours to see.
          </div>
        </div>
        <div className="panel glossary">
          <SectionHead title="A few handy terms" />
          <div>
            <strong>Allocated</strong>
            <p>Money you’ve assigned to categories. Think of it as a plan, not a payment.</p>
          </div>
          <div>
            <strong>Rollover</strong>
            <p>Unused category money carries into the next month, like a jar you keep filling.</p>
          </div>
          <div>
            <strong>Transfer</strong>
            <p>Moving money between places. It does not add to income or spending.</p>
          </div>
          <div>
            <strong>Projection</strong>
            <p>
              An estimate based on today’s numbers. New spending, rates, or payments can change it.
            </p>
          </div>
        </div>
        <button className="signout-button" onClick={logout}>
          <Icon name="LogOut" size={18} /> {demo ? 'Exit preview' : 'Sign out'}
        </button>
      </aside>
    </div>
  )
}
