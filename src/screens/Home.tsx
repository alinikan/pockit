import type { MonthKey, PockitData } from '../types'
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  homeSections,
  normalizedHomeOrder,
  reorderHomeSection,
  type HomeSectionId,
} from '../lib/homeLayout'
import {
  billsForMonth,
  beforeWaypointPlan,
  budgetHealth,
  categorySpendingEntries,
  categoryBudget,
  categoryPolicy,
  categoryActiveInMonth,
  categoryDueDates,
  currentMonth,
  money,
  monthLabel,
  rolloverMonth,
  shortDate,
  shiftMonth,
  spendingByCategory,
  todayISO,
} from '../lib/finance'
import { paychequeForecast } from '../lib/payday'
import { unreviewedTransactions } from '../lib/ledger'
import { Empty, Icon, Modal, Progress, SectionHead } from '../components/UI'

export function HomeScreen({
  data,
  month,
  setTab,
  onAddIncome,
  update,
}: {
  data: PockitData
  month: MonthKey
  setTab: (tab: 'Activity' | 'Budget' | 'Calendar' | 'More') => void
  onAddIncome: () => void
  update: (recipe: (value: PockitData) => PockitData) => void
}) {
  const [customizing, setCustomizing] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'on-track' | 'off-track'>('all')
  const [detailCategoryId, setDetailCategoryId] = useState<string | null>(null)
  const homeOrder = normalizedHomeOrder(data.settings.homeOrder)
  const [draftOrder, setDraftOrder] = useState<HomeSectionId[]>(homeOrder)
  const [dragging, setDragging] = useState<HomeSectionId | null>(null)
  const hidden = new Set(data.settings.hiddenHomeSections || [])
  const homeStyle = (id: HomeSectionId) => ({ order: homeOrder.indexOf(id) })
  const isVisible = (id: HomeSectionId) => !hidden.has(id)
  const setHomeOrder = (order: HomeSectionId[]) =>
    update((current) => ({
      ...current,
      settings: { ...current.settings, homeOrder: order },
    }))
  const openCustomization = () => {
    setDraftOrder(homeOrder)
    setCustomizing(true)
  }
  const startDragging = (event: ReactPointerEvent<HTMLButtonElement>, id: HomeSectionId) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(id)
  }
  const dragOver = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragging) return
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-home-section]')?.dataset.homeSection as
      HomeSectionId | undefined
    if (target) setDraftOrder((order) => reorderHomeSection(order, dragging, target))
  }
  const finishDragging = () => {
    if (!dragging) return
    setHomeOrder(draftOrder)
    setDragging(null)
  }
  const cancelDragging = () => {
    setDraftOrder(homeOrder)
    setDragging(null)
  }
  const toggleHomeSection = (id: HomeSectionId) =>
    update((current) => {
      const next = new Set(current.settings.hiddenHomeSections || [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...current, settings: { ...current.settings, hiddenHomeSections: [...next] } }
    })
  const { income, actualIncome, spent, remaining, trouble } = budgetHealth(data, month)
  const historicalUnplanned =
    beforeWaypointPlan(data, month) &&
    !data.categories.some((category) => categoryActiveInMonth(category, month))
  const chartIncome = historicalUnplanned ? actualIncome : actualIncome || income
  const useActualCashFlow = actualIncome > 0
  const spend = spendingByCategory(data.transactions, month)
  const sorted = [...data.categories]
    .filter((c) => categoryBudget(c, month, income) > 0 || spend[c.id])
    .sort((a, b) => (spend[b.id] || 0) - (spend[a.id] || 0))
  const categoryRows = sorted.map((category) => {
    const used = spend[category.id] || 0
    const planned = categoryBudget(category, month, income)
    const active = categoryActiveInMonth(category, month)
    const rollover =
      active && categoryPolicy(category, month).mode === 'rollover'
        ? rolloverMonth(category, data, month)
        : null
    const availableToSpend = rollover ? rollover.carried + rollover.added : planned
    const remaining = rollover ? rollover.available : planned - used
    const hasPlan = active && (planned > 0 || !!rollover?.carried || !!rollover?.added)
    const offTrack = hasPlan ? remaining < -0.005 : used > 0
    const nearLimit =
      hasPlan &&
      !offTrack &&
      remaining > 0.005 &&
      availableToSpend > 0 &&
      used / availableToSpend >= 0.9
    return {
      category,
      used,
      planned,
      rollover,
      availableToSpend,
      remaining,
      hasPlan,
      offTrack,
      nearLimit,
    }
  })
  const offTrackCount = categoryRows.filter((row) => row.offTrack).length
  const filteredCategoryRows = categoryRows.filter((row) =>
    categoryFilter === 'all' ? true : categoryFilter === 'off-track' ? row.offTrack : !row.offTrack,
  )
  const detailRow = categoryRows.find((row) => row.category.id === detailCategoryId)
  const detailEntries = detailRow
    ? categorySpendingEntries(data.transactions, month, detailRow.category.id)
    : []
  const detailMovements = detailRow
    ? data.transactions
        .filter(
          (transaction) =>
            transaction.date.slice(0, 7) === month &&
            transaction.categoryId === detailRow.category.id &&
            transaction.type !== 'expense',
        )
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    : []
  const bills = billsForMonth(data.bills, month)
    .filter((b) => !b.paid && !b.skipped)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
  const plannedDates = categoryDueDates(data, month)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
  const max = Math.max(chartIncome, spent, 1)
  const previous = shiftMonth(month, -1)
  const prevSpent = data.transactions
    .filter((t) => t.date.startsWith(previous) && t.type === 'expense')
    .reduce((n, t) => n + (t.refund ? -t.amount : t.amount), 0)
  const paycheque = paychequeForecast(data, todayISO())
  const reviewCount = unreviewedTransactions(data).length
  const today = todayISO()
  const nextBill = [currentMonth(), shiftMonth(currentMonth(), 1)]
    .flatMap((key) => billsForMonth(data.bills, key))
    .filter((bill) => !bill.paid && !bill.skipped && bill.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const nextPlan = [currentMonth(), shiftMonth(currentMonth(), 1)]
    .flatMap((key) => categoryDueDates(data, key))
    .filter((item) => item.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  const cashAge = paycheque.asOf
    ? Math.max(
        0,
        Math.floor(
          (new Date(`${today}T12:00:00Z`).valueOf() -
            new Date(`${paycheque.asOf}T12:00:00Z`).valueOf()) /
            86400000,
        ),
      )
    : null
  const pulseDue =
    !data.settings.lastPulseAt ||
    (new Date(today).valueOf() - new Date(data.settings.lastPulseAt).valueOf()) / 86400000 >= 7
  return (
    <div className="screen-stack">
      <div className="home-customize-bar" style={{ order: -2 }}>
        <span>Make this space work for you.</span>
        <button className="secondary-button compact" onClick={openCustomization}>
          <Icon name="SlidersHorizontal" size={16} /> Customize Home
        </button>
      </div>
      {historicalUnplanned && (
        <p className="soft-note" role="status" style={{ order: -1 }}>
          This month’s transactions are available, but the Waypoint ZIP had no historical budget
          plan for it. Spending and recorded income come from transactions; budget comparisons start
          in{' '}
          {data.profile.waypointPlanStarts
            ? monthLabel(data.profile.waypointPlanStarts)
            : 'the import month'}
          .
        </p>
      )}
      {isVisible('today') && (
        <section className="pockit-today" aria-label="Pockit Today" style={homeStyle('today')}>
          <div className="today-title">
            <span className="eyebrow">POCKIT TODAY</span>
            <h2>Your next good move.</h2>
            <p>Three useful answers, based on what you have recorded.</p>
          </div>
          <button
            className={`today-card ${reviewCount ? 'attention' : 'good'}`}
            onClick={() => setTab('Activity')}
          >
            <Icon name={reviewCount ? 'ReceiptText' : 'CheckCircle2'} size={23} />
            <span>
              <small>TO REVIEW</small>
              <strong>
                {reviewCount
                  ? `${reviewCount} transaction${reviewCount === 1 ? '' : 's'}`
                  : 'All caught up'}
              </strong>
              <em>{reviewCount ? 'Check imported details' : 'Your activity is reviewed'}</em>
            </span>
            <Icon name="ArrowRight" size={17} />
          </button>
          <button className="today-card due" onClick={() => setTab('Calendar')}>
            <Icon name="CalendarClock" size={23} />
            <span>
              <small>{nextBill ? 'NEXT BILL' : nextPlan ? 'NEXT BUDGET DATE' : 'NEXT BILL'}</small>
              <strong>
                {nextBill ? nextBill.name : nextPlan ? nextPlan.category.name : 'No upcoming bill'}
              </strong>
              <em>
                {nextBill
                  ? `${shortDate(nextBill.date)} · ${money(nextBill.amount)}`
                  : nextPlan
                    ? `${shortDate(nextPlan.date)} · ${money(nextPlan.amount)} planned`
                    : 'Add one in Calendar'}
              </em>
            </span>
            <Icon name="ArrowRight" size={17} />
          </button>
          <button
            className={`today-card ${cashAge !== null && cashAge > 7 ? 'attention' : 'cash'}`}
            onClick={() => setTab('More')}
          >
            <Icon name="Wallet" size={23} />
            <span>
              <small>UNTIL PAYDAY</small>
              <strong>
                {paycheque.afterBills === null
                  ? 'Set up estimate'
                  : money(paycheque.afterBills, data.settings.currency, true)}
              </strong>
              <em>
                {cashAge === null
                  ? 'Add a starting balance'
                  : `Starting balance checked ${cashAge} day${cashAge === 1 ? '' : 's'} ago`}
              </em>
            </span>
            <Icon name="ArrowRight" size={17} />
          </button>
        </section>
      )}
      {isVisible('pulse') && (
        <section className="panel pulse-panel" aria-label="Pockit Pulse" style={homeStyle('pulse')}>
          <div>
            <Icon name="Waves" size={24} />
            <span>
              <strong>Your five-minute Pockit Pulse</strong>
              <small>
                {pulseDue
                  ? 'A quick weekly reset'
                  : `Last checked ${shortDate(data.settings.lastPulseAt!)}`}
              </small>
            </span>
          </div>
          {pulseDue ? (
            <div className="pulse-actions">
              <button onClick={() => setTab('Activity')}>1 · Review activity</button>
              <button onClick={() => setTab('Calendar')}>2 · Check bills</button>
              <button onClick={() => setTab('Budget')}>3 · Adjust plan</button>
              <button
                className="pulse-done"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    settings: { ...current.settings, lastPulseAt: today },
                  }))
                }
              >
                <Icon name="Check" size={16} /> Done for now
              </button>
            </div>
          ) : (
            <p>Nice work. Your next review opens in a week.</p>
          )}
        </section>
      )}
      {isVisible('overview') && (
        <div className="hero-grid" style={homeStyle('overview')}>
          <div className="hero-card">
            <div className="hero-orb orb-one" />
            <div className="hero-orb orb-two" />
            <div className="hero-top">
              <span>YOUR MONEY AT A GLANCE</span>
              <Icon name="ArrowUpRight" size={19} />
            </div>
            <div className="hero-big-label">
              {useActualCashFlow
                ? 'Recorded income less spending'
                : historicalUnplanned
                  ? 'Recorded spending'
                  : 'Monthly plan after recorded spending'}
            </div>
            <div className="hero-number">
              {money(
                useActualCashFlow ? actualIncome - spent : historicalUnplanned ? spent : remaining,
                data.settings.currency,
                true,
              )}
            </div>
            <div className="hero-bottom">
              <span>
                {useActualCashFlow
                  ? 'Based on income and expenses recorded this month. Your planned income stays separate.'
                  : historicalUnplanned
                    ? 'Only spending recorded in the ZIP; no historical budget plan was exported.'
                    : remaining >= 0
                      ? 'Planned income minus spending entered for this month.'
                      : 'Recorded spending has passed your planned income.'}
              </span>
            </div>
          </div>
          <div className="summary-stack">
            <div className="summary-card">
              <div className="summary-icon income">
                <Icon name="ArrowDownLeft" />
              </div>
              <div>
                <span>{historicalUnplanned ? 'Historical income plan' : 'Planned income'}</span>
                <strong>
                  {historicalUnplanned
                    ? 'Not exported'
                    : money(income, data.settings.currency, true)}
                </strong>
              </div>
              <div className="income-record-line">
                <small>Received so far: {money(actualIncome, data.settings.currency, true)}</small>
                <button className="text-button" onClick={onAddIncome}>
                  <Icon name="Plus" size={15} /> Record income
                </button>
              </div>
            </div>
            <div className="summary-card">
              <div className="summary-icon spent">
                <Icon name="ArrowUpRight" />
              </div>
              <div>
                <span>Spent</span>
                <strong>{money(spent, data.settings.currency, true)}</strong>
              </div>
              <small>this month</small>
            </div>
          </div>
        </div>
      )}
      {isVisible('paycheque') && (
        <section className="panel payday-panel" style={homeStyle('paycheque')}>
          <div className="payday-heading">
            <div>
              <span className="eyebrow">UNTIL YOUR NEXT PAYCHEQUE</span>
              <h2>
                {paycheque.payday
                  ? new Intl.DateTimeFormat('en-CA', { month: 'long', day: 'numeric' }).format(
                      new Date(`${paycheque.payday}T12:00:00`),
                    )
                  : 'Set your pay schedule'}
              </h2>
            </div>
            <div className="payday-icon">
              <Icon name="WalletCards" size={23} />
            </div>
          </div>
          {paycheque.afterBills === null ? (
            <>
              <p>
                Set your payday and today’s available money to see what remains after bills due
                before your next paycheque.
              </p>
              <button className="secondary-button compact" onClick={() => setTab('More')}>
                Set up in More <Icon name="ArrowRight" size={15} />
              </button>
            </>
          ) : (
            <>
              <div className="payday-metrics">
                <div>
                  <span>Estimated after upcoming bills</span>
                  <strong className={paycheque.afterBills < 0 ? 'negative' : ''}>
                    {money(paycheque.afterBills, data.settings.currency)}
                  </strong>
                </div>
                <div>
                  <span>
                    Per day for {paycheque.days} {paycheque.days === 1 ? 'day' : 'days'}
                  </span>
                  <strong>{money(paycheque.perDay || 0, data.settings.currency)}</strong>
                </div>
                <div>
                  <span>Unpaid bills before payday</span>
                  <strong>{paycheque.bills.length}</strong>
                </div>
              </div>
              {paycheque.bills.length > 0 && (
                <div className="payday-bills">
                  {paycheque.bills.slice(0, 3).map(({ bill, date }) => (
                    <span key={`${bill.id}-${date}`}>
                      {bill.name} · {date} · {money(bill.amount, data.settings.currency)}
                    </span>
                  ))}
                </div>
              )}
              <p className="payday-disclaimer">
                Estimate from {paycheque.source || 'your starting amount'} checked on{' '}
                {paycheque.asOf}, later income and expenses, and unpaid bills. Transfers and
                unrecorded spending are excluded. This is not your bank balance.
              </p>
            </>
          )}
        </section>
      )}
      {isVisible('spending') && (
        <div className="dashboard-grid spending-breakdown-grid" style={homeStyle('spending')}>
          <section className="panel actual-panel">
            <SectionHead
              title="Actual spending"
              help="The total of expense transactions entered for this month. Transfers are not counted as spending."
              aside={
                <button className="link-button" onClick={() => setTab('Activity')}>
                  View activity <Icon name="ArrowRight" size={15} />
                </button>
              }
            />
            <p className="panel-subtitle">Where your money went this month</p>
            <div className="spending-chart">
              <div className="spending-total">
                <strong>{money(spent, data.settings.currency, true)}</strong>
                <span>spent so far</span>
              </div>
              <div className="bar-list">
                {sorted
                  .filter((c) => (spend[c.id] || 0) > 0)
                  .slice(0, 5)
                  .map((c) => (
                    <div className="bar-row" key={c.id}>
                      <span>{c.name}</span>
                      <div className="bar-track">
                        <div
                          style={{
                            width: `${((spend[c.id] || 0) / Math.max(spent, 1)) * 100}%`,
                            background: c.color,
                          }}
                        />
                      </div>
                      <strong>{money(spend[c.id] || 0, data.settings.currency, true)}</strong>
                    </div>
                  ))}
                {spent === 0 && (
                  <Empty
                    icon="ReceiptText"
                    title="Nothing spent yet"
                    text="Add your first expense in Activity to see your month take shape."
                  />
                )}
              </div>
            </div>
          </section>
          <section className="panel breakdown-panel">
            <SectionHead
              title="Category Breakdown"
              help="Compare what you spent with each category's plan for this month. Tap the eye to see every recorded expense and refund included in a total. Split transactions show only the amount assigned to that category."
              aside={
                <button className="link-button" onClick={() => setTab('Budget')}>
                  Full budget <Icon name="ArrowRight" size={15} />
                </button>
              }
            />
            <div className="category-filter-row" role="group" aria-label="Filter categories">
              {(
                [
                  ['all', 'All', categoryRows.length],
                  ['on-track', 'On Track', categoryRows.length - offTrackCount],
                  ['off-track', 'Off Track', offTrackCount],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  className={categoryFilter === key ? 'active' : ''}
                  aria-pressed={categoryFilter === key}
                  onClick={() => setCategoryFilter(key)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>
            <div className="category-list">
              {filteredCategoryRows.map((row) => {
                const {
                  category: c,
                  used,
                  remaining,
                  availableToSpend,
                  hasPlan,
                  offTrack,
                  nearLimit,
                  rollover,
                } = row
                return (
                  <div className="category-line" key={c.id}>
                    <div className="category-line-top">
                      <div
                        className="category-badge"
                        style={{ background: `${c.color}20`, color: c.color }}
                      >
                        <Icon name={c.icon} size={21} />
                      </div>
                      <div className="category-line-main">
                        <strong title={c.name}>{c.name}</strong>
                        <span>
                          {money(used, data.settings.currency)} /{' '}
                          {hasPlan ? money(availableToSpend, data.settings.currency) : 'No plan'}
                          {rollover && hasPlan ? ' with carryover' : ''}
                        </span>
                      </div>
                      <div className="category-line-totals">
                        <strong>{money(used, data.settings.currency)}</strong>
                        <span className={offTrack ? 'over' : nearLimit ? 'near' : ''}>
                          {!hasPlan && used > 0
                            ? 'No budget set'
                            : offTrack
                              ? `${money(Math.abs(remaining), data.settings.currency)} over`
                              : `${money(remaining, data.settings.currency)} remaining`}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="category-view-button"
                        aria-label={`View ${c.name} transactions`}
                        title={`View ${c.name} transactions`}
                        onClick={() => setDetailCategoryId(c.id)}
                      >
                        <Icon name="Eye" size={20} />
                      </button>
                    </div>
                    <Progress
                      value={
                        availableToSpend > 0 ? (used / availableToSpend) * 100 : offTrack ? 100 : 0
                      }
                      color={offTrack ? 'var(--red)' : nearLimit ? 'var(--peach)' : c.color}
                    />
                  </div>
                )
              })}
              {categoryRows.length === 0 && (
                <Empty
                  icon="Layers3"
                  title="No categories yet"
                  text="Choose your first category and monthly amount in Budget."
                />
              )}
              {categoryRows.length > 0 && filteredCategoryRows.length === 0 && (
                <Empty
                  icon="CheckCircle2"
                  title={
                    categoryFilter === 'off-track'
                      ? 'Everything is on track'
                      : 'Nothing in this view'
                  }
                  text={
                    categoryFilter === 'off-track'
                      ? 'No categories need attention this month.'
                      : 'Try All to see every category.'
                  }
                />
              )}
            </div>
          </section>
        </div>
      )}
      {isVisible('planning') && (
        <div className="dashboard-grid lower" style={homeStyle('planning')}>
          <section className="panel">
            <SectionHead
              title="Trouble spots"
              help="Categories where expense transactions exceed the amount planned for this month."
            />
            <p className="panel-subtitle">A gentle heads-up, never a judgement.</p>
            {trouble.length ? (
              <div className="trouble-list">
                {trouble.map((c) => (
                  <div className="trouble-item" key={c.id}>
                    <div className="trouble-icon">
                      <Icon name="TrendingUp" size={18} />
                    </div>
                    <div>
                      <strong>{c.name}</strong>
                      <small>
                        {money(
                          (spend[c.id] || 0) - categoryBudget(c, month, income),
                          data.settings.currency,
                        )}{' '}
                        over budget
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="good-state">
                <div>
                  <Icon name="Check" size={20} />
                </div>
                <span>
                  {historicalUnplanned
                    ? 'No budget comparison is available for this earlier month.'
                    : 'Looking good. No categories over budget.'}
                </span>
              </div>
            )}
          </section>
          <section className="panel">
            <SectionHead
              title="Upcoming bills"
              help="Bills you add to Calendar appear here until paid. Budget payment dates are shown separately as plans; they do not mean a bill exists or was paid."
              aside={
                <button className="link-button" onClick={() => setTab('Calendar')}>
                  Calendar <Icon name="ArrowRight" size={15} />
                </button>
              }
            />
            {bills.length > 0 && (
              <div className="bill-list">
                {bills.map((b) => (
                  <div className="bill-row" key={b.id}>
                    <div className="bill-date">
                      {Number(b.date.slice(-2))}
                      <small>
                        {new Intl.DateTimeFormat('en-CA', { month: 'short' }).format(
                          new Date(`${month}-01T12:00:00`),
                        )}
                      </small>
                    </div>
                    <div>
                      <strong>{b.name}</strong>
                      <small>Due {b.date}</small>
                    </div>
                    <strong>{money(b.amount, data.settings.currency, true)}</strong>
                  </div>
                ))}
              </div>
            )}
            {bills.length === 0 && plannedDates.length === 0 && (
              <Empty
                icon="CalendarCheck2"
                title="No confirmed bills"
                text="Add a bill in Calendar to track an upcoming payment."
              />
            )}
            {plannedDates.length > 0 && (
              <div className="bill-list" aria-label="Budget payment dates">
                {plannedDates.map((item) => (
                  <div className="bill-row" key={`plan-${item.category.id}`}>
                    <div className="bill-date">
                      {Number(item.date.slice(-2))}
                      <small>PLAN</small>
                    </div>
                    <div>
                      <strong>{item.category.name}</strong>
                      <small>Budget payment date · not a confirmed bill</small>
                    </div>
                    <strong>{money(item.amount, data.settings.currency, true)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {isVisible('trends') && (
        <div className="home-trends" style={homeStyle('trends')}>
          <section className="panel compare-panel">
            <SectionHead
              title="Income vs expenses"
              help="Income and expense transactions for the selected month. When there are no income transactions, we use your expected monthly take-home pay."
            />
            <div className="compare-legend">
              <span>
                <i className="legend-dot green" />{' '}
                {actualIncome > 0 ? 'Recorded income' : 'Expected income'}
              </span>
              <span>
                <i className="legend-dot peach" /> Expenses
              </span>
            </div>
            <div className="compare-bars">
              <div>
                <span>{actualIncome > 0 ? 'Recorded income' : 'Expected income'}</span>
                <div className="compare-track">
                  <div className="income-fill" style={{ width: `${(chartIncome / max) * 100}%` }} />
                </div>
                <strong>{money(chartIncome, data.settings.currency, true)}</strong>
              </div>
              <div>
                <span>Expenses</span>
                <div className="compare-track">
                  <div className="expense-fill" style={{ width: `${(spent / max) * 100}%` }} />
                </div>
                <strong>{money(spent, data.settings.currency, true)}</strong>
              </div>
            </div>
            <p className="compare-foot">
              {prevSpent > 0
                ? `You spent ${money(Math.abs(spent - prevSpent), data.settings.currency, true)} ${spent > prevSpent ? 'more' : 'less'} than last month.`
                : 'Last month’s comparison will appear once you have transactions.'}
            </p>
          </section>
        </div>
      )}
      {detailRow && (
        <Modal
          title={`${detailRow.category.name} transactions`}
          onClose={() => setDetailCategoryId(null)}
          wide
        >
          <div className="modal-body category-detail-body">
            <div className="category-detail-heading">
              <span
                className="category-badge"
                style={{
                  background: `${detailRow.category.color}20`,
                  color: detailRow.category.color,
                }}
              >
                <Icon name={detailRow.category.icon} size={23} />
              </span>
              <div>
                <strong>{detailRow.category.name}</strong>
                <span>
                  {monthLabel(month)} · {detailEntries.length + detailMovements.length}{' '}
                  {detailEntries.length + detailMovements.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
            </div>
            <div className="category-detail-summary">
              <div>
                <span>Net spent</span>
                <strong>{money(detailRow.used, data.settings.currency)}</strong>
              </div>
              <div>
                <span>{detailRow.hasPlan ? 'Available to spend' : 'Monthly plan'}</span>
                <strong>
                  {detailRow.hasPlan
                    ? money(detailRow.availableToSpend, data.settings.currency)
                    : 'Not set'}
                </strong>
              </div>
              <div>
                <span>{detailRow.offTrack ? 'Needs attention' : 'Remaining'}</span>
                <strong className={detailRow.offTrack ? 'over' : ''}>
                  {detailRow.hasPlan
                    ? detailRow.offTrack
                      ? `${money(Math.abs(detailRow.remaining), data.settings.currency)} over`
                      : money(detailRow.remaining, data.settings.currency)
                    : 'Set a plan in Budget'}
                </strong>
              </div>
            </div>
            {detailRow.rollover && detailRow.hasPlan && (
              <p className="category-detail-note">
                Available to spend includes money carried over and added this month.
              </p>
            )}
            {detailEntries.length > 0 && (
              <div className="category-entry-list" aria-label="Category transactions">
                {detailEntries.map(({ transaction, amount, split }) => {
                  const account = data.accounts?.find((item) => item.id === transaction.accountId)
                  return (
                    <div className="category-entry" key={transaction.id}>
                      <span className={`category-entry-icon ${amount < 0 ? 'refund' : ''}`}>
                        <Icon name={amount < 0 ? 'ArrowDownLeft' : 'ReceiptText'} size={19} />
                      </span>
                      <div className="category-entry-description">
                        <strong>{transaction.payee}</strong>
                        <span>
                          {shortDate(transaction.date)} ·{' '}
                          {amount < 0
                            ? transaction.waypointTypeRaw?.toLowerCase() === 'reimbursement'
                              ? 'Reimbursement'
                              : 'Refund'
                            : split
                              ? 'Split expense'
                              : 'Expense'}
                          {account ? ` · ${account.name}` : ''}
                        </span>
                        {split && (
                          <small>
                            {money(Math.abs(amount), data.settings.currency)} assigned here from a{' '}
                            {money(transaction.amount, data.settings.currency)} transaction
                          </small>
                        )}
                        {transaction.note && (
                          <small className="category-entry-note">{transaction.note}</small>
                        )}
                      </div>
                      <strong className={`category-entry-amount ${amount < 0 ? 'refund' : ''}`}>
                        {amount < 0 ? '+' : '−'}
                        {money(Math.abs(amount), data.settings.currency)}
                      </strong>
                    </div>
                  )
                })}
              </div>
            )}
            {detailMovements.length > 0 && (
              <div className="category-related-activity">
                <div>
                  <strong>Money added or moved</strong>
                  <span>These entries are connected to this category but are not spending.</span>
                </div>
                <div className="category-entry-list" aria-label="Related category movements">
                  {detailMovements.map((transaction) => (
                    <div className="category-entry" key={transaction.id}>
                      <span className="category-entry-icon movement">
                        <Icon
                          name={transaction.type === 'income' ? 'ArrowDownLeft' : 'ArrowLeftRight'}
                          size={19}
                        />
                      </span>
                      <div className="category-entry-description">
                        <strong>{transaction.payee}</strong>
                        <span>
                          {shortDate(transaction.date)} ·{' '}
                          {transaction.type === 'income' ? 'Income' : 'Transfer'} · not spending
                        </span>
                        {transaction.note && (
                          <small className="category-entry-note">{transaction.note}</small>
                        )}
                      </div>
                      <strong className="category-entry-amount">
                        {money(transaction.amount, data.settings.currency)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detailEntries.length === 0 && detailMovements.length === 0 && (
              <Empty
                icon="ReceiptText"
                title="No entries yet"
                text="Expenses and refunds recorded in this category for this month will appear here."
              />
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setDetailCategoryId(null)
                  setTab('Activity')
                }}
              >
                Open Activity <Icon name="ArrowRight" size={16} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {customizing && (
        <Modal title="Customize Home" onClose={() => setCustomizing(false)}>
          <div className="modal-body">
            <p className="modal-intro">
              Choose what appears on Home. Drag the handles to arrange sections. Your layout saves
              when you release a section.
            </p>
            <div className="home-layout-list">
              {draftOrder.map((id, index) => {
                const section = homeSections.find((item) => item.id === id)!
                return (
                  <div
                    className={`home-layout-row ${dragging === id ? 'dragging' : ''}`}
                    key={id}
                    data-home-section={id}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={isVisible(id)}
                        onChange={() => toggleHomeSection(id)}
                      />
                      <span>
                        <strong>{section.label}</strong>
                        <small>{section.description}</small>
                      </span>
                    </label>
                    <button
                      className="home-layout-grip"
                      type="button"
                      aria-label={`Drag ${section.label} to reorder`}
                      aria-description="Drag to another position, or use the up and down arrow keys."
                      onPointerDown={(event) => startDragging(event, id)}
                      onPointerMove={dragOver}
                      onPointerUp={finishDragging}
                      onPointerCancel={cancelDragging}
                      onKeyDown={(event) => {
                        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                        event.preventDefault()
                        const target = draftOrder[index + (event.key === 'ArrowUp' ? -1 : 1)]
                        if (!target) return
                        const order = reorderHomeSection(draftOrder, id, target)
                        setDraftOrder(order)
                        setHomeOrder(order)
                      }}
                    >
                      <Icon name="GripVertical" size={22} />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setDraftOrder(normalizedHomeOrder())
                  update((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      homeOrder: undefined,
                      hiddenHomeSections: undefined,
                    },
                  }))
                }}
              >
                Reset layout
              </button>
              <button className="primary-button" onClick={() => setCustomizing(false)}>
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
