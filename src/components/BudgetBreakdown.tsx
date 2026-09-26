import { useState, type CSSProperties } from 'react'
import type { budgetChart } from '../lib/budgetChart'
import { budgetShareLabel } from '../lib/budgetChart'
import { money } from '../lib/finance'
import { Empty, Icon, SectionHead } from './UI'

const radius = 85
const circumference = 2 * Math.PI * radius

export function BudgetBreakdown({
  chart,
  income,
  currency,
}: {
  chart: ReturnType<typeof budgetChart>
  income: number
  currency: 'CAD'
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const focused = chart.slices.find((slice) => slice.category.id === selectedId)
  const select = (id: string) => setSelectedId(focused?.category.id === id ? null : id)
  const unallocated = income - chart.total

  return (
    <section className="panel budget-breakdown-panel" aria-label="Budget Breakdown">
      <SectionHead
        title="Budget Breakdown"
        help="Each slice is one category's share of your total planned category amount. Tap a slice or row to focus it. The percentage is a share of the category budget, not of your income."
      />
      <p className="budget-breakdown-hint">Tap a slice or category to highlight it.</p>
      {chart.slices.length ? (
        <>
          <div className="budget-donut-stage">
            <svg
              className="budget-donut-chart"
              viewBox="0 0 240 240"
              role="group"
              aria-label="Budget category chart"
            >
              <circle className="budget-donut-track" cx="120" cy="120" r={radius} />
              {chart.slices.map((slice) => {
                const selected = focused?.category.id === slice.category.id
                return (
                  <circle
                    key={slice.category.id}
                    className={`budget-donut-segment${selected ? ' selected' : ''}${focused && !selected ? ' dimmed' : ''}`}
                    cx="120"
                    cy="120"
                    r={radius}
                    stroke={slice.category.color}
                    strokeDasharray={`${(slice.percent / 100) * circumference} ${circumference}`}
                    strokeDashoffset={-(slice.startPercent / 100) * circumference}
                    transform="rotate(-90 120 120)"
                    role="button"
                    tabIndex={0}
                    aria-label={`Show ${slice.category.name}: ${money(slice.amount, currency)}, ${budgetShareLabel(slice.percent)} of total budget`}
                    aria-pressed={selected}
                    onClick={() => select(slice.category.id)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      select(slice.category.id)
                    }}
                  />
                )
              })}
            </svg>
            <div className="budget-donut-center" aria-live="polite">
              {focused ? (
                <>
                  <i style={{ background: focused.category.color }} />
                  <span className="budget-donut-name">{focused.category.name}</span>
                  <strong>{money(focused.amount, currency)}</strong>
                  <small>{budgetShareLabel(focused.percent)} of total budget</small>
                </>
              ) : (
                <>
                  <span className="budget-donut-overline">TOTAL BUDGET</span>
                  <strong>{money(chart.total, currency)}</strong>
                  <small className={unallocated < 0 ? 'negative' : ''}>
                    {unallocated < 0
                      ? `${money(Math.abs(unallocated), currency)} over expected pay`
                      : `${money(unallocated, currency)} not yet planned`}
                  </small>
                </>
              )}
            </div>
          </div>
          <div className="budget-breakdown-list" aria-label="Budget categories">
            {chart.slices.map((slice) => {
              const selected = focused?.category.id === slice.category.id
              return (
                <button
                  className={`budget-breakdown-row${selected ? ' active' : ''}`}
                  key={slice.category.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Highlight ${slice.category.name}, ${money(slice.amount, currency)}, ${budgetShareLabel(slice.percent)}`}
                  onClick={() => select(slice.category.id)}
                >
                  <span
                    className="budget-breakdown-icon"
                    style={
                      {
                        background: `${slice.category.color}22`,
                        '--category-color': slice.category.color,
                      } as CSSProperties
                    }
                  >
                    <Icon name={slice.category.icon} size={20} />
                  </span>
                  <span className="budget-breakdown-name" title={slice.category.name}>
                    {slice.category.name}
                  </span>
                  <span className="budget-breakdown-value">
                    {selected && (
                      <span className="budget-breakdown-percent">
                        {budgetShareLabel(slice.percent)}
                      </span>
                    )}
                    <strong>{money(slice.amount, currency)}</strong>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <Empty
          icon="ChartPie"
          title="Your chart is ready for a plan"
          text="Add an amount to a category below to see how your monthly budget is divided."
        />
      )}
    </section>
  )
}
