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
  root.classList.add('theme-revealing')
  try {
    const transition = document.startViewTransition(apply)
    void transition.finished.then(
      () => root.classList.remove('theme-revealing'),
      () => root.classList.remove('theme-revealing'),
    )
  } catch {
    root.classList.remove('theme-revealing')
    apply()
  }
}
