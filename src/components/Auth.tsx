import { useState } from 'react'
import { Brand, Icon } from './UI'
import { supabase } from '../lib/storage'

export function Auth({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<'signup' | 'signin' | 'reset'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase)
      return setMessage(
        'Cloud sign-up needs Supabase. Use Preview Pockit now, then follow the README to connect it.',
      )
    setLoading(true)
    setMessage('')
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setMessage('Check your email for a password reset link.')
      } else if (mode === 'signup') {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (!data.session) setMessage('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="auth-layout">
      <div className="auth-art">
        <div className="auth-art-top">
          <Brand />
          <span>YOUR MONEY, IN FOCUS</span>
        </div>
        <div className="auth-art-content">
          <div className="eyebrow light">A little more clarity, every day</div>
          <h1>
            Make room for
            <br />
            <em>what matters.</em>
          </h1>
          <p>A thoughtful home for your spending, plans, and the goals you’re working toward.</p>
          <div className="auth-art-visual">
            <div className="floating-card card-one">
              <span>AVAILABLE THIS MONTH</span>
              <strong>
                $2,146<span>.70</span>
              </strong>
              <div className="mini-wave">▂▃▂▅▆▅▇▆▇█</div>
            </div>
            <div className="floating-card card-two">
              <Icon name="ArrowUpRight" size={20} />
              <span>You're on track</span>
            </div>
          </div>
        </div>
        <div className="auth-art-foot">Made for real life, not perfect spreadsheets.</div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="eyebrow">WELCOME TO POCKIT</div>
          <h2>
            {mode === 'signup'
              ? 'Start feeling good about money.'
              : mode === 'signin'
                ? 'Welcome back.'
                : 'Reset your password.'}
          </h2>
          <p>
            {mode === 'signup'
              ? 'A few details, then we’ll make a plan that feels like yours.'
              : mode === 'signin'
                ? 'Your budget is right where you left it.'
                : 'We’ll email you a link to get back in.'}
          </p>
          <form onSubmit={submit}>
            {mode === 'signup' && (
              <label className="field">
                <span>Your name</span>
                <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex"
                />
              </label>
            )}
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {mode !== 'reset' && (
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
              </label>
            )}
            {message && (
              <div className="form-message" role="status">
                {message}
              </div>
            )}
            <button className="primary-button full" disabled={loading}>
              {loading
                ? 'One moment…'
                : mode === 'signup'
                  ? 'Create my account'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Email reset link'}
              <Icon name="ArrowRight" size={18} />
            </button>
          </form>
          <div className="auth-links">
            {mode === 'signup' ? (
              <button
                onClick={() => {
                  setMode('signin')
                  setMessage('')
                }}
              >
                Already have an account? <strong>Sign in</strong>
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMode('signup')
                    setMessage('')
                  }}
                >
                  Create an account
                </button>
                {mode === 'signin' && (
                  <button
                    onClick={() => {
                      setMode('reset')
                      setMessage('')
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </>
            )}
          </div>
          <div className="auth-divider">or</div>
          <button className="secondary-button full" onClick={onDemo}>
            <Icon name="Play" size={17} /> Preview Pockit
          </button>
          <small className="demo-note">
            Preview data stays in this browser. Sign up after connecting Supabase to sync across
            devices.
          </small>
        </div>
      </div>
    </div>
  )
}
