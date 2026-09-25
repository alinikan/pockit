import type { MonthKey, PockitData } from '../types'
import { useState } from 'react'
import {
  homeSections,
  moveHomeSection,
  normalizedHomeOrder,
  type HomeSectionId,
} from '../lib/homeLayout'
import {
  billsForMonth,
  beforeWaypointPlan,
  budgetHealth,
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
  openCoach,
  update,
}: {
  data: PockitData
  month: MonthKey
  setTab: (tab: 'Activity' | 'Budget' | 'Calendar' | 'More') => void
  openCoach: () => void
  update: (recipe: (value: PockitData) => PockitData) => void
}) {
  const [customizing, setCustomizing] = useState(false)
  const homeOrder = normalizedHomeOrder(data.settings.homeOrder)
  const hidden = new Set(data.settings.hiddenHomeSections || [])
  const homeStyle = (id: HomeSectionId) => ({ order: homeOrder.indexOf(id) })
  const isVisible = (id: HomeSectionId) => !hidden.has(id)
  const setHomeOrder = (order: HomeSectionId[]) =>
    update((current) => ({
      ...current,
      settings: { ...current.settings, homeOrder: order },
    }))
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
  const useActualCashFlow = actualIncome > 0 && (historicalUnplanned || !income)
  const spend = spendingByCategory(data.transactions, month)
  const sorted = [...data.categories]
    .filter((c) => categoryBudget(c, month, income) > 0 || spend[c.id])
    .sort((a, b) => (spend[b.id] || 0) - (spend[a.id] || 0))
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
        <button className="secondary-button compact" onClick={() => setCustomizing(true)}>
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
                  ? 'Based on income and expenses recorded for this month; no income plan is set.'
                  : historicalUnplanned
                    ? 'Only spending recorded in the ZIP; no historical budget plan was exported.'
                    : remaining >= 0
                      ? 'Planned income minus spending entered for this month.'
                      : 'Recorded spending has passed your planned income.'}
              </span>
              <button onClick={openCoach}>
                Get insight <Icon name="ArrowRight" size={15} />
              </button>
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
              <small>Received so far: {money(actualIncome, data.settings.currency, true)}</small>
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
        <div className="dashboard-grid" style={homeStyle('spending')}>
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
              title="Category breakdown"
              help="Each line compares your expense transactions with the monthly amount you planned. Rollover categories carry unused balances forward."
              aside={
                <button className="link-button" onClick={() => setTab('Budget')}>
                  Full budget <Icon name="ArrowRight" size={15} />
                </button>
              }
            />
            <div className="category-list">
              {sorted.slice(0, 6).map((c) => {
                const budget = categoryBudget(c, month, income)
                const used = spend[c.id] || 0
                const carried =
                  categoryPolicy(c, month).mode === 'rollover' && month >= c.starts
                    ? rolloverMonth(c, data, month)
                    : null
                return (
                  <div className="category-line" key={c.id}>
                    <div
                      className="category-badge"
                      style={{ background: `${c.color}22`, color: c.color }}
                    >
                      <Icon name={c.icon} size={18} />
                    </div>
                    <div className="category-line-main">
                      <div>
                        <strong>{c.name}</strong>
                        <span>
                          {money(used, data.settings.currency, true)}
                          {month < c.starts
                            ? ' · no plan for this month'
                            : ` / ${money(budget, data.settings.currency, true)} planned`}
                          {carried &&
                            ` · ${money(carried.available, data.settings.currency, true)} available with carryover`}
                        </span>
                      </div>
                      <Progress
                        value={
                          month < c.starts
                            ? 0
                            : carried
                              ? (used / Math.max(carried.carried + carried.added, 1)) * 100
                              : budget
                                ? (used / budget) * 100
                                : used
                                  ? 100
                                  : 0
                        }
                        color={
                          month >= c.starts && (carried ? carried.available < 0 : used > budget)
                            ? 'var(--red)'
                            : c.color
                        }
                      />
                    </div>
                  </div>
                )
              })}
              {sorted.length === 0 && (
                <Empty
                  icon="Layers3"
                  title="No categories yet"
                  text="Choose your first category and monthly amount in Budget."
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
        <div className="dashboard-grid lower" style={homeStyle('trends')}>
          <section className="panel compare-panel">
            <SectionHead
              title="Income vs expenses"
              help="Income and expense transactions for the selected month. When there are no income transactions, we use your expected monthly take-home pay."
            />
            <div className="compare-legend">
              <span>
                <i className="legend-dot green" /> Income
              </span>
              <span>
                <i className="legend-dot peach" /> Expenses
              </span>
            </div>
            <div className="compare-bars">
              <div>
                <span>Income</span>
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
          <section className="coach-promo">
            <div className="coach-promo-icon">
              <Icon name="Sparkles" size={25} />
            </div>
            <span>POCKIT MONEY COACH</span>
            <h3>A second set of eyes for your money.</h3>
            <p>
              Ask about your month, your goals, or where you might find a little breathing room.
            </p>
            <button onClick={openCoach}>
              Ask Pockit <Icon name="ArrowUpRight" size={17} />
            </button>
          </section>
        </div>
      )}
      {customizing && (
        <Modal title="Customize Home" onClose={() => setCustomizing(false)}>
          <div className="modal-body">
            <p className="modal-intro">
              Choose what appears on Home. Move the most useful sections up; your layout saves with
              your Pockit data.
            </p>
            <div className="home-layout-list">
              {homeOrder.map((id, index) => {
                const section = homeSections.find((item) => item.id === id)!
                return (
                  <div className="home-layout-row" key={id}>
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
                    <div className="home-layout-move">
                      <button
                        aria-label={`Move ${section.label} up`}
                        disabled={index === 0}
                        onClick={() => setHomeOrder(moveHomeSection(homeOrder, id, -1))}
                      >
                        <Icon name="ArrowUp" size={17} />
                      </button>
                      <button
                        aria-label={`Move ${section.label} down`}
                        disabled={index === homeOrder.length - 1}
                        onClick={() => setHomeOrder(moveHomeSection(homeOrder, id, 1))}
                      >
                        <Icon name="ArrowDown" size={17} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    settings: {
                      ...current.settings,
                      homeOrder: undefined,
                      hiddenHomeSections: undefined,
                    },
                  }))
                }
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
