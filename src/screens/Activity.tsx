import { num } from '../lib/numbers'
import { useMemo, useState } from 'react'
import type { MonthKey, PockitData, Transaction, TransactionType } from '../types'
import {
  categorizePayee,
  money,
  receiptFields,
  recurringMerchants,
  todayISO,
  transactionsInMonth,
} from '../lib/finance'
import { Empty, Field, Icon, Modal, SectionHead } from '../components/UI'

const blank = (): Transaction => ({
  id: crypto.randomUUID(),
  date: todayISO(),
  payee: '',
  amount: 0,
  type: 'expense',
})
export function ActivityScreen({
  data,
  month,
  update,
}: {
  data: PockitData
  month: MonthKey
  update: (recipe: (value: PockitData) => PockitData) => void
}) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | TransactionType>('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('newest')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanError, setScanError] = useState('')
  const monthTxs = transactionsInMonth(data.transactions, month)
  const counts = {
    all: monthTxs.length,
    income: monthTxs.filter((t) => t.type === 'income').length,
    expense: monthTxs.filter((t) => t.type === 'expense').length,
    transfer: monthTxs.filter((t) => t.type === 'transfer').length,
  }
  const filtered = useMemo(
    () =>
      monthTxs
        .filter(
          (t) =>
            (type === 'all' || t.type === type) &&
            (category === 'all' || t.categoryId === category) &&
            `${t.payee} ${t.note || ''}`.toLowerCase().includes(search.toLowerCase()),
        )
        .sort((a, b) => {
          if (sort === 'oldest') return a.date.localeCompare(b.date)
          if (sort === 'highest') return b.amount - a.amount
          if (sort === 'lowest') return a.amount - b.amount
          if (sort === 'payee') return a.payee.localeCompare(b.payee)
          if (sort === 'category')
            return (data.categories.find((c) => c.id === a.categoryId)?.name || '').localeCompare(
              data.categories.find((c) => c.id === b.categoryId)?.name || '',
            )
          return b.date.localeCompare(a.date)
        }),
    [monthTxs, type, category, search, sort, data.categories],
  )
  const subscriptions = data.settings.smart ? recurringMerchants(data.transactions) : []
  const setDraft = (patch: Partial<Transaction>) => setEditing((d) => (d ? { ...d, ...patch } : d))
  function save() {
    if (!editing?.payee.trim() || editing.amount <= 0) return
    const value = { ...editing, payee: editing.payee.trim() }
    update((d) => ({
      ...d,
      transactions: d.transactions.some((t) => t.id === value.id)
        ? d.transactions.map((t) => (t.id === value.id ? value : t))
        : [...d.transactions, value],
    }))
    setEditing(null)
  }
  function remove() {
    if (!editing || !window.confirm(`Delete ${editing.payee}?`)) return
    update((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== editing.id) }))
    setEditing(null)
  }
  async function scan(file: File) {
    setScanBusy(true)
    setScanError('')
    try {
      const { recognize } = await import('tesseract.js')
      const result = await recognize(file, 'eng')
      const fields = receiptFields(result.data.text)
      setDraft({
        payee: fields.payee || editing?.payee || '',
        amount: fields.amount || editing?.amount || 0,
        receiptName: file.name,
      })
      if (!fields.amount) setScanError('Could not read a total. Please enter the amount yourself.')
    } catch {
      setScanError('Could not read this image. Please enter the details yourself.')
    } finally {
      setScanBusy(false)
    }
  }
  return (
    <div className="screen-stack">
      <div className="activity-toolbar">
        <div className="search-box">
          <Icon name="Search" size={19} />
          <input
            placeholder="Search transactions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className="primary-button"
          onClick={() =>
            setEditing({
              ...blank(),
              date: `${month}-${String(Math.min(new Date().getDate(), new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate())).padStart(2, '0')}`,
            })
          }
        >
          <Icon name="Plus" size={18} /> Add transaction
        </button>
      </div>
      <div className="filter-row">
        <div className="segmented">
          {(['all', 'income', 'expense', 'transfer'] as const).map((item) => (
            <button
              key={item}
              className={type === item ? 'active' : ''}
              onClick={() => setType(item)}
            >
              {item[0].toUpperCase() + item.slice(1)} <span>{counts[item]}</span>
            </button>
          ))}
        </div>
        <div className="filter-selects">
          <select
            aria-label="Filter category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort transactions"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest amount</option>
            <option value="lowest">Lowest amount</option>
            <option value="payee">Payee A–Z</option>
            <option value="category">Category A–Z</option>
          </select>
          <button
            className="reset-button"
            onClick={() => {
              setSearch('')
              setType('all')
              setCategory('all')
              setSort('newest')
            }}
          >
            Reset
          </button>
        </div>
      </div>
      {subscriptions.length > 0 && (
        <div className="insight-strip">
          <Icon name="Repeat2" size={20} />
          <span>
            <strong>Recurring charges spotted:</strong>{' '}
            {subscriptions.map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())).join(', ')}
          </span>
        </div>
      )}
      <section className="panel transaction-panel">
        <SectionHead
          title="Transactions"
          help="Add income, expenses, and transfers. Transfers move money between accounts or goals and do not count as spending."
          aside={<span className="count-label">{filtered.length} shown</span>}
        />
        {filtered.length ? (
          <div className="transaction-list">
            {filtered.map((t) => {
              const c = data.categories.find((c) => c.id === t.categoryId)
              return (
                <button className="transaction-row" key={t.id} onClick={() => setEditing(t)}>
                  <div
                    className="transaction-icon"
                    style={{ background: c ? `${c.color}22` : undefined, color: c?.color }}
                  >
                    <Icon
                      name={
                        t.type === 'income'
                          ? 'ArrowDownLeft'
                          : t.type === 'transfer'
                            ? 'ArrowLeftRight'
                            : c?.icon || 'Receipt'
                      }
                      size={19}
                    />
                  </div>
                  <div className="transaction-name">
                    <strong>{t.payee}</strong>
                    <small>
                      {c?.name || t.type[0].toUpperCase() + t.type.slice(1)} ·{' '}
                      {new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(
                        new Date(`${t.date}T12:00:00`),
                      )}
                    </small>
                  </div>
                  <span className={t.type === 'income' ? 'positive' : ''}>
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                    {money(t.amount, data.settings.currency)}
                  </span>
                  <Icon name="ChevronRight" className="row-arrow" size={17} />
                </button>
              )
            })}
          </div>
        ) : (
          <Empty
            icon="ReceiptText"
            title="No transactions found"
            text={
              monthTxs.length
                ? 'Try resetting your search and filters.'
                : 'Start with an expense or your latest paycheque.'
            }
            action={
              <button className="text-button" onClick={() => setEditing(blank())}>
                Add a transaction <Icon name="ArrowRight" size={16} />
              </button>
            }
          />
        )}
      </section>
      {editing && (
        <Modal
          title={
            data.transactions.some((t) => t.id === editing.id)
              ? 'Edit transaction'
              : 'New transaction'
          }
          onClose={() => setEditing(null)}
        >
          <div className="modal-body">
            <div className="segmented full">
              {(['expense', 'income', 'transfer'] as const).map((item) => (
                <button
                  key={item}
                  className={editing.type === item ? 'active' : ''}
                  onClick={() => setDraft({ type: item })}
                >
                  {item[0].toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
            <Field label="Payee or description">
              <input
                autoFocus
                value={editing.payee}
                onChange={(e) => {
                  const payee = e.target.value
                  setDraft({
                    payee,
                    categoryId:
                      data.settings.smart && !editing.categoryId
                        ? categorizePayee(payee, data.categories)
                        : editing.categoryId,
                  })
                }}
                placeholder="e.g. Fresh Market"
              />
            </Field>
            <div className="form-grid">
              <Field label="Amount">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={editing.amount || ''}
                  onChange={(e) => setDraft({ amount: num(e.target.value) })}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Date">
                <input
                  type="date"
                  value={editing.date}
                  onChange={(e) => setDraft({ date: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Category">
              <select
                value={editing.categoryId || ''}
                onChange={(e) => setDraft({ categoryId: e.target.value || undefined })}
              >
                <option value="">No category</option>
                {data.categories
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Note (optional)">
              <textarea
                rows={2}
                value={editing.note || ''}
                onChange={(e) => setDraft({ note: e.target.value })}
                placeholder="Anything you want to remember"
              />
            </Field>
            {data.settings.smart && editing.type === 'expense' && (
              <label className="receipt-upload">
                <Icon name="ScanLine" size={20} />
                <span>
                  {scanBusy
                    ? 'Reading receipt…'
                    : editing.receiptName
                      ? `Receipt: ${editing.receiptName}`
                      : 'Scan receipt on this device'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={scanBusy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void scan(file)
                  }}
                />
              </label>
            )}
            {scanError && <div className="form-message">{scanError}</div>}
            <div className="modal-actions">
              {data.transactions.some((t) => t.id === editing.id) && (
                <button className="danger-button" onClick={remove}>
                  Delete
                </button>
              )}
              <button
                className="primary-button"
                onClick={save}
                disabled={!editing.payee.trim() || editing.amount <= 0}
              >
                Save transaction
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
