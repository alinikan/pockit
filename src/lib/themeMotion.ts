let revealSequence = 0

/** Reveal the newly selected appearance from the control the user touched. */
export function animateThemeChange(apply: () => void, origin?: Element | null) {
  if (
    !document.startViewTransition ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    apply()
    return
  }
  const box = origin?.getBoundingClientRect()
  const x = box ? box.left + box.width / 2 : window.innerWidth / 2
  const y = box ? box.top + box.height / 2 : window.innerHeight / 2
  const radius = Math.ceil(
    Math.max(
      Math.hypot(x, y),
      Math.hypot(window.innerWidth - x, y),
      Math.hypot(x, window.innerHeight - y),
      Math.hypot(window.innerWidth - x, window.innerHeight - y),
    ),
  )
  const root = document.documentElement
  root.style.setProperty('--theme-reveal-x', `${x}px`)
  root.style.setProperty('--theme-reveal-y', `${y}px`)
  root.style.setProperty('--theme-reveal-radius', `${radius}px`)
  const sequence = ++revealSequence
  root.classList.add('theme-revealing')
  let fallback: number | undefined
  const cleanUp = () => {
    if (fallback !== undefined) window.clearTimeout(fallback)
    if (sequence === revealSequence) root.classList.remove('theme-revealing')
  }
  try {
    const transition = document.startViewTransition(apply)
    fallback = window.setTimeout(cleanUp, 900)
    void transition.finished.then(cleanUp, cleanUp)
  } catch {
    cleanUp()
    apply()
  }
}
