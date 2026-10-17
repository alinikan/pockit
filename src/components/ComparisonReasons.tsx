import type { MonthKey, PockitData } from '../types'
import { money } from '../lib/finance'
import { monthCoverage } from '../lib/experience'
export function ComparisonReasons({
  data,
  before,
  after,
}: {
  data: PockitData
  before: MonthKey
  after: MonthKey
}) {
  const collect = (month: MonthKey) => {
    const entries = data.transactions.filter(
      (item) => item.date.startsWith(month) && item.type === 'expense',
    )
    const purchases = entries.filter((item) => !item.refund)
    const refunds = entries
      .filter((item) => item.refund)
      .reduce((sum, item) => sum + item.amount, 0)
    const spent = purchases.reduce((sum, item) => sum + item.amount, 0)
    return {
      entries,
      purchases,
      refunds,
      spent,
      average: purchases.length ? spent / purchases.length : 0,
    }
  }
  const a = collect(before),
    b = collect(after),
    first = monthCoverage(data, before),
    last = monthCoverage(data, after)
  const countEffect = (b.purchases.length - a.purchases.length) * a.average,
    sizeEffect = b.purchases.length * (b.average - a.average),
    refundEffect = a.refunds - b.refunds
  const big = [...b.purchases].sort((x, y) => y.amount - x.amount)[0]
  return (
    <details className="panel optional-tool">
      <summary>What changed behind the totals?</summary>
      <p className="goal-form-note">
        {before}: {first.label}. {after}: {last.label}.
      </p>
      {!first.canCompare || !last.canCompare ? (
        <p className="soft-note">
          One month has no recorded purchases and is not confirmed complete. Pockit cannot tell
          whether spending fell or entries are missing.
        </p>
      ) : (
        <>
          <div className="number-explanation">
            <span>
              Number of purchases
              <strong>
                {a.purchases.length} → {b.purchases.length}
              </strong>
            </span>
            <span>
              Average purchase size
              <strong>
                {money(a.average)} → {money(b.average)}
              </strong>
            </span>
            <span>
              Change from purchase count
              <strong className={countEffect > 0 ? 'warning-text' : 'positive'}>
                {money(countEffect)}
              </strong>
            </span>
            <span>
              Change from average size
              <strong className={sizeEffect > 0 ? 'warning-text' : 'positive'}>
                {money(sizeEffect)}
              </strong>
            </span>
            <span>
              Change from refunds
              <strong className={refundEffect > 0 ? 'warning-text' : 'positive'}>
                {money(refundEffect)}
              </strong>
            </span>
          </div>
          <p className="goal-form-note">
            Count effect uses the first month’s average purchase. Size effect uses the second
            month’s purchase count. Together with refunds, they explain the change in recorded net
            expenses. This describes entries, not the reasons you bought things.
          </p>
          {big && (
            <p className="soft-note">
              Largest purchase in the second month: {big.payee} · {money(big.amount)} on {big.date}.
              {big.projectId ? ' It is linked to a project.' : ''} Check large or one-time purchases
              and bills near month boundaries before changing regular limits.
            </p>
          )}
        </>
      )}
    </details>
  )
}
