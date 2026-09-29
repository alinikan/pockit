import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { privacySafeError, privacySafeVitals } from './lib/telemetry'
import '@fontsource-variable/dm-sans/wght.css'
import '@fontsource-variable/manrope/wght.css'
import './styles.css'
import './screens/Compare.css'
import { installStandaloneZoomPolicy } from './lib/standaloneZoom'

installStandaloneZoomPolicy()

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/browser')
    .then(({ init }) =>
      init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: 'production',
        maxBreadcrumbs: 0,
        beforeBreadcrumb: () => null,
        beforeSend: privacySafeError,
        integrations: (defaults) =>
          defaults.filter((integration) =>
            ['GlobalHandlers', 'InboundFilters', 'Dedupe'].includes(integration.name),
          ),
      }),
    )
    .catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {import.meta.env.PROD && import.meta.env.VITE_ENABLE_SPEED_INSIGHTS === 'true' && (
      <SpeedInsights beforeSend={privacySafeVitals} />
    )}
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD)
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
