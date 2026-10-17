import { useId, useState, type PointerEvent } from 'react'
import { money, shortDate } from '../lib/finance'
export function TimelineChart({
  points,
  label,
}: {
  points: { date: string; value: number }[]
  label: string
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const id = useId().replace(/:/g, '')
  if (!points.length) return null
  const low = Math.min(...points.map((p) => p.value), 0),
    high = Math.max(...points.map((p) => p.value), 1),
    range = Math.max(1, high - low)
  const xy = (i: number) => [
    12 + (i / Math.max(1, points.length - 1)) * 336,
    14 + ((high - points[i].value) / range) * 130,
  ]
  const line = points.map((_, i) => xy(i).join(',')).join(' ')
  const index = selected === null ? null : Math.min(selected, points.length - 1)
  const inspect = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setSelected(
      Math.max(
        0,
        Math.min(
          points.length - 1,
          Math.round(
            ((((event.clientX - rect.left) / rect.width) * 360 - 12) / 336) * (points.length - 1),
          ),
        ),
      ),
    )
  }
  return (
    <div className="timeline-chart">
      <div className="timeline-readout" aria-live="polite">
        {index === null
          ? 'Hold and drag to inspect each day'
          : `${shortDate(points[index].date)} · ${money(points[index].value)}`}
      </div>
      <svg
        viewBox="0 0 360 170"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={points.length - 1}
        aria-valuenow={index ?? 0}
        aria-valuetext={
          index === null
            ? 'Hold and drag or use arrow keys'
            : `${points[index].date}: ${money(points[index].value)}`
        }
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          inspect(event)
        }}
        onPointerMove={(event) => {
          if (event.buttons) inspect(event)
        }}
        onPointerUp={() => setSelected(null)}
        onPointerCancel={() => setSelected(null)}
        onLostPointerCapture={() => setSelected(null)}
        onBlur={() => setSelected(null)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault()
            setSelected((i) =>
              Math.max(
                0,
                Math.min(points.length - 1, (i ?? 0) + (event.key === 'ArrowRight' ? 1 : -1)),
              ),
            )
          }
          if (event.key === 'Escape') setSelected(null)
        }}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="currentColor" stopOpacity=".2" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line
          x1="12"
          y1={14 + (high / range) * 130}
          x2="348"
          y2={14 + (high / range) * 130}
          stroke="var(--line)"
          strokeDasharray="3 4"
        />
        <polygon points={`12,150 ${line} 348,150`} fill={`url(#${id})`} />
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeDasharray="5 4"
        />
        {index !== null && (
          <g>
            <line
              x1={xy(index)[0]}
              x2={xy(index)[0]}
              y1="10"
              y2="150"
              stroke="var(--muted)"
              strokeDasharray="3 4"
            />
            <circle
              cx={xy(index)[0]}
              cy={xy(index)[1]}
              r="5"
              fill="currentColor"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
      <div className="timeline-axis">
        <span>{shortDate(points[0].date)}</span>
        <span>{shortDate(points[Math.floor(points.length / 2)].date)}</span>
        <span>{shortDate(points.at(-1)!.date)}</span>
      </div>
    </div>
  )
}
