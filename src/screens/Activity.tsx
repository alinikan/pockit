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
import { inferCSVMapping, parseCSV, previewCSV, type CSVMapping, type CSVPreview } from '../lib/csv'
import { unreviewedTransactions } from '../lib/ledger'

const blank = (): Transaction => ({
  id: crypto.randomUUID(),
  date: todayISO(),
  payee: '',
  amount: 0,
  type: 'expense',
})
const dateInMonth = (month: MonthKey) =>
  `${month}-${String(Math.min(new Date().getDate(), new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate())).padStart(2, '0')}`
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
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvMapping, setCsvMapping] = useState<CSVMapping | null>(null)
  const [importAccountId, setImportAccountId] = useState('')
  const [selectedMatches, setSelectedMatches] = useState<string[]>([])
  const [suspectPage, setSuspectPage] = useState(0)
  const [rememberMerchant, setRememberMerchant] = useState(false)
  const [undo, setUndo] = useState<{
    before: Transaction | null
    after: Transaction | null
    message: string
  } | null>(null)
  useEffect(() => {
    if (quickAdd > 0)
      setEditing({
        ...blank(),
        date: dateInMonth(month),
        accountId: data.accounts?.find((account) => account.kind === 'chequing')?.id,
      })
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
  const importBatches = [
    ...new Set(data.transactions.map((transaction) => transaction.importBatchId).filter(Boolean)),
  ]
  const lastImportBatch = importBatches.at(-1)
  const review = unreviewedTransactions(data).sort((a, b) => b.date.localeCompare(a.date))
  const recent = [...data.transactions]
    .filter((transaction) => transaction.type === 'expense' && !transaction.refund)
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
    if (
      editing.splits?.length &&
      Math.abs(editing.splits.reduce((sum, split) => sum + split.amount, 0) - editing.amount) >
        0.001
    )
      return
    const before = data.transactions.find((transaction) => transaction.id === editing.id) || null
    const value = {
      ...editing,
      payee: editing.payee.trim(),
      createdAt: editing.createdAt || new Date().toISOString(),
      reviewed: true,
      source: editing.source || 'manual',
    }
    if (before?.goalId) {
      const goal = data.goals.find((item) => item.id === before.goalId)
      if (
        goal &&
        (goal.kind === 'debt' ||
          (goal.kind === 'saving' && value.type === 'expense' && !value.refund)) &&
        value.amount > goal.balance + before.amount
      )
        return
    }
    update((d) => {
      const next = changeTransaction(d, before, value)
      return rememberMerchant && value.categoryId
        ? {
            ...next,
            settings: {
              ...next.settings,
              merchantRules: [
                ...(next.settings.merchantRules || []).filter(
                  (rule) => rule.payee !== value.payee.toLowerCase(),
                ),
                { payee: value.payee.toLowerCase(), categoryId: value.categoryId },
              ],
            },
          }
        : next
    })
    setUndo({
      before,
      after: value,
      message: before ? 'Transaction updated.' : 'Transaction added.',
    })
    setEditing(null)
    setRememberMerchant(false)
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
      setCsvText(text)
      const headers = parseCSV(text)[0] || []
      setCsvHeaders(headers)
      const mapping = inferCSVMapping(headers)
      setCsvMapping(mapping)
      setPreview(previewCSV(text, data.transactions, data.categories, mapping, importAccountId))
      setSelectedMatches([])
      setSuspectPage(0)
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read this CSV.')
    }
  }
  function refreshPreview(mapping: CSVMapping, accountId = importAccountId) {
    setCsvMapping(mapping)
    setImportAccountId(accountId)
    setSelectedMatches([])
    setSuspectPage(0)
    try {
      setPreview(previewCSV(csvText, data.transactions, data.categories, mapping, accountId))
      setImportError('')
    } catch (error) {
      setPreview(null)
      setImportError(error instanceof Error ? error.message : 'Check the selected columns.')
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
                date: dateInMonth(month),
                accountId: data.accounts?.find((account) => account.kind === 'chequing')?.id,
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
                  date: dateInMonth(month),
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
      {lastImportBatch && (
        <div className="undo-strip" role="status">
          {
            data.transactions.filter((transaction) => transaction.importBatchId === lastImportBatch)
              .length
          }{' '}
          entries from your latest CSV import.
          <button
            onClick={() => {
              if (
                !window.confirm(
                  'Remove every entry from this CSV import? This also removes any edits made to those entries.',
                )
              )
                return
              update((current) => ({
                ...current,
                transactions: current.transactions.filter(
                  (transaction) => transaction.importBatchId !== lastImportBatch,
                ),
              }))
            }}
          >
            Undo this import
          </button>
        </div>
      )}
      {review.length > 0 && (
        <section className="panel review-inbox" aria-label="Transactions to review">
          <SectionHead
            title={`${review.length} to review`}
            help="Imported transactions wait here until you confirm them. Check the category, account, and any possible refund before approving."
          />
          {review.slice(0, 5).map((transaction) => (
            <div className="review-line" key={transaction.id}>
              <span>
                <strong>{transaction.payee}</strong>
                <small>
                  {transaction.date} · {money(transaction.amount)}
                </small>
              </span>
              <button className="secondary-button compact" onClick={() => setEditing(transaction)}>
                Check details
              </button>
              <button
                className="primary-button compact"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    transactions: current.transactions.map((item) =>
                      item.id === transaction.id ? { ...item, reviewed: true } : item,
                    ),
                  }))
                }
              >
                Approve
              </button>
            </div>
          ))}
          {review.length > 5 && <small>Showing five. Approved items leave this list.</small>}
        </section>
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
            <strong>Possible recurring charges:</strong>{' '}
            {subscriptions.map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())).join(', ')}
          </span>
          <div className="subscription-actions">
            {subscriptions
              .filter((payee) => !data.bills.some((bill) => bill.name.toLowerCase() === payee))
              .slice(0, 3)
              .map((payee) => {
                const latest = data.transactions
                  .filter(
                    (transaction) =>
                      transaction.type === 'expense' &&
                      transaction.payee.trim().toLowerCase() === payee,
                  )
                  .sort((a, b) => b.date.localeCompare(a.date))[0]
                return (
                  <button
                    className="text-button"
                    key={payee}
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        bills: [
                          ...current.bills,
                          {
                            id: crypto.randomUUID(),
                            name: latest.payee,
                            amount: latest.amount,
                            day: Number(latest.date.slice(-2)),
                            categoryId: latest.categoryId,
                            frequency: 'monthly',
                            starts: month,
                            paidMonths: [],
                          },
                        ],
                      }))
                    }
                  >
                    Remind me about {latest.payee}
                  </button>
                )
              })}
          </div>
          <span className="insight-hint">
            These are suggestions from repeated amounts and dates. Check the reminder in Calendar.
          </span>
        </div>
      )}
      <section className="panel transaction-panel">
        <SectionHead
          title="Transactions"
          help="Record purchases as expenses, refunds as money returned, and money moved between your own accounts as transfers. A credit-card payment is a transfer; the card purchase is the expense."
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
                      {t.splits?.length
                        ? 'Split expense'
                        : c?.name ||
                          (t.refund ? 'Refund' : t.type[0].toUpperCase() + t.type.slice(1))}{' '}
                      ·{' '}
                      {new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(
                        new Date(`${t.date}T12:00:00`),
                      )}
                    </small>
                  </div>
                  <span className={t.type === 'income' ? 'positive' : ''}>
                    {t.type === 'income' || t.refund ? '+' : t.type === 'expense' ? '−' : ''}
                    {money(t.amount, data.settings.currency)}
                  </span>
                  {t.reviewed === false && <span className="review-badge">Review</span>}
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
              <button
                className="text-button"
                onClick={() => setEditing({ ...blank(), date: dateInMonth(month) })}
              >
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
                      data.settings.merchantRules?.find(
                        (rule) => rule.payee === payee.trim().toLowerCase(),
                      )?.categoryId ||
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
            {data.accounts?.length ? (
              <div className="form-grid">
                <Field label={editing.type === 'transfer' ? 'From account' : 'Account'}>
                  <select
                    value={editing.accountId || ''}
                    onChange={(e) => setDraft({ accountId: e.target.value || undefined })}
                  >
                    <option value="">Not assigned</option>
                    {data.accounts
                      .filter((account) => !account.archived)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </Field>
                {editing.type === 'transfer' && (
                  <Field label="To account">
                    <select
                      value={editing.toAccountId || ''}
                      onChange={(e) => setDraft({ toAccountId: e.target.value || undefined })}
                    >
                      <option value="">Outside Pockit / goal</option>
                      {data.accounts
                        .filter((account) => !account.archived && account.id !== editing.accountId)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
              </div>
            ) : (
              <div className="soft-note">
                Add a manual account in More to track and reconcile balances.
              </div>
            )}
            {editing.type === 'expense' && (
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={!!editing.refund}
                  onChange={(e) => setDraft({ refund: e.target.checked })}
                />{' '}
                This is a refund or return
              </label>
            )}
            <Field label="Category">
              <select
                value={editing.categoryId || ''}
                onChange={(e) =>
                  setDraft({ categoryId: e.target.value || undefined, splits: undefined })
                }
                disabled={!!editing.splits?.length}
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
            {editing.type === 'expense' && !editing.goalId && !editing.billId && (
              <>
                <button
                  className="text-button"
                  onClick={() =>
                    setDraft({
                      splits: editing.splits?.length
                        ? undefined
                        : [
                            {
                              categoryId: editing.categoryId || data.categories[0]?.id || '',
                              amount: editing.amount,
                            },
                          ],
                      categoryId: undefined,
                    })
                  }
                >
                  {editing.splits?.length ? 'Use one category' : 'Split between categories'}
                </button>
                {editing.splits?.map((split, index) => (
                  <div className="form-grid" key={index}>
                    <Field label={`Split ${index + 1} category`}>
                      <select
                        value={split.categoryId}
                        onChange={(e) =>
                          setDraft({
                            splits: editing.splits!.map((item, i) =>
                              i === index ? { ...item, categoryId: e.target.value } : item,
                            ),
                          })
                        }
                      >
                        {data.categories
                          .filter((category) => !category.archived)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Amount">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={split.amount}
                        onChange={(e) =>
                          setDraft({
                            splits: editing.splits!.map((item, i) =>
                              i === index ? { ...item, amount: num(e.target.value) } : item,
                            ),
                          })
                        }
                      />
                    </Field>
                  </div>
                ))}
                {editing.splits?.length && (
                  <>
                    <button
                      className="text-button"
                      onClick={() =>
                        setDraft({
                          splits: [
                            ...editing.splits!,
                            { categoryId: data.categories[0]?.id || '', amount: 0 },
                          ],
                        })
                      }
                    >
                      + Add another category
                    </button>
                    <div className="soft-note">
                      Split total:{' '}
                      {money(editing.splits.reduce((sum, split) => sum + split.amount, 0))} of{' '}
                      {money(editing.amount)}. The totals must match.
                    </div>
                  </>
                )}
              </>
            )}
            {editing.type === 'expense' && editing.categoryId && (
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={rememberMerchant}
                  onChange={(e) => setRememberMerchant(e.target.checked)}
                />{' '}
                Remember this category for this payee
              </label>
            )}
            {editing.reviewed === false && (
              <div className="soft-note">
                Imported transaction awaiting review. Saving confirms its details.
              </div>
            )}
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
                  (!!editing.splits?.length &&
                    (editing.splits.some((split) => !split.categoryId || split.amount <= 0) ||
                      Math.abs(
                        editing.splits.reduce((sum, split) => sum + split.amount, 0) -
                          editing.amount,
                      ) > 0.001)) ||
                  (editing.type === 'transfer' &&
                    !!editing.accountId &&
                    editing.accountId === editing.toAccountId) ||
                  (!!editing.goalId &&
                    data.goals.some(
                      (goal) =>
                        goal.id === editing.goalId &&
                        (goal.kind === 'debt' ||
                          (goal.kind === 'saving' &&
                            editing.type === 'expense' &&
                            !editing.refund)) &&
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
              Choose a CSV. Match its columns below, then review the results. Negative Amount means
              expense; positive Amount means income unless Type says otherwise. Refunds are money
              returned to a spending category. The file is read on this device.
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
            {csvHeaders.length > 0 && csvMapping && (
              <section className="import-mapping" aria-label="Match CSV columns">
                <h3>Match your columns</h3>
                <p>
                  Use Amount for one signed column, or Debit and Credit for separate columns.
                  Reference ID helps prevent importing the same bank entry twice.
                </p>
                <div className="form-grid">
                  {(
                    [
                      ['date', 'Date'],
                      ['payee', 'Description'],
                      ['amount', 'Signed amount'],
                      ['debit', 'Debit'],
                      ['credit', 'Credit'],
                      ['type', 'Type'],
                      ['reference', 'Reference ID'],
                    ] as [keyof CSVMapping, string][]
                  ).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <select
                        value={csvMapping[key]}
                        onChange={(e) =>
                          refreshPreview({ ...csvMapping, [key]: Number(e.target.value) })
                        }
                      >
                        <option value={-1}>Not in file</option>
                        {csvHeaders.map((header, index) => (
                          <option key={index} value={index}>
                            {header || `Column ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
                {data.accounts?.length ? (
                  <Field label="Import into account">
                    <select
                      value={importAccountId}
                      onChange={(e) => refreshPreview(csvMapping, e.target.value)}
                    >
                      <option value="">Not assigned</option>
                      {data.accounts
                        .filter((account) => !account.archived)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                ) : (
                  <small>You can add a manual account in More later.</small>
                )}
              </section>
            )}
            {importError && (
              <div className="form-message" role="alert">
                {importError}
              </div>
            )}
            {preview && (
              <>
                <div className="import-summary">
                  {preview.transactions.length -
                    preview.possibleDuplicateIds.length +
                    selectedMatches.length}{' '}
                  selected · {preview.duplicates} possible matches to review ·{' '}
                  {preview.exactDuplicates} matching reference IDs skipped · {preview.errors.length}{' '}
                  rows need review
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
                {preview.possibleDuplicateIds.length > 0 && (
                  <section
                    className="duplicate-review"
                    aria-label="Possible duplicate transactions"
                  >
                    <h3>Check possible matches</h3>
                    <p>
                      These look like existing entries or another row in this file. They are
                      excluded until you choose to include them. Two real purchases can have the
                      same date and amount.
                    </p>
                    <div className="duplicate-actions">
                      <button
                        className="text-button"
                        onClick={() => setSelectedMatches(preview.possibleDuplicateIds)}
                      >
                        Include all
                      </button>
                      <button className="text-button" onClick={() => setSelectedMatches([])}>
                        Exclude all
                      </button>
                    </div>
                    {preview.transactions
                      .filter((transaction) =>
                        preview.possibleDuplicateIds.includes(transaction.id),
                      )
                      .slice(suspectPage * 20, suspectPage * 20 + 20)
                      .map((transaction) => (
                        <label key={transaction.id} className="check-line">
                          <input
                            type="checkbox"
                            checked={selectedMatches.includes(transaction.id)}
                            onChange={(e) =>
                              setSelectedMatches((current) =>
                                e.target.checked
                                  ? [...current, transaction.id]
                                  : current.filter((id) => id !== transaction.id),
                              )
                            }
                          />{' '}
                          {transaction.date} · {transaction.payee} · {money(transaction.amount)}
                        </label>
                      ))}
                    {preview.possibleDuplicateIds.length > 20 && (
                      <div className="duplicate-actions">
                        <button
                          disabled={suspectPage === 0}
                          onClick={() => setSuspectPage((page) => page - 1)}
                        >
                          Previous
                        </button>
                        <span>
                          Page {suspectPage + 1} of{' '}
                          {Math.ceil(preview.possibleDuplicateIds.length / 20)}
                        </span>
                        <button
                          disabled={(suspectPage + 1) * 20 >= preview.possibleDuplicateIds.length}
                          onClick={() => setSuspectPage((page) => page + 1)}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </section>
                )}
                <div className="modal-actions">
                  <button
                    className="primary-button"
                    disabled={
                      !preview.transactions.length ||
                      preview.transactions.length -
                        preview.possibleDuplicateIds.length +
                        selectedMatches.length ===
                        0
                    }
                    onClick={() => {
                      const batchId = crypto.randomUUID()
                      update((d) => ({
                        ...d,
                        transactions: [
                          ...d.transactions,
                          ...preview.transactions
                            .filter(
                              (transaction) =>
                                (!preview.possibleDuplicateIds.includes(transaction.id) ||
                                  selectedMatches.includes(transaction.id)) &&
                                (!transaction.sourceId ||
                                  !d.transactions.some(
                                    (entry) => entry.sourceId === transaction.sourceId,
                                  )),
                            )
                            .map((transaction) => ({ ...transaction, importBatchId: batchId })),
                        ],
                      }))
                      setImportOpen(false)
                      setPreview(null)
                    }}
                  >
                    Import selected transactions
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
