import type { MonthKey, PockitData } from '../types'
import {
  billsForMonth,
  budgetHealth,
  categoryBudget,
  money,
  shiftMonth,
  spendingByCategory,
  todayISO,
} from '../lib/finance'
import { paychequeForecast } from '../lib/payday'
import { Empty, Icon, Progress, SectionHead } from '../components/UI'

export function HomeScreen({
  data,
  month,
  setTab,
  openCoach,
}: {
  data: PockitData
  month: MonthKey
  setTab: (tab: 'Activity' | 'Budget' | 'Calendar' | 'More') => void
  openCoach: () => void
}) {
  const { income, spent, remaining, trouble } = budgetHealth(data, month)
  const spend = spendingByCategory(data.transactions, month)
  const sorted = [...data.categories]
    .filter((c) => !c.archived && (categoryBudget(c, month, income) > 0 || spend[c.id]))
    .sort((a, b) => (spend[b.id] || 0) - (spend[a.id] || 0))
  const bills = billsForMonth(data.bills, month)
    .filter((b) => !b.paid)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)
  const max = Math.max(income, spent, 1)
  const previous = shiftMonth(month, -1)
  const prevSpent = data.transactions
    .filter((t) => t.date.startsWith(previous) && t.type === 'expense')
    .reduce((n, t) => n + t.amount, 0)
  const paycheque = paychequeForecast(data, todayISO())
  return (
    <div className="screen-stack">
      <div className="hero-grid">
        <div className="hero-card">
          <div className="hero-orb orb-one" />
          <div className="hero-orb orb-two" />
          <div className="hero-top">
            <span>YOUR MONEY AT A GLANCE</span>
            <Icon name="ArrowUpRight" size={19} />
          </div>
          <div className="hero-big-label">Left after spending</div>
          <div className="hero-number">{money(remaining, data.settings.currency, true)}</div>
          <div className="hero-bottom">
            <span>
              {remaining >= 0
                ? 'You’re within this month’s income.'
                : 'Spending has passed your income.'}
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
              <span>Income</span>
              <strong>{money(income, data.settings.currency, true)}</strong>
            </div>
            <small>this month</small>
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
      <section className="panel payday-panel">
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
              Set your payday and today’s available money to see what remains after bills due before
              your next paycheque.
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
              Estimate based on the amount you entered on {data.profile.cashAsOf}, later income and
              expenses, and unpaid bills. Transfers and unrecorded spending are excluded. This is
              not your bank balance.
            </p>
          </>
        )}
      </section>
      <div className="dashboard-grid">
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
                        {money(used, data.settings.currency, true)} /{' '}
                        {money(budget, data.settings.currency, true)}
                      </span>
                    </div>
                    <Progress
                      value={budget ? (used / budget) * 100 : used ? 100 : 0}
                      color={used > budget ? 'var(--red)' : c.color}
                    />
                  </div>
                </div>
              )
            })}
            {sorted.length === 0 && (
              <Empty
                icon="Layers3"
                title="No categories yet"
                text="Set your first monthly allocation in Budget."
              />
            )}
          </div>
        </section>
      </div>
      <div className="dashboard-grid lower">
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
              <span>Looking good. No categories over budget.</span>
            </div>
          )}
        </section>
        <section className="panel">
          <SectionHead
            title="Upcoming bills"
            help="Bills you add to Calendar appear here until you mark them paid."
            aside={
              <button className="link-button" onClick={() => setTab('Calendar')}>
                Calendar <Icon name="ArrowRight" size={15} />
              </button>
            }
          />
          {bills.length ? (
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
          ) : (
            <Empty
              icon="CalendarCheck2"
              title="All clear"
              text="No unpaid bills scheduled for this month."
            />
          )}
        </section>
      </div>
      <div className="dashboard-grid lower">
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
                <div className="income-fill" style={{ width: `${(income / max) * 100}%` }} />
              </div>
              <strong>{money(income, data.settings.currency, true)}</strong>
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
          <p>Ask about your month, your goals, or where you might find a little breathing room.</p>
          <button onClick={openCoach}>
            Ask Pockit <Icon name="ArrowUpRight" size={17} />
          </button>
        </section>
      </div>
    </div>
  )
}
