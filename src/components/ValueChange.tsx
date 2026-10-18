import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Keeps the exact final amount readable; emphasizes changes without counting through fake amounts. */
export function ValueChange({ value, children }: { value: number | string; children: ReactNode }) {
  const previous = useRef(value)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    setVersion((current) => current + 1)
  }, [value])
  return (
    <span className={version ? 'value-change' : undefined} key={version}>
      {children}
    </span>
  )
}
