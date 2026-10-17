import type { MonthKey, PockitData } from '../types'
import { monthLabel, todayISO } from '../lib/finance'
import { ageInDays } from '../lib/experience'
import { MonthReview } from './PlanningExtras'
export function PulseReview({
  data,
  month,
  update,
  setTab,
}: {
  data: PockitData
  month: MonthKey
  update: (recipe: (data: PockitData) => PockitData) => void
  setTab: (tab: 'Activity' | 'Budget' | 'Calendar' | 'More') => void
}) {
  const steps =
    data.settings.pulseProgress?.month === month ? data.settings.pulseProgress.steps : []
  const unreviewed = data.transactions.filter((item) => item.reviewed === false).length
  const stale = (data.accounts || []).filter(
    (item) => !item.archived && (ageInDays(item.reconciledAt?.slice(0, 10) || item.asOf) || 0) > 7,
  ).length
  const items = [
    [
      'activity',
      'Review activity',
      unreviewed
        ? `${unreviewed} imported entries need review`
        : 'Check purchases, refunds and missing entries',
      'Activity',
    ],
    [
      'accounts',
      'Check account balances',
      stale
        ? `${stale} balances were last checked over a week ago`
        : 'Compare the amounts with your own account records',
      'More',
    ],
    ['bills', 'Check upcoming bills', 'Review dates and subscription decisions', 'Calendar'],
    ['plan', 'Adjust the plan', 'Check overspending and your next priorities', 'Budget'],
  ] as const
  return (
    <div className="pulse-review">
      <p className="goal-form-note">
        {steps.length} of 4 steps checked · {monthLabel(month)}. Your progress stays saved when you
        leave this tab.
      </p>
      {items.map(([id, label, detail, tab]) => (
        <div className="pulse-review-step" key={id}>
          <label>
            <input
              type="checkbox"
              checked={steps.includes(id)}
              onChange={(event) =>
                update((current) => {
                  const values =
                    current.settings.pulseProgress?.month === month
                      ? current.settings.pulseProgress.steps
                      : []
                  return {
                    ...current,
                    settings: {
                      ...current.settings,
                      pulseProgress: {
                        month,
                        steps: event.target.checked
                          ? [...new Set([...values, id])]
                          : values.filter((value) => value !== id),
                      },
                    },
                  }
                })
              }
            />
            <span>
              {label}
              <small>{detail}</small>
            </span>
          </label>
          <button className="text-button" onClick={() => setTab(tab)}>
            Open
          </button>
        </div>
      ))}
      <MonthReview data={data} month={month} update={update} />
      <button
        className="primary-button"
        disabled={steps.length < 4}
        onClick={() =>
          update((current) => ({
            ...current,
            settings: { ...current.settings, lastPulseAt: todayISO(), pulseProgress: undefined },
          }))
        }
      >
        Done for now
      </button>
    </div>
  )
}
