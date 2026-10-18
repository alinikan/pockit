const WEBSITE_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover'
const APP_VIEWPORT = `${WEBSITE_VIEWPORT}, minimum-scale=1, maximum-scale=1, user-scalable=no`

type StandaloneNavigator = Navigator & { standalone?: boolean }

/** Limit pinch scaling in the installed app while leaving the Safari website zoomable. */
export function installStandaloneZoomPolicy() {
  const displayMode = window.matchMedia('(display-mode: standalone)')
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  const isStandalone = () =>
    (navigator as StandaloneNavigator).standalone === true ||
    (displayMode.matches && navigator.maxTouchPoints > 0)
  const update = () => {
    const installed = isStandalone()
    document.documentElement.classList.toggle('standalone-app', installed)
    if (viewport) viewport.content = installed ? APP_VIEWPORT : WEBSITE_VIEWPORT
  }
  const preventPinch = (event: TouchEvent) => {
    if (isStandalone() && event.touches.length > 1) event.preventDefault()
  }
  const preventGesture = (event: Event) => {
    if (isStandalone()) event.preventDefault()
  }
  update()
  displayMode.addEventListener?.('change', update)
  const capture = { passive: false, capture: true }
  document.addEventListener('touchstart', preventPinch, capture)
  document.addEventListener('touchmove', preventPinch, capture)
  document.addEventListener('gesturestart', preventGesture, capture)
  document.addEventListener('gesturechange', preventGesture, capture)
  document.addEventListener('gestureend', preventGesture, capture)
  return () => {
    displayMode.removeEventListener?.('change', update)
    document.removeEventListener('touchstart', preventPinch, true)
    document.removeEventListener('touchmove', preventPinch, true)
    document.removeEventListener('gesturestart', preventGesture, true)
    document.removeEventListener('gesturechange', preventGesture, true)
    document.removeEventListener('gestureend', preventGesture, true)
    document.documentElement.classList.remove('standalone-app')
    if (viewport) viewport.content = WEBSITE_VIEWPORT
  }
}
