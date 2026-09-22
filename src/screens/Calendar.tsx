import { num } from '../lib/numbers'
import { useState } from 'react'
import type { Bill, MonthKey, PockitData } from '../types'
import { billsForMonth, money, transactionsInMonth } from '../lib/finance'
import { Empty, Field, Icon, Modal, SectionHead } from '../components/UI'

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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const seven = new Date(today)
  seven.setDate(seven.getDate() + 7)
  const upcoming = data.bills
    .flatMap((bill) => {
      const dates = [
        new Date(
          today.getFullYear(),
          today.getMonth(),
          Math.min(bill.day, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()),
        ),
        new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          Math.min(bill.day, new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()),
        ),
      ]
      return dates
        .filter((date) => date >= today && date < seven)
        .map((date) => ({
          ...bill,
          date,
          month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        }))
    })
    .filter((b) => !b.paidMonths.includes(b.month))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
  const chosen =
    selectedDay ||
    (month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
      ? today.getDate()
      : 1)
  const dayTxs = txs.filter((t) => Number(t.date.slice(-2)) === chosen)
  const dayBills = bills.filter((b) => Number(b.date.slice(-2)) === chosen)
  function save() {
    if (!editing?.name.trim() || editing.amount <= 0) return
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
  function togglePaid(id: string) {
    update((d) => ({
      ...d,
      bills: d.bills.map((b) =>
        b.id === id
          ? {
              ...b,
              paidMonths: b.paidMonths.includes(month)
                ? b.paidMonths.filter((m) => m !== month)
                : [...b.paidMonths, month],
            }
          : b,
      ),
    }))
  }
  return (
    <div className="calendar-layout">
      <section className="panel calendar-panel">
        <SectionHead
          title="Your calendar"
          help="Expense and income dots come from transactions. Bill markers come from bills you add here."
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
            return (
              <button
                key={day}
                className={`calendar-day ${chosen === day ? 'selected' : ''} ${today.getDate() === day && today.getMonth() === number - 1 && today.getFullYear() === year ? 'today' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <span>{day}</span>
                <div className="calendar-dots">
                  {dayTx.some((t) => t.type === 'income') && <i className="income-dot" />}
                  {dayTx.some((t) => t.type === 'expense') && <i className="expense-dot" />}
                  {dayBill.length > 0 && <i className="bill-dot" />}
                </div>
              </button>
            )
          })}
        </div>
        <div className="calendar-key">
          <span>
            <i className="income-dot" /> Income
          </span>
          <span>
            <i className="expense-dot" /> Spending
          </span>
          <span>
            <i className="bill-dot" /> Bill
          </span>
        </div>
      </section>
      <div className="calendar-side">
        <section className="panel">
          <SectionHead
            title={`${new Intl.DateTimeFormat('en-CA', { month: 'long' }).format(new Date(year, number - 1, 1))} ${chosen}`}
          />
          <div className="day-agenda">
            {dayBills.map((b) => (
              <div className="agenda-item" key={b.id}>
                <div className="agenda-icon bill">
                  <Icon name="CalendarClock" size={19} />
                </div>
                <div>
                  <strong>{b.name}</strong>
                  <small>Bill · {b.paid ? 'Paid' : 'Due'}</small>
                </div>
                <strong>{money(b.amount, data.settings.currency, true)}</strong>
                <button
                  className={b.paid ? 'paid-button' : 'mark-button'}
                  onClick={() => togglePaid(b.id)}
                >
                  {b.paid ? 'Undo' : 'Paid'}
                </button>
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
            {dayBills.length + dayTxs.length === 0 && (
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
            help="Upcoming unpaid bills from today through the next six days."
          />
          {upcoming.length ? (
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
          ) : (
            <Empty
              icon="CalendarCheck2"
              title="Clear week ahead"
              text="No unpaid bills due in the next seven days."
            />
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
                  value={editing.day}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      day: Math.min(31, Math.max(1, Number(e.target.value))),
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
            <div className="soft-note">
              Bills are reminders. Add the payment as a transaction in Activity when it happens.
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
                disabled={!editing.name.trim() || editing.amount <= 0}
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
