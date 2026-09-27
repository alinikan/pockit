import { useEffect } from 'react'

let locks = 0
let restore: (() => void) | undefined

/** Keep the page underneath an open dialog in the same place, including on iOS. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (locks++ === 0) {
      const body = document.body
      const html = document.documentElement
      const scrollY = window.scrollY
      const previous = {
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
        htmlOverflow: html.style.overflow,
      }
      body.style.position = 'fixed'
      body.style.top = `-${scrollY}px`
      body.style.left = '0'
      body.style.right = '0'
      body.style.width = '100%'
      body.style.overflow = 'hidden'
      html.style.overflow = 'hidden'
      restore = () => {
        body.style.position = previous.position
        body.style.top = previous.top
        body.style.left = previous.left
        body.style.right = previous.right
        body.style.width = previous.width
        body.style.overflow = previous.overflow
        html.style.overflow = previous.htmlOverflow
        if (scrollY) window.scrollTo(0, scrollY)
      }
    }
    return () => {
      locks--
      if (locks === 0) {
        restore?.()
        restore = undefined
      }
    }
  }, [active])
}
