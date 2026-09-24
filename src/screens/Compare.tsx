import { useState } from 'react'
import type { MonthKey, PockitData } from '../types'
import { beforeWaypointPlan, currentMonth, money, monthLabel, shiftMonth } from '../lib/finance'
import {
  budgetComparison,
  categoryComparison,
  comparisonFindings,
  comparisonCoverage,
  difference,
  merchantDrivers,
  monthSnapshot,
  parseMonthInput,
  transactionsBehind,
} from '../lib/compare'
import { Icon } from '../components/UI'

type View = 'overview' | 'categories' | 'trend' | 'plan'
const choices: { id: View; title: string; detail: string; icon: string }[] = [
  { id: 'overview', title: 'Whole picture', detail: 'Months side by side', icon: 'Columns3' },
  { id: 'categories', title: 'Categories', detail: 'Where it changed', icon: 'ChartPie' },
  { id: 'trend', title: 'Trend', detail: 'The longer view', icon: 'TrendingUp' },
  { id: 'plan', title: 'Plan vs actual', detail: 'Allocation check', icon: 'Target' },
]

function Change({ before, after, currency }: { before: number; after: number; currency: 'CAD' }) {
  const delta = difference(before, after)
  if (delta.amount === 0) return <span className="compare-change flat">No change</span>
  return (
    <span className={`compare-change ${delta.amount > 0 ? 'up' : 'down'}`}>
      <Icon name={delta.amount > 0 ? 'TrendingUp' : 'TrendingDown'} size={14} />
      {delta.amount > 0 ? '+' : '−'}
      {money(Math.abs(delta.amount), currency)}
      {delta.percent === null ? ' · new' : ` · ${Math.abs(delta.percent).toFixed(0)}%`}
    </span>
  )
}

