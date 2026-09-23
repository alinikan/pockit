import { describe, expect, it } from 'vitest'
import { deletionEmail, escapeHtml, signupEmail } from './email'
import { bearerToken, sameSecret } from './http'

describe('notification emails', () => {
  it('uses Pockit branding and says what deletion removes', () => {
    const message = deletionEmail()
    expect(message.subject).toContain('deleted')
    expect(message.htmlContent).toContain('pockit')
    expect(message.textContent).toContain('budget data linked to it')
    expect(message.htmlContent).not.toContain('{{')
  })

  it('escapes untrusted email text and shares no financial details', () => {
    const message = signupEmail('x<script>@example.com', '2026-09-22T12:30:00Z')
    expect(message.htmlContent).toContain('x&lt;script&gt;@example.com')
    expect(message.htmlContent).not.toContain('x<script>')
    expect(message.htmlContent).toContain('Sep')
    expect(message.textContent).not.toContain('income')
    expect(escapeHtml('a&"b')).toBe('a&amp;&quot;b')
  })
})

describe('API guards', () => {
  it('requires a strict bearer token and exact secret', () => {
    expect(bearerToken({ headers: { authorization: 'Bearer abc.def' } })).toBe('abc.def')
    expect(bearerToken({ headers: { authorization: 'Basic abc' } })).toBeNull()
    expect(sameSecret('sample-secret', 'sample-secret')).toBe(true)
    expect(sameSecret('sample-secret!', 'sample-secret')).toBe(false)
    expect(sameSecret('', 'sample-secret')).toBe(false)
  })
})
