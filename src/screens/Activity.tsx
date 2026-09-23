import { num, validISODate } from '../lib/numbers'
import { useEffect, useMemo, useState } from 'react'
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
import { changeTransaction } from '../lib/linked'
import { previewCSV, type CSVPreview } from '../lib/csv'

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
  quickAdd = 0,
}: {
  data: PockitData
  month: MonthKey
  update: (recipe: (value: PockitData) => PockitData) => void
  quickAdd?: number
}) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState<'all' | TransactionType>('all')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('newest')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanError, setScanError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importError, setImportError] = useState('')
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<CSVPreview | null>(null)
  const [undo, setUndo] = useState<{
    before: Transaction | null
    after: Transaction | null
    message: string
  } | null>(null)
  useEffect(() => {
    if (quickAdd > 0) setEditing(blank())
  }, [quickAdd])
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
  const recent = [...data.transactions]
    .filter((transaction) => transaction.type === 'expense')
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(
      (transaction, index, list) =>
        list.findIndex((item) => item.payee.toLowerCase() === transaction.payee.toLowerCase()) ===
        index,
    )
    .slice(0, 4)
  const setDraft = (patch: Partial<Transaction>) => setEditing((d) => (d ? { ...d, ...patch } : d))
  function save() {
    if (!editing?.payee.trim() || editing.amount <= 0 || !validISODate(editing.date)) return
    const before = data.transactions.find((transaction) => transaction.id === editing.id) || null
    const value = {
      ...editing,
      payee: editing.payee.trim(),
      createdAt: editing.createdAt || new Date().toISOString(),
    }
    if (before?.goalId) {
      const goal = data.goals.find((item) => item.id === before.goalId)
      if (goal?.kind === 'debt' && value.amount > goal.balance + before.amount) return
    }
    update((d) => changeTransaction(d, before, value))
    setUndo({
      before,
      after: value,
      message: before ? 'Transaction updated.' : 'Transaction added.',
    })
    setEditing(null)
  }
  function remove() {
    if (!editing || !window.confirm(`Delete ${editing.payee}?`)) return
    update((d) => changeTransaction(d, editing, null))
    setUndo({ before: editing, after: null, message: 'Transaction deleted.' })
    setEditing(null)
  }
  function undoLast() {
    if (!undo) return
    update((d) => {
      const current =
        d.transactions.find((transaction) => transaction.id === (undo.after || undo.before)?.id) ||
        null
      if (JSON.stringify(current) !== JSON.stringify(undo.after)) return d
      return changeTransaction(d, undo.after, undo.before)
    })
    setUndo(null)
  }
  async function readCSV(file: File) {
    setImportError('')
    setPreview(null)
    try {
      if (file.size > 2_000_000) throw new Error('Choose a CSV smaller than 2 MB.')
      const text = await file.text()
      const result = previewCSV(text, data.transactions, data.categories)
      setCsvText(text)
      setPreview(result)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read this CSV.')
    }
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
        <div className="activity-actions">
          <button className="secondary-button" onClick={() => setImportOpen(true)}>
            <Icon name="FileUp" size={17} /> Import CSV
          </button>
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
      </div>
      {recent.length > 0 && (
        <div className="recent-merchants">
          <span>Quick repeat</span>
          {recent.map((transaction) => (
            <button
              key={transaction.id}
              onClick={() =>
                setEditing({
                  ...blank(),
                  date: `${month}-${String(Math.min(new Date().getDate(), new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate())).padStart(2, '0')}`,
                  payee: transaction.payee,
                  amount: transaction.amount,
                  categoryId: transaction.categoryId,
                })
              }
            >
              {transaction.payee}
            </button>
          ))}
        </div>
      )}
      {undo && (
        <div className="undo-strip" role="status">
          {undo.message} <button onClick={undoLast}>Undo</button>
        </div>
      )}
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
                  disabled={!!editing.goalId || !!editing.billId}
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
                      data.transactions.find(
                        (transaction) =>
                          transaction.payee.trim().toLowerCase() === payee.trim().toLowerCase() &&
                          transaction.categoryId,
                      )?.categoryId ||
                      (data.settings.smart && !editing.categoryId
                        ? categorizePayee(payee, data.categories)
                        : editing.categoryId),
                  })
                }}
                placeholder="e.g. Fresh Market"
              />
            </Field>
            {editing.goalId && (
              <div className="soft-note">
                Linked to a goal. Changing its amount or date also updates goal progress. Deleting
                this transaction undoes the linked progress.
              </div>
            )}
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
                disabled={
                  !editing.payee.trim() ||
                  editing.amount <= 0 ||
                  !validISODate(editing.date) ||
                  (!!editing.goalId &&
                    data.goals.some(
                      (goal) =>
                        goal.id === editing.goalId &&
                        goal.kind === 'debt' &&
                        editing.amount >
                          goal.balance +
                            (data.transactions.find((transaction) => transaction.id === editing.id)
                              ?.amount || 0),
                    ))
                }
              >
                Save transaction
              </button>
            </div>
          </div>
        </Modal>
      )}
      {importOpen && (
        <Modal title="Import transactions" onClose={() => setImportOpen(false)} wide>
          <div className="modal-body">
            <p className="modal-description">
              Choose a CSV with Date, Description or Payee, and Amount or Debit/Credit columns.
              Negative Amount means expense; positive Amount means income unless a Type column says
              otherwise. Review the preview before importing. Files stay in this browser.
            </p>
            <Field label="Bank CSV file">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void readCSV(file)
                }}
              />
            </Field>
            {importError && (
              <div className="form-message" role="alert">
                {importError}
              </div>
            )}
            {preview && (
              <>
                <div className="import-summary">
                  {preview.transactions.length} ready · {preview.duplicates} duplicates skipped ·{' '}
                  {preview.errors.length} rows need review
                </div>
                {preview.errors.length > 0 && (
                  <div className="import-errors" role="alert">
                    {preview.errors.slice(0, 5).join(' ')}
                    {preview.errors.length > 5 ? ' See your CSV for more rows.' : ''}
                  </div>
                )}
                <div className="import-preview">
                  {preview.transactions.slice(0, 8).map((transaction) => (
                    <div key={transaction.id}>
                      <span>
                        {transaction.date} · {transaction.payee}
                      </span>
                      <strong>
                        {transaction.type} · {money(transaction.amount, data.settings.currency)}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="modal-actions">
                  <button
                    className="primary-button"
                    disabled={!preview.transactions.length}
                    onClick={() => {
                      update((d) => ({
                        ...d,
                        transactions: [
                          ...d.transactions,
                          ...previewCSV(csvText, d.transactions, d.categories).transactions,
                        ],
                      }))
                      setImportOpen(false)
                      setPreview(null)
                    }}
                  >
                    Import {preview.transactions.length} transactions
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
