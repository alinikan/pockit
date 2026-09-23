import { useEffect, useState } from 'react'
import { supabase } from '../lib/storage'
import { disablePushForCurrentAccount } from '../lib/push'
import { Icon, SectionHead } from './UI'

const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true)
export const decodeVapidKey = (value: string) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const decoded = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

export function PushSettings({ demo }: { demo: boolean }) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const supported =
    !demo &&
    import.meta.env.PROD &&
    !!supabase &&
    !!publicKey &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext
  useEffect(() => {
    if (!supported) return
    let cancelled = false
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      const subscription = await registration?.pushManager.getSubscription()
      if (!subscription) return
      const { data: user } = await supabase!.auth.getUser()
      if (!user.user) return
      const { data: row } = await supabase!
        .from('pockit_push_subscriptions')
        .select('enabled')
        .eq('endpoint', subscription.endpoint)
        .eq('user_id', user.user.id)
        .maybeSingle()
      if (!cancelled) setEnabled(!!row?.enabled)
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [supported])
  async function enable() {
    if (!supported || !supabase || !publicKey) return
    setBusy(true)
    setMessage('')
    try {
      if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !standalone())
        throw new Error('Add Pockit to your iPhone Home Screen first, then open it from its icon.')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted')
        throw new Error('Notifications were not allowed. You can change this in device settings.')
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) throw new Error('Refresh the installed Pockit app and try again.')
      const existing = await registration.pushManager.getSubscription()
      if (existing && !enabled) await existing.unsubscribe()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      })
      const { data: user, error: userError } = await supabase.auth.getUser()
      if (userError || !user.user) throw new Error('Sign in before enabling reminders.')
      const { error } = await supabase.from('pockit_push_subscriptions').upsert(
        {
          endpoint: subscription.endpoint,
          user_id: user.user.id,
          subscription: subscription.toJSON(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          enabled: true,
        },
        { onConflict: 'endpoint' },
      )
      if (error) throw error
      setEnabled(true)
      setMessage('Bill reminders are on for this device.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not enable reminders.')
    } finally {
      setBusy(false)
    }
  }
  async function disable() {
    if (!supabase) return
    setBusy(true)
    setMessage('')
    try {
      await disablePushForCurrentAccount()
      setEnabled(false)
      setMessage('Bill reminders are off for this device.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not turn off reminders.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="panel settings-panel">
      <SectionHead
        title="Bill reminders"
        help="Optional notifications for unpaid bills due today. Pockit never puts a bill name or amount in the notification preview."
      />
      <div className="settings-action">
        <div>
          <strong>{enabled ? 'On for this device' : 'Off for this device'}</strong>
          <small>
            {demo
              ? 'Sign in to enable reminders.'
              : !import.meta.env.PROD
                ? 'Reminders become available in the deployed app.'
                : !publicKey
                  ? 'The owner must configure Web Push first.'
                  : !supported
                    ? 'This browser does not support web push here.'
                    : 'Install Pockit on your iPhone Home Screen to receive reminders even when it is closed.'}
          </small>
        </div>
        <button
          className="secondary-button compact"
          disabled={!supported || busy}
          onClick={() => void (enabled ? disable() : enable())}
        >
          <Icon name="Bell" size={16} /> {busy ? 'Working…' : enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>
      {message && (
        <div className="form-message" role="status">
          {message}
        </div>
      )}
      <p className="settings-footnote">
        Daily delivery is approximate and depends on your device settings and the free scheduled
        check. Open Calendar for the full bill details.
      </p>
    </section>
  )
}