export function CompareScreen({ data, month }: { data: PockitData; month: MonthKey }) {
  const [months, setMonths] = useState<MonthKey[]>([shiftMonth(month, -1), month])
  const [view, setView] = useState<View>('overview')
  const [notice, setNotice] = useState('')
  const [group, setGroup] = useState('All categories')
  const [sort, setSort] = useState<'largest' | 'change' | 'name'>('largest')
  const [showEmpty, setShowEmpty] = useState(false)
  const [span, setSpan] = useState(6)
  const [selectedTrend, setSelectedTrend] = useState<MonthKey | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sameDays, setSameDays] = useState(true)
  const currency = data.settings.currency
  const throughDay = sameDays && months.includes(currentMonth()) ? new Date().getDate() : undefined
  const snapshots = months.map((key) => monthSnapshot(data, key, throughDay))
  const first = snapshots[0]
  const last = snapshots.at(-1)!
  const delta = difference(first.spent, last.spent)
  const partial = months.some((key) => key >= currentMonth())
  const rows = categoryComparison(data, snapshots, showEmpty)
  const strongest = [...rows].sort(
    (a, b) => Math.abs(b.values.at(-1)! - b.values[0]) - Math.abs(a.values.at(-1)! - a.values[0]),
  )[0]
  const drivers = strongest
    ? merchantDrivers(data, strongest.id, first.month, last.month, throughDay).slice(0, 3)
    : []
  const coverageWarning = comparisonCoverage(first, last)
  const groups = [
    'All categories',
    ...new Set([...data.categories.map((category) => category.group), 'Other']),
  ]
  const visibleRows = rows
    .filter((row) => group === 'All categories' || row.group === group)
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'change'
          ? Math.abs(b.values.at(-1)! - b.values[0]) - Math.abs(a.values.at(-1)! - a.values[0])
          : b.values.reduce((n, value) => n + value, 0) -
            a.values.reduce((n, value) => n + value, 0),
    )
  const visibleTotals = months.map((_, index) =>
    visibleRows.reduce((total, row) => total + row.values[index], 0),
  )
  const findings = view === 'overview' ? comparisonFindings(data, first, last) : []
  const maxSpend = Math.max(1, ...snapshots.map((snapshot) => snapshot.spent))
  const trendMonths = Array.from({ length: span }, (_, index) =>
    shiftMonth(last.month, index - span + 1),
  )
  const trend = trendMonths.map((key) => monthSnapshot(data, key))
  const inspectedTrend = trend.find((snapshot) => snapshot.month === selectedTrend)
  const trendMax = Math.max(1, ...trend.map((snapshot) => snapshot.spent))
  const plan =
    view === 'plan' ? budgetComparison(data, last.month).sort((a, b) => b.spent - a.spent) : []
  const isHistoricalUnplanned = (key: MonthKey) =>
    beforeWaypointPlan(data, key) &&
    !data.categories.some((category) => !category.archived && category.starts <= key)
  const historicalUnplanned = isHistoricalUnplanned(last.month)
  const planned = plan.reduce((sum, row) => sum + row.planned, 0)
  const fullPlanSpent = monthSnapshot(data, last.month).spent
  const selectedRow = rows.find((row) => row.id === selectedCategory)
  const baselineTransactions = selectedCategory
    ? transactionsBehind(data, selectedCategory, first.month, throughDay)
    : []
  const currentTransactions = selectedCategory
    ? transactionsBehind(data, selectedCategory, last.month, throughDay)
    : []

  function changeMonth(index: number, value: string) {
    const chosen = parseMonthInput(value)
    if (!chosen) {
      setNotice('Choose a valid month.')
      return
    }
    if (months.some((key, i) => i !== index && key === chosen)) {
      setNotice('Choose a different month for each column.')
      return
    }
    setMonths((current) => current.map((key, i) => (i === index ? chosen : key)))
    setNotice('')
  }

  function addMonth() {
    let candidate = shiftMonth(months[0], -1)
    let prepend = true
    while (months.includes(candidate)) candidate = shiftMonth(candidate, -1)
    if (!parseMonthInput(candidate)) {
      candidate = shiftMonth(months.at(-1)!, 1)
      prepend = false
      while (months.includes(candidate)) candidate = shiftMonth(candidate, 1)
    }
    if (!parseMonthInput(candidate)) {
      setNotice('No more months are available to add.')
      return
    }
    setMonths(prepend ? [candidate, ...months] : [...months, candidate])
    setNotice('')
  }

  return (
    <div className="screen-stack compare-screen">
      <section className="compare-intro">
        <div>
          <span className="eyebrow">A CLOSER LOOK</span>
          <h2>See what changed. Know why.</h2>
          <p>
            Pick the months that matter to you. Every number comes from the transactions you
            entered.
          </p>
        </div>
        <div className="compare-intro-mark" aria-hidden="true">
          <Icon name="GitCompareArrows" size={36} />
        </div>
      </section>

      <div className="compare-views" role="tablist" aria-label="Comparison views">
        {choices.map((choice) => (
          <button
            key={choice.id}
            role="tab"
            aria-selected={view === choice.id}
            className={view === choice.id ? 'active' : ''}
            onClick={() => setView(choice.id)}
          >
            <Icon name={choice.icon} size={19} />
            <span>
              <strong>{choice.title}</strong>
              <small>{choice.detail}</small>
            </span>
          </button>
        ))}
      </div>

      <section className="panel compare-selector">
        <div className="compare-section-top">
          <div>
            <h3>Choose your months</h3>
            <p>Read left to right. The first month is your baseline.</p>
          </div>
          {months.length < 4 && (
            <button className="compare-add" onClick={addMonth}>
              <Icon name="Plus" size={16} /> Add month
            </button>
          )}
        </div>
        <div className="compare-month-grid">
          {months.map((key, index) => (
            <div className="compare-month-control" key={`${index}-${key}`}>
              <label htmlFor={`compare-month-${index}`}>
                {index === 0 ? 'BASELINE' : `MONTH ${index + 1}`}
              </label>
              <div>
                <input
                  id={`compare-month-${index}`}
                  type="month"
                  min="1000-01"
                  value={key}
                  onChange={(event) => changeMonth(index, event.target.value)}
                />
                {months.length > 2 && (
                  <button
                    aria-label={`Remove ${monthLabel(key)}`}
                    title="Remove month"
                    onClick={() => setMonths(months.filter((_, i) => i !== index))}
                  >
                    <Icon name="X" size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {months.includes(currentMonth()) && (
          <label className="compare-same-days">
            <input
              type="checkbox"
              checked={sameDays}
              onChange={(event) => setSameDays(event.target.checked)}
            />{' '}
            Compare through the same day of each month{' '}
            <small>
              For a month still in progress, compare day 1 through day {new Date().getDate()}.
            </small>
          </label>
        )}
        {notice && (
          <p className="compare-notice" role="alert">
            {notice}
          </p>
        )}
      </section>

      {partial && (
        <div className="compare-caveat">
          <Icon name="Info" size={18} /> Current or future months may be incomplete. A lower total
          can simply mean transactions have not been entered yet.
        </div>
      )}
      {coverageWarning && (
        <div className="compare-caveat coverage-warning" role="status">
          <Icon name="Info" size={18} /> {coverageWarning}
        </div>
      )}

      {view === 'overview' && (
        <>
          <section className="panel compare-overview">
            <div className="compare-section-top">
              <div>
                <h3>Expenses, side by side</h3>
                <p>Only expense transactions count. Transfers stay out.</p>
              </div>
            </div>
            <div
              className="compare-overview-grid"
              style={{ gridTemplateColumns: `repeat(${months.length}, minmax(180px, 1fr))` }}
            >
              {snapshots.map((snapshot, index) => (
                <div className="compare-overview-column" key={snapshot.month}>
                  <span className="compare-column-index">
                    {String(index + 1).padStart(2, '0')} / {monthLabel(snapshot.month)}
                  </span>
                  <span className="compare-metric-label">TOTAL SPENT</span>
                  <strong className="compare-main-number">{money(snapshot.spent, currency)}</strong>
                  <div className="compare-bar-track">
                    <div style={{ width: `${(snapshot.spent / maxSpend) * 100}%` }} />
                  </div>
                  <div className="compare-detail-row">
                    <span>Expense entries</span>
                    <strong>{snapshot.expenseCount}</strong>
                  </div>
                  <div className="compare-detail-row">
                    <span>Received so far</span>
                    <strong>{money(snapshot.recordedIncome, currency)}</strong>
                  </div>
                  <div className="compare-detail-row">
                    <span>
                      {isHistoricalUnplanned(snapshot.month)
                        ? 'Recorded net cash flow*'
                        : 'Monthly plan after spending*'}
                    </span>
                    <strong>
                      {money(
                        (isHistoricalUnplanned(snapshot.month)
                          ? snapshot.recordedIncome
                          : snapshot.expectedIncome) - snapshot.spent,
                        currency,
                      )}
                    </strong>
                  </div>
                  {index > 0 && (
                    <div className="compare-card-delta">
                      <span>Spending vs baseline</span>
                      <Change before={first.spent} after={snapshot.spent} currency={currency} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="compare-footnote">
              * Planned income comes from your pay setup. Months before the Waypoint budget starts
              use only recorded income and spending. These figures are not account balances.
            </p>
          </section>
          <section className="compare-callout">
            <div className="compare-callout-icon">
              <Icon name={delta.amount > 0 ? 'TrendingUp' : 'TrendingDown'} size={23} />
            </div>
            <div>
              <span>FIRST TO LAST MONTH</span>
              <h3>
                {first.expenseCount && last.expenseCount
                  ? delta.amount === 0
                    ? 'Spending held steady.'
                    : `Spending ${delta.amount > 0 ? 'rose' : 'fell'} by ${money(Math.abs(delta.amount), currency)}.`
                  : 'Add expenses in both months to compare.'}
              </h3>
              <p>
                {first.expenseCount && last.expenseCount
                  ? `${monthLabel(first.month)} to ${monthLabel(last.month)}${delta.percent === null ? ' · new spending' : ` · ${Math.abs(delta.percent).toFixed(0)}% ${delta.amount > 0 ? 'higher' : 'lower'}`}`
                  : 'You can choose any two months above.'}
              </p>
            </div>
          </section>
          <section className="panel compare-findings">
            <div className="compare-section-top">
              <div>
                <h3>What stands out</h3>
                <p>Clues from your entries, with no AI or bank connection.</p>
              </div>
            </div>
            <div className="compare-finding-grid">
              {findings.length ? (
                findings.map((finding) => (
                  <div className={`compare-finding ${finding.kind}`} key={finding.title}>
                    <Icon name={finding.kind === 'good' ? 'TrendingDown' : 'Info'} size={19} />
                    <div>
                      <strong>{finding.title}</strong>
                      <p>{finding.text}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="compare-empty">
                  Add expense transactions in both selected months to see category insights.
                </p>
              )}
            </div>
          </section>
          {strongest && drivers.length > 0 && (
            <section className="panel compare-drivers" aria-label="What drove the change">
              <div className="compare-section-top">
                <div>
                  <h3>What drove {strongest.name}?</h3>
                  <p>
                    Changes by payee from {monthLabel(first.month)} to {monthLabel(last.month)}
                    {throughDay ? `, through day ${throughDay}` : ''}.
                  </p>
                </div>
                <button
                  className="secondary-button compact"
                  onClick={() => {
                    setView('categories')
                    setSelectedCategory(strongest.id)
                  }}
                >
                  See transactions <Icon name="ArrowRight" size={16} />
                </button>
              </div>
              {drivers.map((driver) => (
                <div className="driver-row" key={driver.payee}>
                  <Icon
                    name={
                      driver.kind === 'new'
                        ? 'Plus'
                        : driver.kind === 'absent'
                          ? 'TrendingDown'
                          : 'Repeat2'
                    }
                    size={18}
                  />
                  <span>
                    <strong>{driver.payee}</strong>
                    <small>
                      {driver.kind === 'new'
                        ? 'New in the last month'
                        : driver.kind === 'absent'
                          ? 'Not recorded in the last month'
                          : 'Recorded in both months'}
                    </small>
                  </span>
                  <strong className={driver.change > 0 ? 'negative' : 'positive'}>
                    {driver.change > 0 ? '+' : '−'}
                    {money(Math.abs(driver.change))}
                  </strong>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {view === 'categories' && (
        <section className="panel compare-category-panel">
          <div className="compare-section-top">
            <div>
              <h3>Category by category</h3>
              <p>Scan the same category across every selected month.</p>
            </div>
          </div>
          <div className="compare-filter-row">
            <label>
              Group{' '}
              <select value={group} onChange={(event) => setGroup(event.target.value)}>
                {groups.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Sort{' '}
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="largest">Most spent</option>
                <option value="change">Biggest change</option>
                <option value="name">Name</option>
              </select>
            </label>
            <label className="compare-show-empty">
              <input
                type="checkbox"
                checked={showEmpty}
                onChange={(event) => setShowEmpty(event.target.checked)}
              />
              Include $0 categories
            </label>
          </div>
          <div className="compare-table-scroll">
            <table className="compare-table" style={{ minWidth: 285 + months.length * 125 }}>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  {months.map((key) => (
                    <th scope="col" key={key}>
                      {monthLabel(key)}
                    </th>
                  ))}
                  <th scope="col">First → last</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <button
                        className="compare-category-name compare-category-button"
                        onClick={() => setSelectedCategory(row.id)}
                        aria-label={`Explain ${row.name}`}
                      >
                        <i style={{ background: row.color }} />
                        <Icon name={row.icon} size={17} />
                        <span>{row.name}</span>
                      </button>
                    </th>
                    {row.values.map((value, index) => (
                      <td key={months[index]}>{money(value, currency)}</td>
                    ))}
                    <td>
                      <Change
                        before={row.values[0]}
                        after={row.values.at(-1)!}
                        currency={currency}
                      />
                    </td>
                  </tr>
                ))}
                {!visibleRows.length && (
                  <tr>
                    <td colSpan={months.length + 2} className="compare-empty">
                      No spending in this group for these months.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">
                    {group === 'All categories' ? 'Total expenses' : `${group} total`}
                  </th>
                  {visibleTotals.map((total, index) => (
                    <td key={months[index]}>{money(total, currency)}</td>
                  ))}
                  <td>
                    <Change
                      before={visibleTotals[0]}
                      after={visibleTotals.at(-1)!}
                      currency={currency}
                    />
                  </td>
                </tr>
                {group !== 'All categories' && (
                  <tr>
                    <th scope="row">All expenses</th>
                    {snapshots.map((snapshot) => (
                      <td key={snapshot.month}>{money(snapshot.spent, currency)}</td>
                    ))}
                    <td>
                      <Change before={first.spent} after={last.spent} currency={currency} />
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
          <p className="compare-footnote">
            Swipe the table sideways on a phone. Uncategorized includes expenses with no category or
            a removed category. Tap a category to see the entries behind its change.
          </p>
          {selectedRow && (
            <div className="compare-drilldown" aria-live="polite">
              <div className="compare-section-top">
                <div>
                  <h3>Why {selectedRow.name} changed</h3>
                  <p>
                    {monthLabel(first.month)} to {monthLabel(last.month)} · expense entries only
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Close category detail"
                  onClick={() => setSelectedCategory(null)}
                >
                  <Icon name="X" size={18} />
                </button>
              </div>
              <div className="compare-detail-columns">
                {[
                  { month: first.month, entries: baselineTransactions },
                  { month: last.month, entries: currentTransactions },
                ].map(({ month: key, entries }) => (
                  <div key={key}>
                    <strong>
                      {monthLabel(key)} ·{' '}
                      {money(
                        entries.reduce((sum, entry) => sum + entry.amount, 0),
                        currency,
                      )}
                    </strong>
                    {entries.length ? (
                      entries.map((transaction) => (
                        <div className="compare-transaction" key={transaction.id}>
                          <span>
                            {transaction.payee}
                            <small>{transaction.date}</small>
                          </span>
                          <strong>{money(transaction.amount, currency)}</strong>
                        </div>
                      ))
                    ) : (
                      <p>No expenses recorded.</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="compare-footnote">
                Difference: {money(selectedRow.values.at(-1)! - selectedRow.values[0], currency)}. A
                large purchase or an unfinished month can explain much of a change; review the
                entries before adjusting your budget.
              </p>
            </div>
          )}
        </section>
      )}

      {view === 'trend' && (
        <section className="panel compare-trend-panel">
          <div className="compare-section-top">
            <div>
              <h3>The longer view</h3>
              <p>Monthly expense totals ending in {monthLabel(last.month)}.</p>
            </div>
            <div className="compare-span" aria-label="Trend length">
              {[3, 6, 12].map((count) => (
                <button
                  key={count}
                  className={span === count ? 'active' : ''}
                  onClick={() => setSpan(count)}
                >
                  {count}m
                </button>
              ))}
            </div>
          </div>
          <div className="compare-trend-summary">
            <span>
              Total across these months{' '}
              <strong>
                {money(
                  trend.reduce((sum, snapshot) => sum + snapshot.spent, 0),
                  currency,
                )}
              </strong>
            </span>
            <span>
              Average per month{' '}
              <strong>
                {money(trend.reduce((sum, snapshot) => sum + snapshot.spent, 0) / span, currency)}
              </strong>
            </span>
          </div>
          <div
            className="compare-trend-chart"
            role="group"
            aria-label={`Spending over ${span} months ending ${monthLabel(last.month)}`}
          >
            {trend.map((snapshot) => (
              <button
                className={`compare-trend-item ${selectedTrend === snapshot.month ? 'active' : ''}`}
                key={snapshot.month}
                onClick={() => setSelectedTrend(snapshot.month)}
                aria-label={`Inspect ${monthLabel(snapshot.month)} spending`}
              >
                <strong>{money(snapshot.spent, currency, true)}</strong>
                <div className="compare-trend-track">
                  <div style={{ height: `${(snapshot.spent / trendMax) * 100}%` }} />
                </div>
                <span>
                  {new Date(
                    Number(snapshot.month.slice(0, 4)),
                    Number(snapshot.month.slice(5)) - 1,
                    1,
                  ).toLocaleDateString('en-CA', {
                    month: 'short',
                    year: span === 12 ? '2-digit' : undefined,
                  })}
                </span>
              </button>
            ))}
          </div>
          {inspectedTrend && (
            <div className="compare-trend-detail" role="status">
              <strong>{monthLabel(inspectedTrend.month)}</strong>
              <span>
                {money(inspectedTrend.spent, currency)} across {inspectedTrend.expenseCount}{' '}
                {inspectedTrend.expenseCount === 1 ? 'expense' : 'expenses'}.
              </span>
            </div>
          )}
          <p className="compare-footnote">
            A $0 bar means no expenses were entered for that month. The average includes those
            months.
          </p>
        </section>
      )}

      {view === 'plan' && (
        <section className="panel compare-plan-panel">
          <div className="compare-section-top">
            <div>
              <h3>Plan vs actual</h3>
              <p>
                For {monthLabel(last.month)}.{' '}
                {historicalUnplanned
                  ? 'Actual spending is available, but no Waypoint budget plan was exported for this month.'
                  : 'See which allocations need a look.'}
              </p>
            </div>
          </div>
          {!historicalUnplanned && (
            <div className="compare-plan-summary">
              <div>
                <span>ALLOCATED</span>
                <strong>{money(planned, currency)}</strong>
              </div>
              <div>
                <span>SPENT</span>
                <strong>{money(fullPlanSpent, currency)}</strong>
              </div>
              <div>
                <span>THIS MONTH GAP</span>
                <strong className={fullPlanSpent > planned ? 'compare-negative' : ''}>
                  {money(planned - fullPlanSpent, currency)}
                </strong>
              </div>
            </div>
          )}
          {historicalUnplanned && (
            <p className="soft-note" role="status">
              This ZIP contains transaction history for this month, but no matching monthly budget
              allocations. The amounts below are actual spending only.
            </p>
          )}
          <div className="compare-plan-list">
            {plan.map((row) => (
              <div className="compare-plan-row" key={row.id}>
                <div className="compare-plan-row-top">
                  <span>
                    <i style={{ background: row.color }} />
                    <span>{row.name}</span>
                  </span>
                  <strong>
                    {money(row.spent, currency)}{' '}
                    {!historicalUnplanned && (
                      <small>
                        / {row.planUnavailable ? 'no plan' : money(row.planned, currency)}
                      </small>
                    )}
                  </strong>
                </div>
                {!historicalUnplanned && (
                  <div className="compare-plan-track">
                    <div
                      style={{
                        width: `${row.planUnavailable ? 0 : Math.min(100, row.planned ? (row.spent / row.planned) * 100 : row.spent ? 100 : 0)}%`,
                        background: row.balance < 0 ? 'var(--red)' : row.color,
                      }}
                    />
                  </div>
                )}
                <small
                  className={!row.planUnavailable && row.balance < 0 ? 'compare-negative' : ''}
                >
                  {historicalUnplanned || row.planUnavailable
                    ? 'No historical allocation in the Waypoint ZIP'
                    : row.mode === 'rollover'
                      ? row.balance < 0
                        ? `${money(Math.abs(row.balance), currency)} over available rollover balance`
                        : `${money(row.balance, currency)} available with rollover`
                      : row.planned === 0 && row.spent > 0
                        ? 'Spent without a monthly allocation'
                        : row.balance < 0
                          ? `${money(Math.abs(row.balance), currency)} over allocation`
                          : `${money(row.balance, currency)} left in allocation`}
                </small>
              </div>
            ))}
            {!plan.length && (
              <p className="compare-empty">
                There are no allocations or expenses for this month yet.
              </p>
            )}
          </div>
          {!historicalUnplanned && (
            <p className="compare-footnote">
              Allocations are plans, not transactions. The overall gap compares this month's
              allocations with spending; rollover row balances include earlier months. Uncategorized
              spending has no allocation. Current or future months may be incomplete.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
