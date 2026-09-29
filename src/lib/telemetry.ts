import type { ErrorEvent } from '@sentry/browser'

export function privacySafeVitals<T extends { url: string; route?: string }>(event: T): T | null {
  try {
    return { ...event, url: `${new URL(event.url).origin}/`, route: '/' }
  } catch {
    return null
  }
}

// Only error kind and bundled source location leave the browser. Error messages,
// URLs, form values, breadcrumbs, user data, and arbitrary SDK context are discarded.
export function privacySafeError(event: ErrorEvent): ErrorEvent | null {
  const values = event.exception?.values
  if (!values?.length) return null
  const first = values[0]
  const type = /^[A-Za-z][A-Za-z0-9_.]{0,80}$/.test(first.type || '') ? first.type : 'Error'
  const frames = first.stacktrace?.frames
    ?.map((frame) => {
      const raw = frame.filename || frame.abs_path || ''
      const file = raw.match(/(?:^|\/)assets\/([A-Za-z0-9_.-]+\.js)(?:[?#]|$)/)?.[1]
      if (!file) return null
      return {
        filename: `/assets/${file}`,
        lineno: Number.isInteger(frame.lineno) ? frame.lineno : undefined,
        colno: Number.isInteger(frame.colno) ? frame.colno : undefined,
      }
    })
    .filter((frame) => frame !== null)

  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: 'javascript',
    level: 'error',
    exception: {
      values: [
        {
          type,
          value: 'Pockit runtime error',
          ...(frames?.length ? { stacktrace: { frames } } : {}),
        },
      ],
    },
  }
}
