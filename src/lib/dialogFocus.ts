let pointerTrigger: HTMLElement | null = null

/** Safari does not normally focus a clicked button. Remember the opener without moving focus or dismissing the keyboard. */
export function installDialogFocusTracking() {
  const remember = (event: PointerEvent) => {
    pointerTrigger =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('button, [role="button"], a[href]')
        : null
  }
  document.addEventListener('pointerdown', remember, true)
  return () => {
    document.removeEventListener('pointerdown', remember, true)
    pointerTrigger = null
  }
}

export function dialogReturnTarget(): HTMLElement | null {
  const active = document.activeElement
  if (active instanceof HTMLElement && !active.matches('body, html, [role="dialog"]')) return active
  return pointerTrigger?.isConnected ? pointerTrigger : null
}
