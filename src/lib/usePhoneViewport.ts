import { useEffect, useState } from 'react'

/** Keyboard-aware space for phone overlays, including landscape and iOS standalone. */
export function usePhoneViewport() {
  const measure = () => {
    const visual = window.visualViewport
    const phone =
      window.innerWidth <= 760 ||
      (window.innerWidth <= 1024 &&
        window.matchMedia?.('(hover: none) and (pointer: coarse)').matches)
    return visual && phone && Math.abs(visual.scale - 1) < 0.01
      ? { height: visual.height, top: visual.offsetTop }
      : null
  }
  const [viewport, setViewport] = useState(measure)
  useEffect(() => {
    const visual = window.visualViewport
    const update = () => setViewport(measure())
    visual?.addEventListener('resize', update)
    visual?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      visual?.removeEventListener('resize', update)
      visual?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return viewport
}
