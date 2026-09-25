import { num } from '../lib/numbers'
import { useState } from 'react'
import type { Bill, Frequency, MonthKey, PockitData } from '../types'
import {
  billsForMonth,
  categoriesMissingBillDates,
  categoryBudget,
  categoryDueDates,
  money,
  monthSummary,
  transactionsInMonth,
} from '../lib/finance'
import { paydaysInMonth } from '../lib/paySchedule'
import { validISODate } from '../lib/numbers'
import { Empty, Field, Icon, Modal, SectionHead } from '../components/UI'
import { changeTransaction } from '../lib/linked'

export function CalendarScreen({
  data,
  month,
  update,
}: {
  data: PockitData
  month: MonthKey
  update: (recipe: (value: PockitData) => PockitData) => void
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [year, number] = month.split('-').map(Number)
  const firstWeekday = new Date(year, number - 1, 1).getDay()
  const days = new Date(year, number, 0).getDate()
  const txs = transactionsInMonth(data.transactions, month)
  const bills = billsForMonth(data.bills, month)
  const plannedDates = categoryDueDates(data, month)
  const paydays = paydaysInMonth(data.profile, month)
  const paySummary = monthSummary(data, month)
  const unscheduled = categoriesMissingBillDates(data, month)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const seven = new Date(today)
  seven.setDate(seven.getDate() + 7)
  const upcoming = [0, 1]
    .flatMap((offset) => {
      const date = new Date(today.getFullYear(), today.getMonth() + offset, 1)
      const key =
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` as MonthKey
      return billsForMonth(data.bills, key).map((bill) => ({
        ...bill,
        date: new Date(`${bill.date}T12:00:00`),
        month: key,
      }))
    })
    .filter((bill) => bill.date >= today && bill.date < seven && !bill.paid && !bill.skipped)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const plannedUpcoming = [0, 1]
    .flatMap((offset) => {
      const date = new Date(today.getFullYear(), today.getMonth() + offset, 1)
      const key =
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` as MonthKey
      return categoryDueDates(data, key).map((item) => ({
        ...item,
        date: new Date(`${item.date}T12:00:00`),
      }))
    })
    .filter((item) => item.date >= today && item.date < seven)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const chosen =
    selectedDay ||
    (month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
      ? today.getDate()
      : 1)
  const dayTxs = txs.filter((t) => Number(t.date.slice(-2)) === chosen)
  const dayBills = bills.filter((b) => Number(b.date.slice(-2)) === chosen)
  const dayPlans = plannedDates.filter((item) => Number(item.date.slice(-2)) === chosen)
  const dayPayCount = paydays.filter((date) => Number(date.slice(-2)) === chosen).length
  const setPayProfile = (patch: Partial<PockitData['profile']>) =>
    update((current) => ({ ...current, profile: { ...current.profile, ...patch } }))
  function save() {
    if (
      !editing?.name.trim() ||
      editing.amount <= 0 ||
      !Number.isInteger(editing.day) ||
      editing.day < 1 ||
      editing.day > 31 ||
      (editing.paymentType === 'transfer' &&
        !!editing.accountId &&
        editing.accountId === editing.toAccountId)
    )
      return
    const bill = { ...editing, name: editing.name.trim() }
    update((d) => ({
      ...d,
      bills: d.bills.some((b) => b.id === bill.id)
        ? d.bills.map((b) => (b.id === bill.id ? bill : b))
        : [...d.bills, bill],
    }))
    setEditing(null)
  }
  function remove() {
    if (!editing || !window.confirm(`Delete ${editing.name}?`)) return
    update((d) => ({ ...d, bills: d.bills.filter((b) => b.id !== editing.id) }))
    setEditing(null)
  }
  function skipReminder(id: string) {
    update((d) => ({
      ...d,
      bills: d.bills.map((b) =>
        b.id === id
          ? {
              ...b,
              skippedMonths: b.skippedMonths?.includes(month)
                ? b.skippedMonths.filter((m) => m !== month)
                : [...(b.skippedMonths || []), month],
            }
          : b,
      ),
    }))
  }
  function recordPayment(bill: Bill, date: string) {
    if (
      data.transactions.some(
        (transaction) =>
          transaction.billId === bill.id && transaction.date.slice(0, 7) === date.slice(0, 7),
      )
    )
      return
    update((d) =>
      changeTransaction(d, null, {
        id: crypto.randomUUID(),
        date,
        payee: bill.name,
        amount: bill.amount,
        createdAt: new Date().toISOString(),
        type: bill.paymentType || 'expense',
        categoryId: bill.paymentType === 'transfer' ? undefined : bill.categoryId,
        billId: bill.id,
        accountId:
          bill.accountId ||
          d.accounts?.find((account) => account.kind === 'chequing' && !account.archived)?.id,
        toAccountId: bill.paymentType === 'transfer' ? bill.toAccountId : undefined,
        reviewed: true,
        source: 'manual',
      }),
    )
  }
  return (
    <div className="calendar-layout">
      {unscheduled.length > 0 && (
        <section className="calendar-setup-note" aria-label="Plan dates for regular bills">
          <span className="calendar-setup-icon">
            <Icon name="CalendarClock" size={21} />
          </span>
          <div>
            <strong>
              {unscheduled.length} regular {unscheduled.length === 1 ? 'cost needs' : 'costs need'}{' '}
              a date
            </strong>
            <p>
              Choose when these bills are due. Pockit will show them on the calendar; planning one
              does not mark it paid.
            </p>
            <div className="calendar-setup-actions">
              {unscheduled.slice(0, 4).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setEditing({
                      id: crypto.randomUUID(),
                      name: category.name,
                      amount: categoryBudget(category, month, paySummary.income),
                      day: 0,
                      categoryId: category.id,
                      paidMonths: [],
                      frequency: 'monthly',
                      starts: month,
                    })
                  }
                >
                  Set {category.name} date <Icon name="ArrowRight" size={15} />
                </button>
              ))}
              {unscheduled.length > 4 && (
                <small>And {unscheduled.length - 4} more regular costs</small>
              )}
            </div>
          </div>
        </section>
      )}
      <section className="panel calendar-panel">
        <SectionHead
          title="Your calendar"
          help="Payday markers are estimates from your schedule. Income dots are pay you actually recorded. Bill and budget markers are plans, not proof of payment."
          aside={
            <button
              className="primary-button compact"
              onClick={() =>
                setEditing({
                  id: crypto.randomUUID(),
                  name: '',
                  amount: 0,
                  day: chosen,
                  paidMonths: [],
                  frequency: 'monthly',
                  starts: month,
                })
              }
            >
              <Icon name="Plus" size={16} /> Add bill
            </button>
          }
        />
        <div className="calendar-grid">
          <div className="weekday">Sun</div>
          <div className="weekday">Mon</div>
          <div className="weekday">Tue</div>
          <div className="weekday">Wed</div>
          <div className="weekday">Thu</div>
          <div className="weekday">Fri</div>
          <div className="weekday">Sat</div>
          {Array.from({ length: firstWeekday }, (_, i) => (
            <div className="calendar-blank" key={`blank-${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1
            const dayTx = txs.filter((t) => Number(t.date.slice(-2)) === day)
            const dayBill = bills.filter((b) => Number(b.date.slice(-2)) === day)
            const dayPlan = plannedDates.filter((item) => Number(item.date.slice(-2)) === day)
            const payday = paydays.some((date) => Number(date.slice(-2)) === day)
            return (
              <button
                key={day}
                className={`calendar-day ${chosen === day ? 'selected' : ''} ${today.getDate() === day && today.getMonth() === number - 1 && today.getFullYear() === year ? 'today' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <span>{day}</span>
                <div className="calendar-dots">
                  {dayTx.some((t) => t.type === 'income') && <i className="income-dot" />}
                  {payday && <i className="payday-dot" />}
                  {dayTx.some((t) => t.type === 'expense') && <i className="expense-dot" />}
                  {dayBill.length > 0 && <i className="bill-dot" />}
                  {dayPlan.length > 0 && <i className="plan-dot" />}
                </div>
              </button>
            )
          })}
        </div>
        <div className="calendar-key">
          <span>
            <i className="payday-dot" /> Expected pay
          </span>
          <span>
            <i className="income-dot" /> Income
          </span>
          <span>
            <i className="expense-dot" /> Spending
          </span>
          <span>
            <i className="bill-dot" /> Bill
          </span>
          <span>
            <i className="plan-dot" /> Budget date
          </span>
        </div>
      </section>
      <div className="calendar-side">
        <section className="panel payday-panel">
          <SectionHead
            title="Your paydays"
            help="Pick one real payday. Pockit counts forward and backward from it, so a biweekly schedule shows two cheques in most months and three in some. Expected pay is a plan; record each actual deposit in Activity."
          />
          <div className="payday-summary">
            <span>
              <Icon name="Wallet" size={20} />{' '}
              {paydays.length
                ? `${paydays.length} expected ${paydays.length === 1 ? 'cheque' : 'cheques'}`
                : 'Add a payday'}
            </span>
            <strong>{money(paySummary.income, data.settings.currency)}</strong>
            <small>
              {paydays.length
                ? paydays.map((date) => Number(date.slice(-2))).join(' · ')
                : data.profile.plannedMonthlyIncome !== undefined
                  ? 'Showing the Waypoint monthly plan until you set a date.'
                  : 'Showing your monthly average until you set a date.'}
            </small>
          </div>
          <div className="form-grid">
            <Field label="Each paycheque">
              <input
                type="number"
                min="0"
                step="0.01"
                value={data.profile.payAmount || ''}
                onChange={(event) =>
                  setPayProfile({ payAmount: Math.max(0, Number(event.target.value) || 0) })
                }
              />
            </Field>
            <Field label="How often">
              <select
                value={data.profile.payFrequency}
                onChange={(event) =>
                  setPayProfile({ payFrequency: event.target.value as Frequency })
                }
              >
                <option value="weekly">Every week</option>
                <option value="biweekly">Every two weeks</option>
                <option value="twice-monthly">Twice a month</option>
                <option value="monthly">Every month</option>
              </select>
            </Field>
            {data.profile.payFrequency === 'twice-monthly' ? (
              <>
                {[0, 1].map((index) => (
                  <Field key={index} label={`${index === 0 ? 'First' : 'Second'} day of the month`}>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={data.profile.paydayDays?.[index] ?? (index === 0 ? 1 : 15)}
                      onChange={(event) => {
                        const days: [number, number] = [...(data.profile.paydayDays || [1, 15])]
                        days[index] = Math.min(
                          31,
                          Math.max(1, Math.floor(Number(event.target.value) || 1)),
                        )
                        setPayProfile({ paydayDays: days })
                      }}
                    />
                  </Field>
                ))}
              </>
            ) : (
              <Field label="One real payday">
                <input
                  type="date"
                  value={data.profile.paydayAnchor || ''}
                  onChange={(event) =>
                    setPayProfile({
                      paydayAnchor: validISODate(event.target.value) ? event.target.value : '',
                    })
                  }
                />
              </Field>
            )}
          </div>
          {data.profile.plannedMonthlyIncome !== undefined && paydays.length > 0 && (
            <p className="payday-note">
              Your dated schedule now sets the monthly total. The old Waypoint monthly estimate
              stays saved as a fallback if you remove the date.
            </p>
          )}
        </section>
        <section className="panel">
          <SectionHead
            title={`${new Intl.DateTimeFormat('en-CA', { month: 'long' }).format(new Date(year, number - 1, 1))} ${chosen}`}
          />
          <div className="day-agenda">
            {dayPayCount > 0 && (
              <div className="agenda-item payday-agenda">
                <div className="agenda-icon income">
                  <Icon name="Wallet" size={19} />
                </div>
                <div>
                  <strong>Expected pay{dayPayCount > 1 ? ` × ${dayPayCount}` : ''}</strong>
                  <small>Scheduled · add the real deposit in Activity</small>
                </div>
                <strong>
                  {money(data.profile.payAmount * dayPayCount, data.settings.currency, true)}
                </strong>
              </div>
            )}
            {dayBills.map((b) => (
              <div className="agenda-item" key={b.id}>
                <div className="agenda-icon bill">
                  <Icon name="CalendarClock" size={19} />
                </div>
                <div>
                  <strong>{b.name}</strong>
                  <small>
                    Bill · {b.paid ? 'Recorded' : b.skipped ? 'Skipped' : 'Due'} ·{' '}
                    {b.frequency || 'monthly'}
                  </small>
                </div>
                <strong>{money(b.amount, data.settings.currency, true)}</strong>
                {data.transactions.some(
                  (transaction) =>
                    transaction.billId === b.id && transaction.date.slice(0, 7) === month,
                ) ? (
                  <button
                    className="paid-button"
                    onClick={() => {
                      const linked = data.transactions.find(
                        (transaction) =>
                          transaction.billId === b.id && transaction.date.slice(0, 7) === month,
                      )
                      if (linked) update((d) => changeTransaction(d, linked, null))
                    }}
                  >
                    Undo payment
                  </button>
                ) : (
                  <button className="mark-button" onClick={() => recordPayment(b, b.date)}>
                    <Icon name="Check" size={15} /> Record payment
                  </button>
                )}
                {!b.paid && (
                  <button className="text-button" onClick={() => skipReminder(b.id)}>
                    {b.skipped ? 'Restore reminder' : 'Skip this reminder'}
                  </button>
                )}
              </div>
            ))}
            {dayPlans.map((item) => (
              <div className="agenda-item" key={`plan-${item.category.id}`}>
                <div className="agenda-icon bill">
                  <Icon name={item.category.icon} size={19} />
                </div>
                <div>
                  <strong>{item.category.name}</strong>
                  <small>Budget payment date · confirm or add a bill for reminders</small>
                </div>
                <strong>{money(item.amount, data.settings.currency, true)}</strong>
              </div>
            ))}
            {dayTxs.map((t) => (
              <div className="agenda-item" key={t.id}>
                <div className={`agenda-icon ${t.type}`}>
                  <Icon
                    name={
                      t.type === 'income'
                        ? 'ArrowDownLeft'
                        : t.type === 'transfer'
                          ? 'ArrowLeftRight'
                          : 'ArrowUpRight'
                    }
                    size={19}
                  />
                </div>
                <div>
                  <strong>{t.payee}</strong>
                  <small>{t.type}</small>
                </div>
                <strong>{money(t.amount, data.settings.currency, true)}</strong>
              </div>
            ))}
            {dayBills.length + dayTxs.length + dayPlans.length + dayPayCount === 0 && (
              <Empty
                icon="CalendarDays"
                title="A quiet day"
                text="Nothing recorded for this date."
              />
            )}
          </div>
        </section>
        <section className="panel">
          <SectionHead
            title="Next 7 days"
            help="Upcoming unpaid bills and budget payment dates from today through the next six days. Budget dates are plans; add a bill to track payment."
          />
          {upcoming.length > 0 && (
            <div className="upcoming-list">
              {upcoming.map((b) => (
                <div className="upcoming-row" key={`${b.id}-${b.month}`}>
                  <div className="upcoming-date">
                    <strong>{b.date.getDate()}</strong>
                    <small>
                      {new Intl.DateTimeFormat('en-CA', { weekday: 'short' }).format(b.date)}
                    </small>
                  </div>
                  <div>
                    <strong>{b.name}</strong>
                    <small>Bill due</small>
                  </div>
                  <strong>{money(b.amount, data.settings.currency, true)}</strong>
                </div>
              ))}
            </div>
          )}
          {upcoming.length === 0 && plannedUpcoming.length === 0 && (
            <Empty
              icon="CalendarCheck2"
              title="Clear week ahead"
              text="No unpaid bills due in the next seven days."
            />
          )}
          {plannedUpcoming.length > 0 && (
            <div className="upcoming-list" aria-label="Budget dates in the next seven days">
              {plannedUpcoming.map((item) => (
                <div
                  className="upcoming-row"
                  key={`plan-${item.category.id}-${item.date.toISOString()}`}
                >
                  <div className="upcoming-date">
                    <strong>{item.date.getDate()}</strong>
                    <small>
                      {new Intl.DateTimeFormat('en-CA', { weekday: 'short' }).format(item.date)}
                    </small>
                  </div>
                  <div>
                    <strong>{item.category.name}</strong>
                    <small>Budget payment date · not a bill</small>
                  </div>
                  <strong>{money(item.amount, data.settings.currency, true)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {editing && (
        <Modal
          title={data.bills.some((b) => b.id === editing.id) ? 'Edit bill' : 'Add a bill'}
          onClose={() => setEditing(null)}
        >
          <div className="modal-body">
            <Field label="Bill name">
              <input
                autoFocus
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Internet"
              />
            </Field>
            <div className="form-grid">
              <Field label="Amount">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editing.amount || ''}
                  onChange={(e) => setEditing({ ...editing, amount: num(e.target.value) })}
                />
              </Field>
              <Field label="Day of month">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editing.day || ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      day: e.target.value ? Math.min(31, Math.max(1, Number(e.target.value))) : 0,
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Category">
              <select
                value={editing.categoryId || ''}
                onChange={(e) =>
                  setEditing({ ...editing, categoryId: e.target.value || undefined })
                }
              >
                <option value="">No category</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="When paid, record as">
              <select
                value={editing.paymentType || 'expense'}
                onChange={(event) =>
                  setEditing({ ...editing, paymentType: event.target.value as Bill['paymentType'] })
                }
              >
                <option value="expense">Expense: a new cost</option>
                <option value="transfer">Transfer: paying a card or moving money</option>
              </select>
            </Field>
            {editing.paymentType === 'transfer' && (
              <div className="soft-note">
                Card purchases count as expenses when they happen. Paying the card later moves money
                and must not count the purchases again.
              </div>
            )}
            {(data.accounts || []).filter((account) => !account.archived).length > 0 && (
              <div className="form-grid">
                <Field label="Pay from account">
                  <select
                    value={editing.accountId || ''}
                    onChange={(event) =>
                      setEditing({ ...editing, accountId: event.target.value || undefined })
                    }
                  >
                    <option value="">Default chequing account</option>
                    {data.accounts
                      ?.filter((account) => !account.archived)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </Field>
                {editing.paymentType === 'transfer' && (
                  <Field label="Move to account">
                    <select
                      value={editing.toAccountId || ''}
                      onChange={(event) =>
                        setEditing({ ...editing, toAccountId: event.target.value || undefined })
                      }
                    >
                      <option value="">Outside Pockit</option>
                      {data.accounts
                        ?.filter((account) => !account.archived && account.id !== editing.accountId)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
              </div>
            )}
            <div className="form-grid">
              <Field label="Repeats">
                <select
                  value={editing.frequency || 'monthly'}
                  onChange={(e) =>
                    setEditing({ ...editing, frequency: e.target.value as Bill['frequency'] })
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Every 3 months</option>
                  <option value="yearly">Yearly</option>
                </select>
              </Field>
              <Field label="Starts in">
                <input
                  type="month"
                  value={editing.starts || month}
                  onChange={(e) => setEditing({ ...editing, starts: e.target.value as MonthKey })}
                />
              </Field>
            </div>
            <div className="soft-note">
              Record payment when money leaves your account. Skipping only hides this reminder; it
              does not change your spending.
            </div>
            <div className="modal-actions">
              {data.bills.some((b) => b.id === editing.id) && (
                <button className="danger-button" onClick={remove}>
                  Delete
                </button>
              )}
              <button
                className="primary-button"
                onClick={save}
                disabled={
                  !editing.name.trim() ||
                  editing.amount <= 0 ||
                  !Number.isInteger(editing.day) ||
                  editing.day < 1 ||
                  editing.day > 31 ||
                  (editing.paymentType === 'transfer' &&
                    !!editing.accountId &&
                    editing.accountId === editing.toAccountId)
                }
              >
                Save bill
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
