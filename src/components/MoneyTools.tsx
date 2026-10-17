import { useMemo, useState } from 'react'
import type { MonthKey, PockitData } from '../types'
import { cashForecast, checkAffordability } from '../lib/forecast'
import { accountReservations } from '../lib/goalFunding'
import { categoryAvailable, cents, monthCoverage } from '../lib/experience'
import {
  categoryBudget,
  categoryPolicy,
  money,
  monthLabel,
  monthSummary,
  shortDate,
  todayISO,
} from '../lib/finance'
import { Field, Icon, Modal } from './UI'
import { TimelineChart } from './TimelineChart'
import { num } from '../lib/numbers'

export function MoneyTools({
  data,
  month,
  update,
}: {
  data: PockitData
  month: MonthKey
  update: (recipe: (data: PockitData) => PockitData) => void
}) {
  const [open, setOpen] = useState<'forecast' | 'purchase' | 'numbers' | null>(null)
  const [accountId, setAccountId] = useState(
    data.accounts?.find((item) => !item.archived && item.kind === 'chequing')?.id || '',
  )
  const [days, setDays] = useState(60),
    [expectedPay, setExpectedPay] = useState(true),
    [everyday, setEveryday] = useState(false)
  const [changes, setChanges] = useState<Record<string, { date: string; amount: number }>>({})
  const [eventId, setEventId] = useState(''),
    [eventDate, setEventDate] = useState(''),
    [eventAmount, setEventAmount] = useState('')
  const [price, setPrice] = useState(''),
    [purchaseDate, setPurchaseDate] = useState(todayISO()),
    [categoryId, setCategoryId] = useState(
      data.categories.find((item) => !item.archived)?.id || '',
    ),
    [sourceId, setSourceId] = useState('')
  const [error, setError] = useState('')
  const forecast = useMemo(
    () =>
      cashForecast(data, {
        days,
        expectedPay,
        everyday,
        changes: open === 'forecast' ? changes : {},
      }),
    [data, days, expectedPay, everyday, changes, open],
  )
  const selectable = forecast.accounts.filter(
    (item) => open !== 'purchase' || item.kind !== 'credit',
  )
  const selected =
    selectable.find((item) => item.id === accountId) ||
    selectable.find((item) => item.kind === 'chequing') ||
    selectable[0]
  const points = selected
    ? forecast.points.map((point) => ({ date: point.date, value: point.balances[selected.id] }))
    : []
  const lowest = points.length ? points.reduce((a, b) => (b.value < a.value ? b : a)) : null
  let purchase: ReturnType<typeof checkAffordability> | null = null,
    purchaseError = ''
  if (price) {
    try {
      purchase = checkAffordability(data, {
        amount: Number(price),
        accountId: selected?.id || '',
        categoryId,
        date: purchaseDate,
        days,
        expectedPay,
        everyday,
      })
    } catch (cause) {
      purchaseError = (cause as Error).message
    }
  }
  const summary = monthSummary(data, month),
    coverage = monthCoverage(data, month)
  const shortfall = purchase ? Math.max(0, -purchase.categoryAfter) : 0
  function movePlan() {
    try {
      update((current) => {
        const key = purchaseDate.slice(0, 7) as MonthKey
        const target = current.categories.find((item) => item.id === categoryId)!,
          source = current.categories.find((item) => item.id === sourceId)
        const needed = Math.max(
          0,
          Number(price) - (categoryAvailable(current, categoryId, key) || 0),
        )
        if (
          !source ||
          !target ||
          source.id === target.id ||
          categoryPolicy(source, key).mode !== 'fresh' ||
          (categoryAvailable(current, source.id, key) || 0) < needed
        )
          throw new Error('Choose a category with enough unspent money.')
        const income = monthSummary(current, key).income
        if (categoryBudget(source, key, income) < needed)
          throw new Error('Use money from this month’s allocation, rather than earlier carryover.')
        return {
          ...current,
          categories: current.categories.map((item) =>
            item.id === target.id || item.id === source.id
              ? {
                  ...item,
                  overrides: {
                    ...item.overrides,
                    [key]: cents(
                      categoryBudget(item, key, income) +
                        (item.id === target.id ? needed : -needed),
                    ),
                  },
                }
              : item,
          ),
        }
      })
      setError('')
    } catch (cause) {
      setError((cause as Error).message)
    }
  }
  return (
    <>
      <div className="money-tool-actions" aria-label="Money tools">
        <button
          onClick={() => {
            setOpen('forecast')
            setError('')
          }}
        >
          <Icon name="ChartNoAxesCombined" size={19} />
          Next 60 days
        </button>
        <button
          onClick={() => {
            setOpen('purchase')
            setError('')
          }}
        >
          <Icon name="ShoppingBag" size={19} />
          Can I afford this?
        </button>
        <button onClick={() => setOpen('numbers')}>
          <Icon name="Calculator" size={19} />
          Explain my numbers
        </button>
      </div>
      {open && (
        <Modal
          title={
            open === 'forecast'
              ? 'Your account forecast'
              : open === 'purchase'
                ? 'Can I afford this?'
                : 'Behind your numbers'
          }
          onClose={() => setOpen(null)}
          wide={open === 'forecast'}
        >
          <div className="modal-body experience-sheet">
            {open === 'numbers' ? (
              <>
                <p className="soft-note">
                  {monthLabel(month)} · {coverage.label}. A monthly plan and money in an account
                  answer different questions.
                </p>
                <div className="number-explanation">
                  <span>
                    Expected monthly income<strong>{money(summary.income)}</strong>
                  </span>
                  <span>
                    Recorded income<strong>{money(summary.actualIncome)}</strong>
                  </span>
                  <span>
                    Recorded expenses<strong>−{money(summary.spent)}</strong>
                  </span>
                  <span>
                    Category allocations<strong>{money(summary.allocated)}</strong>
                  </span>
                  <span>
                    Unallocated in the plan<strong>{money(summary.unallocated)}</strong>
                  </span>
                </div>
                <p className="goal-form-note">
                  Expected income comes from your pay schedule or imported income plan. Recorded
                  income and expenses come from Activity, including refunds. Transfers are not
                  income or expenses; categorized investment transfers use the plan. Category
                  allocations are intentions, not additional money.
                </p>
                <details>
                  <summary>View entries included this month</summary>
                  {data.transactions
                    .filter((item) => item.date.startsWith(month))
                    .map((item) => (
                      <div className="tool-list-row" key={item.id}>
                        <span>
                          {item.payee}
                          <small>
                            {shortDate(item.date)} · {item.type}
                            {item.refund ? ' · refund' : ''}
                          </small>
                        </span>
                        <strong>{money(item.amount)}</strong>
                      </div>
                    ))}
                </details>
                {(data.accounts || [])
                  .filter((item) => !item.archived)
                  .map((account) => (
                    <p className="goal-form-note" key={account.id}>
                      {account.name}: balance checked{' '}
                      {account.reconciledAt?.slice(0, 10) || account.asOf}. Goals reserve{' '}
                      {money(accountReservations(data, account.id))} within this account, not on top
                      of it.
                    </p>
                  ))}
              </>
            ) : (
              <>
                <p className="goal-form-note">
                  {open === 'forecast'
                    ? 'Explore future balances from recorded accounts and the schedules you entered. Changes here are previews.'
                    : 'Test a purchase against its category and the money available after schedules and goal reservations. This is an estimate based on your entries.'}
                </p>
                {!selectable.length ? (
                  <p className="form-message" role="status">
                    {open === 'purchase'
                      ? 'Add and check a chequing, savings, cash, or investment account in More → Accounts to check a purchase.'
                      : 'Add and check an account in More → Accounts to use these tools.'}
                  </p>
                ) : (
                  <>
                    <div className="form-grid">
                      <Field
                        label={open === 'purchase' ? 'Money to cover this purchase' : 'Account'}
                      >
                        <select
                          aria-label={
                            open === 'purchase'
                              ? 'Money to cover this purchase'
                              : 'Forecast account'
                          }
                          value={selected?.id || ''}
                          onChange={(event) => setAccountId(event.target.value)}
                        >
                          {forecast.accounts
                            .filter((item) => open !== 'purchase' || item.kind !== 'credit')
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Look ahead">
                        <select
                          value={days}
                          onChange={(event) => {
                            setDays(Number(event.target.value))
                            setChanges({})
                          }}
                        >
                          <option value={30}>30 days</option>
                          <option value={60}>60 days</option>
                          <option value={90}>90 days</option>
                        </select>
                      </Field>
                    </div>
                    <label className="check-line">
                      <input
                        type="checkbox"
                        checked={expectedPay}
                        onChange={(event) => setExpectedPay(event.target.checked)}
                      />
                      Include expected pay into{' '}
                      {forecast.accounts.find((item) => item.id === forecast.primaryId)?.name ||
                        'your primary account'}
                    </label>
                    <label className="check-line">
                      <input
                        type="checkbox"
                        checked={everyday}
                        onChange={(event) => setEveryday(event.target.checked)}
                      />
                      Include an optional everyday spending estimate from unused category budgets
                    </label>
                    {everyday && (
                      <p className="goal-form-note">
                        This spreads unused allocations across the remaining days of each month, in
                        the primary spending account. It is not a prediction of purchases; turn it
                        off when those costs are already represented elsewhere.
                      </p>
                    )}
                    {open === 'forecast' ? (
                      <>
                        {lowest && (
                          <div className={`tool-result ${lowest.value < 0 ? 'attention' : 'good'}`}>
                            <span>Lowest estimated balance</span>
                            <strong>{money(lowest.value)}</strong>
                            <small>
                              {shortDate(lowest.date)} · {selected?.name}
                            </small>
                          </div>
                        )}
                        <TimelineChart points={points} label="Inspect daily forecast balances" />
                        <p className="goal-form-note">
                          Daily balances do not predict the order in which payments post. Today
                          starts from the checked balance and recorded account movements. The dashed
                          line is projected. Investments assume no market change. Goal reservations
                          stay inside the account balance.
                        </p>
                        <details>
                          <summary>View scheduled items and try a change</summary>
                          <div className="form-grid">
                            <Field label="Scheduled item">
                              <select
                                value={eventId}
                                onChange={(event) => {
                                  setEventId(event.target.value)
                                  const entry = forecast.events.find(
                                    (item) => item.id === event.target.value,
                                  )
                                  setEventDate(entry?.date || '')
                                  setEventAmount(String(entry?.amount || ''))
                                }}
                              >
                                <option value="">Choose an item</option>
                                {forecast.events
                                  .filter((item) => item.type === 'scheduled')
                                  .map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name} · {item.date}
                                    </option>
                                  ))}
                              </select>
                            </Field>
                            {eventId && (
                              <>
                                <Field label="Preview date">
                                  <input
                                    type="date"
                                    value={eventDate}
                                    min={todayISO()}
                                    onChange={(event) => setEventDate(event.target.value)}
                                  />
                                </Field>
                                <Field label="Preview amount">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={eventAmount}
                                    onChange={(event) => setEventAmount(event.target.value)}
                                  />
                                </Field>
                                <button
                                  className="secondary-button"
                                  onClick={() => {
                                    if (
                                      !eventDate ||
                                      eventDate <= todayISO() ||
                                      eventDate > forecast.end ||
                                      !Number.isFinite(Number(eventAmount)) ||
                                      Number(eventAmount) < 0
                                    ) {
                                      setError(
                                        'Choose a future date within this preview and a valid amount.',
                                      )
                                      return
                                    }
                                    setChanges({
                                      ...changes,
                                      [eventId]: { date: eventDate, amount: Number(eventAmount) },
                                    })
                                    setError('')
                                  }}
                                >
                                  Preview change
                                </button>
                              </>
                            )}
                          </div>
                          {Object.keys(changes).length > 0 && (
                            <button className="text-button" onClick={() => setChanges({})}>
                              Reset preview changes
                            </button>
                          )}
                          {forecast.events.map((item) => (
                            <div key={item.id} className="tool-list-row">
                              <span>
                                {item.name}
                                <small>
                                  {shortDate(item.date)} · {item.type} ·{' '}
                                  {forecast.accounts.find(
                                    (account) => account.id === item.accountId,
                                  )?.name || 'No account'}
                                </small>
                              </span>
                              <strong>{money(item.amount)}</strong>
                            </div>
                          ))}
                        </details>
                      </>
                    ) : (
                      <>
                        <div className="form-grid">
                          <Field label="Purchase amount">
                            <input
                              inputMode="decimal"
                              type="number"
                              min="0.01"
                              max="1000000"
                              step="0.01"
                              value={price}
                              onChange={(event) => setPrice(event.target.value)}
                            />
                          </Field>
                          <Field label="Purchase date">
                            <input
                              type="date"
                              min={todayISO()}
                              max={forecast.end}
                              value={purchaseDate}
                              onChange={(event) => setPurchaseDate(event.target.value)}
                            />
                          </Field>
                          <Field label="Purchase category">
                            <select
                              value={categoryId}
                              onChange={(event) => setCategoryId(event.target.value)}
                            >
                              {data.categories
                                .filter((item) => !item.archived)
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.name}
                                  </option>
                                ))}
                            </select>
                          </Field>
                        </div>
                        {purchaseError && (
                          <p role="alert" className="form-message">
                            {purchaseError}
                          </p>
                        )}
                        {purchase && (
                          <>
                            <div
                              className={`tool-result ${purchase.fits && purchase.notes.length === 0 ? 'good' : 'attention'}`}
                            >
                              <span>
                                {purchase.fits
                                  ? 'Fits the entered plan'
                                  : 'This purchase needs a change'}
                              </span>
                              <strong>{money(purchase.categoryAfter)} left in the category</strong>
                              <small>
                                {money(purchase.after)} at the account’s lowest projected point
                                after the purchase and existing goal reservations.
                              </small>
                            </div>
                            <p className="goal-form-note">
                              Lowest projected account balance before the purchase:{' '}
                              {money(purchase.lowest)}. Reserved for goals:{' '}
                              {money(purchase.reserved)}. Future income is expected, not guaranteed.
                            </p>
                            {shortfall > 0 && (
                              <details>
                                <summary>
                                  Review moving {money(shortfall)} from another category
                                </summary>
                                <Field label="Move plan money from">
                                  <select
                                    value={sourceId}
                                    onChange={(event) => setSourceId(event.target.value)}
                                  >
                                    <option value="">Choose a category</option>
                                    {data.categories
                                      .filter(
                                        (item) =>
                                          !item.archived &&
                                          item.id !== categoryId &&
                                          categoryPolicy(item, purchaseDate.slice(0, 7) as MonthKey)
                                            .mode === 'fresh' &&
                                          (categoryAvailable(
                                            data,
                                            item.id,
                                            purchaseDate.slice(0, 7) as MonthKey,
                                          ) || 0) >= shortfall,
                                      )
                                      .map((item) => (
                                        <option key={item.id} value={item.id}>
                                          {item.name}
                                        </option>
                                      ))}
                                  </select>
                                </Field>
                                <p className="goal-form-note">
                                  Only this month’s category allocations change. This does not
                                  create a purchase or move money at your bank.
                                </p>
                                <button
                                  className="primary-button"
                                  disabled={!sourceId}
                                  onClick={movePlan}
                                >
                                  Move {money(shortfall)} in the plan
                                </button>
                              </details>
                            )}
                            <TimelineChart
                              points={purchase.forecast.points.map((point) => ({
                                date: point.date,
                                value:
                                  point.balances[purchase!.account.id] -
                                  (point.date >= purchaseDate ? num(price) : 0),
                              }))}
                              label="Inspect balances with this purchase"
                            />
                          </>
                        )}
                      </>
                    )}
                    {forecast.notes.length > 0 && (
                      <div className="tool-caveats">
                        <strong>Check before relying on this estimate</strong>
                        <ul>
                          {forecast.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {error && (
              <p className="form-message" role="alert">
                {error}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
