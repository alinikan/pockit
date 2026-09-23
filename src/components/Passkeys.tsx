import { useEffect, useState } from 'react'
import { supabase } from '../lib/storage'
import { passkeysSupported } from '../lib/passkeys'
import { Icon, SectionHead } from './UI'

type Passkey = {
  id: string
  friendly_name?: string
  created_at: string
  last_used_at?: string
}

export function PasskeySettings() {
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [busy, setBusy] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const supported = passkeysSupported()

  useEffect(() => {
    if (!supabase || !supported) return
    let active = true
    supabase.auth.passkey.list().then(({ data, error }) => {
      if (!active) return
      if (error) setMessage(error.message)
      else setPasskeys(data || [])
    })
    return () => {
      active = false
    }
  }, [supported])

  async function addPasskey() {
    if (!supabase || busy) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.registerPasskey()
      if (error) throw error
      const result = await supabase.auth.passkey.list()
      if (result.error) throw result.error
      setPasskeys(result.data || [])
      setMessage('Passkey added. Next time, use “Sign in with a passkey.”')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not add this passkey. Please try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function removePasskey(id: string) {
    if (!supabase || busy) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: id })
      if (error) throw error
      setPasskeys((current) => current.filter((item) => item.id !== id))
      setRemoveId(null)
      setMessage('Passkey removed. You can still sign in with your password.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove this passkey.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel settings-panel">
      <SectionHead
        title="Passkeys"
        help="A passkey signs you in using your device’s Face ID, Touch ID, PIN, or security key. Pockit never sees your fingerprint or face scan."
      />
      <p className="soft-note">
        Add a passkey on a device you trust. Keep your password as a backup. Passkeys are tied to
        this website address.
      </p>
      {!supported ? (
        <p className="soft-note">
          This browser or connection does not support passkeys. Try the secure Pockit website in an
          updated browser.
        </p>
      ) : (
        <>
          <button
            className="secondary-button compact passkey-add-button"
            type="button"
            disabled={busy}
            onClick={addPasskey}
          >
            <Icon name="Fingerprint" size={18} /> {busy ? 'One moment…' : 'Add a passkey'}
          </button>
          {passkeys.length > 0 && (
            <div className="passkey-list">
              {passkeys.map((passkey) => (
                <div className="settings-action passkey-row" key={passkey.id}>
                  <Icon name="Fingerprint" size={20} />
                  <div>
                    <strong>{passkey.friendly_name || 'Passkey'}</strong>
                    <small>Added {new Date(passkey.created_at).toLocaleDateString()}</small>
                  </div>
                  {removeId === passkey.id ? (
                    <div className="passkey-remove-actions">
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => setRemoveId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="text-button danger-text"
                        disabled={busy}
                        onClick={() => removePasskey(passkey.id)}
                      >
                        Confirm remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-button danger-text"
                      disabled={busy}
                      onClick={() => setRemoveId(passkey.id)}
                      aria-label={`Remove ${passkey.friendly_name || 'passkey'}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {message && (
            <div className="form-message" role="status">
              {message}
            </div>
          )}
        </>
      )}
    </section>
  )
}
