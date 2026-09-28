import { money } from '../lib/finance'
import { Icon, Progress } from './UI'

interface BudgetPlanCardProps {
  expectedIncome: number
  recordedIncome: number
  allocated: number
  currency: 'CAD'
}

export function BudgetPlanCard({
  expectedIncome,
  recordedIncome,
  allocated,
  currency,
}: BudgetPlanCardProps) {
  const difference = expectedIncome - allocated
  const overPlanned = difference < -0.005
  const allocationPercent = expectedIncome > 0 ? (allocated / expectedIncome) * 100 : 0

  return (
    <section className="budget-overview" aria-label="Monthly income and plan">
      <div className="budget-plan-topline">
        <div>
          <span className="eyebrow">EXPECTED INCOME</span>
          <h2>
            {money(expectedIncome, currency, true)} <span>planned for this month</span>
          </h2>
        </div>
        <span className="budget-plan-icon" aria-hidden="true">
          <Icon name="Wallet" size={22} />
        </span>
      </div>

      <div className="budget-plan-allocation">
        <div className="budget-info-stat">
          <span>
            Allocated <strong>{money(allocated, currency, true)}</strong> of{' '}
            {money(expectedIncome, currency, true)}
          </span>
          <strong className={overPlanned ? 'negative' : ''}>
            {expectedIncome > 0 ? `${Math.round(allocationPercent)}%` : '—'}
          </strong>
        </div>
        <div className="budget-plan-progress-row">
          <Progress value={allocationPercent} color={overPlanned ? 'var(--red)' : 'var(--lime)'} />
          <strong className={overPlanned ? 'negative' : ''}>
            {money(Math.abs(difference), currency, true)}{' '}
            {overPlanned ? 'over plan' : 'left to plan'}
          </strong>
        </div>
      </div>

      <details className="budget-income-details">
        <summary>
          <span className="budget-actual-income">
            <Icon name="ArrowDownLeft" size={17} />
            Recorded income <strong>{money(recordedIncome, currency, true)}</strong>
          </span>
          <Icon name="ChevronDown" size={17} />
        </summary>
        <p>
          This is the pay you entered in Activity. If a paycheque is higher or lower than expected,
          record the real amount there. Your category plans stay as set until you change them.
        </p>
      </details>
    </section>
  )
}
