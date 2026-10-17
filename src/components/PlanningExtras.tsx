import { useState } from 'react'
import type { MonthKey, PockitData, Project, Subscription } from '../types'
import { Field, Icon, Modal, SectionHead } from './UI'
import { annualSubscriptionCost, subscriptionDates } from '../lib/forecast'
import {
  addDays,
  applySpendingSuggestion,
  previousCompleteMonths,
  projectTotals,
  spendingSuggestions,
} from '../lib/experience'
import { canRestoreChange, restoreChange } from '../lib/changeHistory'
import { money, monthLabel, todayISO } from '../lib/finance'
import { validISODate } from '../lib/numbers'
type Props = { data: PockitData; update: (recipe: (data: PockitData) => PockitData) => void }
export function ProjectsPanel({ data, update }: Props) {
  const [draft, setDraft] = useState<Project | null>(null),
    [error, setError] = useState('')
  const [costName, setCostName] = useState(''),
    [costAmount, setCostAmount] = useState(''),
    [costDate, setCostDate] = useState(todayISO())
  return (
    <section className="panel experience-panel">
      <SectionHead
        title="Trips & projects"
        help="A project gathers expenses across months, such as a trip or home repair. Its budget is a spending limit. A linked goal shows savings separately, so saving and spending are not counted twice."
        aside={
          <button
            className="primary-button compact"
            disabled={(data.projects || []).length >= 200}
            onClick={() => {
              setError('')
              setDraft({
                id: crypto.randomUUID(),
                name: '',
                budget: 0,
                start: todayISO(),
                end: addDays(todayISO(), 30),
                costs: [],
              })
            }}
          >
            <Icon name="Plus" size={17} />
            Add project
          </button>
        }
      />
      <p className="panel-subtitle">
        One place for a trip, renovation, or another bigger plan. Choose the project under More
        details when entering an expense.
      </p>
      {(data.projects || []).length === 0 && (
        <p className="soft-note">
          No projects yet. Start with a trip or a purchase you are planning.
        </p>
      )}
      {(data.projects || []).map((project) => {
        const total = projectTotals(data, project.id)!
        return (
          <article className="project-card" key={project.id}>
            <div className="tool-list-row">
              <span>
                <strong>{project.name}</strong>
                <small>
                  {project.start} – {project.end}
                </small>
              </span>
              <button
                className="text-button"
                onClick={() => {
                  setDraft({ ...project, costs: project.costs.map((cost) => ({ ...cost })) })
                  setError('')
                }}
              >
                Edit project
              </button>
            </div>
            <div className="project-metrics">
              <span>
                Recorded spending<strong>{money(total.spent)}</strong>
              </span>
              <span>
                Budget left
                <strong className={total.remaining < 0 ? 'warning-text' : ''}>
                  {money(total.remaining)}
                </strong>
              </span>
              <span>
                After upcoming estimates
                <strong className={total.afterUpcoming < 0 ? 'warning-text' : ''}>
                  {money(total.afterUpcoming)}
                </strong>
              </span>
            </div>
            {total.goal && (
              <p className="goal-form-note">
                Linked savings: {total.goal.name} · {money(total.goal.balance)} saved. This is
                separate from recorded expenses.
              </p>
            )}
            <details>
              <summary>Upcoming costs & recorded entries</summary>
              {project.costs.map((cost) => (
                <label className="tool-list-row" key={cost.id}>
                  <input
                    type="checkbox"
                    checked={cost.paid}
                    onChange={(event) =>
                      update((current) => ({
                        ...current,
                        projects: (current.projects || []).map((item) =>
                          item.id === project.id
                            ? {
                                ...item,
                                costs: item.costs.map((entry) =>
                                  entry.id === cost.id
                                    ? { ...entry, paid: event.target.checked }
                                    : entry,
                                ),
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                  <span>
                    {cost.name}
                    <small>
                      {cost.date} ·{' '}
                      {cost.paid ? 'Already included in recorded spending' : 'Upcoming estimate'}
                    </small>
                  </span>
                  <strong>{money(cost.amount)}</strong>
                </label>
              ))}
              <p className="goal-form-note">
                Check a cost only after it is included in your recorded spending. This removes its
                future estimate without creating another expense.
              </p>
              {total.entries.map((entry) => (
                <div className="tool-list-row" key={entry.id}>
                  <span>
                    {entry.payee}
                    <small>
                      {entry.date} · {entry.type}
                    </small>
                  </span>
                  <strong>{money(entry.amount)}</strong>
                </div>
              ))}
            </details>
          </article>
        )
      })}
      {draft && (
        <Modal
          title={
            data.projects?.some((item) => item.id === draft.id) ? 'Edit project' : 'New project'
          }
          onClose={() => setDraft(null)}
        >
          <div className="modal-body">
            <Field label="Project name">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="e.g. Vancouver Island trip"
              />
            </Field>
            <Field label="Total spending budget in CAD">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.budget || ''}
                onChange={(event) => setDraft({ ...draft, budget: Number(event.target.value) })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Project starts">
                <input
                  type="date"
                  value={draft.start}
                  onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                />
              </Field>
              <Field label="Project ends">
                <input
                  type="date"
                  min={draft.start}
                  value={draft.end}
                  onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Linked savings goal">
              <select
                value={draft.goalId || ''}
                onChange={(event) =>
                  setDraft({ ...draft, goalId: event.target.value || undefined })
                }
              >
                <option value="">No linked goal</option>
                {data.goals
                  .filter((item) => item.kind === 'saving')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
            <details>
              <summary>Add upcoming cost estimates</summary>
              {draft.costs.map((cost) => (
                <div key={cost.id} className="tool-list-row">
                  <span>
                    {cost.name}
                    <small>{cost.date}</small>
                  </span>
                  <strong>{money(cost.amount)}</strong>
                  <button
                    className="text-button"
                    aria-label={`Remove ${cost.name} estimate`}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        costs: draft.costs.filter((item) => item.id !== cost.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <Field label="Upcoming cost name">
                <input value={costName} onChange={(event) => setCostName(event.target.value)} />
              </Field>
              <Field label="Upcoming cost amount">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={costAmount}
                  onChange={(event) => setCostAmount(event.target.value)}
                />
              </Field>
              <Field label="Upcoming cost date">
                <input
                  type="date"
                  value={costDate}
                  onChange={(event) => setCostDate(event.target.value)}
                />
              </Field>
              <button
                className="secondary-button"
                disabled={
                  !costName.trim() ||
                  !validISODate(costDate) ||
                  !Number.isFinite(Number(costAmount)) ||
                  Number(costAmount) <= 0
                }
                onClick={() => {
                  setDraft({
                    ...draft,
                    costs: [
                      ...draft.costs,
                      {
                        id: crypto.randomUUID(),
                        name: costName.trim(),
                        amount: Number(costAmount),
                        date: costDate,
                        paid: false,
                      },
                    ],
                  })
                  setCostName('')
                  setCostAmount('')
                }}
              >
                Add cost estimate
              </button>
            </details>
            {error && (
              <p className="form-message" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {data.projects?.some((item) => item.id === draft.id) && (
                <button
                  className="danger-button"
                  onClick={() => {
                    update((current) => ({
                      ...current,
                      projects: current.projects?.filter((item) => item.id !== draft.id),
                    }))
                    setDraft(null)
                  }}
                >
                  Remove project
                </button>
              )}
              <button
                className="primary-button"
                onClick={() => {
                  if (
                    !draft.name.trim() ||
                    !Number.isFinite(draft.budget) ||
                    draft.budget < 0 ||
                    !validISODate(draft.start) ||
                    !validISODate(draft.end) ||
                    draft.end < draft.start
                  ) {
                    setError('Enter a name, valid budget, and an end date on or after the start.')
                    return
                  }
                  update((current) => ({
                    ...current,
                    projects: [
                      ...(current.projects || []).filter((item) => item.id !== draft.id),
                      { ...draft, name: draft.name.trim() },
                    ],
                  }))
                  setDraft(null)
                }}
              >
                Save project
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
export function SubscriptionsPanel({ data, update }: Props) {
  const [draft, setDraft] = useState<Subscription | null>(null),
    [error, setError] = useState('')
  const total = (data.subscriptions || []).reduce(
    (sum, item) => sum + annualSubscriptionCost(item),
    0,
  )
  return (
    <section className="panel experience-panel">
      <SectionHead
        title="Subscriptions & trials"
        help="Track renewals, trial endings, cancellation deadlines, and price changes. These are reminders and estimates. Nothing is matched to a transaction or cancelled for you."
        aside={
          <button
            className="primary-button compact"
            disabled={(data.subscriptions || []).length >= 200}
            onClick={() => {
              setDraft({
                id: crypto.randomUUID(),
                name: '',
                amount: 0,
                period: 'monthly',
                renewalDate: addDays(todayISO(), 30),
              })
              setError('')
            }}
          >
            <Icon name="Plus" size={17} />
            Add subscription
          </button>
        }
      />
      <div className="tool-result">
        <span>Annual cost at entered prices</span>
        <strong>{money(total)}</strong>
        <small>
          {money(total / 12)} per month on average. Trials and future prices depend on what you
          enter.
        </small>
      </div>
      {!(data.subscriptions || []).length && (
        <p className="soft-note">
          Add a subscription or free trial to keep its next decision date visible.
        </p>
      )}
      {(data.subscriptions || []).map((item) => (
        <article className="project-card" key={item.id}>
          <div className="tool-list-row">
            <span>
              <strong>{item.name}</strong>
              <small>
                Next renewal{' '}
                {subscriptionDates(item, todayISO(), addDays(todayISO(), 400))[0] ||
                  item.renewalDate}{' '}
                · {money(item.amount)}/{item.period === 'monthly' ? 'month' : 'year'}
              </small>
            </span>
            <button
              className="text-button"
              onClick={() => {
                setDraft({ ...item })
                setError('')
              }}
            >
              Edit {item.name}
            </button>
          </div>
          <p>{money(annualSubscriptionCost(item))}/year</p>
          {item.previousAmount !== undefined && item.previousAmount !== item.amount && (
            <p className={item.amount > item.previousAmount ? 'warning-text' : 'positive'}>
              Price {item.amount > item.previousAmount ? 'rose' : 'fell'} by{' '}
              {money(Math.abs(item.amount - item.previousAmount))} per billing period.
            </p>
          )}
          {item.trialEnd && <p className="goal-form-note">Trial ends {item.trialEnd}</p>}
          {item.cancelBy && (
            <p
              className={
                item.cancelBy <= addDays(todayISO(), 7) ? 'warning-text' : 'goal-form-note'
              }
            >
              Decide whether to cancel by {item.cancelBy}
              {item.cancelBy < todayISO() ? ' · deadline passed' : ''}
            </p>
          )}
        </article>
      ))}
      {draft && (
        <Modal title="Subscription details" onClose={() => setDraft(null)}>
          <div className="modal-body">
            <Field label="Subscription name">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
            <Field label="Price per billing period">
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.amount || ''}
                onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })}
              />
            </Field>
            <Field label="Billing period">
              <select
                value={draft.period}
                onChange={(event) =>
                  setDraft({ ...draft, period: event.target.value as Subscription['period'] })
                }
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </Field>
            <Field label="Next renewal date">
              <input
                type="date"
                value={draft.renewalDate}
                onChange={(event) => setDraft({ ...draft, renewalDate: event.target.value })}
              />
            </Field>
            <div className="form-grid">
              <Field label="Trial ends (optional)">
                <input
                  type="date"
                  value={draft.trialEnd || ''}
                  onChange={(event) =>
                    setDraft({ ...draft, trialEnd: event.target.value || undefined })
                  }
                />
              </Field>
              <Field label="Cancel by (optional)">
                <input
                  type="date"
                  value={draft.cancelBy || ''}
                  onChange={(event) =>
                    setDraft({ ...draft, cancelBy: event.target.value || undefined })
                  }
                />
              </Field>
            </div>
            <Field label="Paying account">
              <select
                value={draft.accountId || ''}
                onChange={(event) =>
                  setDraft({ ...draft, accountId: event.target.value || undefined })
                }
              >
                <option value="">Choose later</option>
                {data.accounts
                  ?.filter((item) => !item.archived)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Already planned as a bill">
              <select
                value={draft.billId || ''}
                onChange={(event) =>
                  setDraft({ ...draft, billId: event.target.value || undefined })
                }
              >
                <option value="">No existing bill — include this renewal in forecasts</option>
                {data.bills.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <p className="goal-form-note">
              Choosing an existing bill avoids listing the same scheduled cost twice in forecasts.
              It does not match or approve any Activity entry.
            </p>
            {error && (
              <p className="form-message" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              {data.subscriptions?.some((item) => item.id === draft.id) && (
                <button
                  className="danger-button"
                  onClick={() => {
                    update((current) => ({
                      ...current,
                      subscriptions: current.subscriptions?.filter((item) => item.id !== draft.id),
                    }))
                    setDraft(null)
                  }}
                >
                  Remove subscription
                </button>
              )}
              <button
                className="primary-button"
                onClick={() => {
                  if (
                    !draft.name.trim() ||
                    !Number.isFinite(draft.amount) ||
                    draft.amount < 0 ||
                    ![draft.renewalDate, ...[draft.trialEnd, draft.cancelBy].filter(Boolean)].every(
                      (date) => validISODate(date!),
                    )
                  ) {
                    setError('Enter a name, valid price and valid reminder dates.')
                    return
                  }
                  const old = data.subscriptions?.find((item) => item.id === draft.id)
                  const value = {
                    ...draft,
                    name: draft.name.trim(),
                    previousAmount:
                      old && old.amount !== draft.amount ? old.amount : draft.previousAmount,
                  }
                  update((current) => ({
                    ...current,
                    subscriptions: [
                      ...(current.subscriptions || []).filter((item) => item.id !== draft.id),
                      value,
                    ],
                  }))
                  setDraft(null)
                }}
              >
                Save subscription
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
export function HistoryPanel({ data, update }: Props) {
  const [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState('')
  const entry = data.changeLog?.find((item) => item.id === selected)
  return (
    <section className="panel experience-panel">
      <SectionHead
        title="Change history"
        help="Up to 150 recent record changes are saved with your budget, within a storage limit. Restoring an edit changes its related records together and is available only while those records still match that edit. Large import batches keep a summary; use their downloaded backup to restore the whole batch."
      />
      <p className="panel-subtitle">
        Review what changed, including linked goals, account details and budget categories.
      </p>
      {!data.changeLog?.length && (
        <p className="soft-note">
          New edits will appear here. Earlier versions of Pockit did not keep this history.
        </p>
      )}
      {data.changeLog?.map((item) => (
        <button
          key={item.id}
          className="history-row"
          onClick={() => {
            setSelected(item.id)
            setError('')
          }}
        >
          <Icon name="History" size={20} />
          <span>
            <strong>{item.label}</strong>
            <small>
              {new Date(item.time).toLocaleString()} ·{' '}
              {item.changes.length
                ? `${item.changes.length} related records`
                : 'Large batch summary'}
            </small>
          </span>
          <Icon name="ChevronRight" size={17} />
        </button>
      ))}
      {entry && (
        <Modal title="Review this edit" onClose={() => setSelected(null)}>
          <div className="modal-body">
            <strong>{entry.label}</strong>
            <p className="goal-form-note">{new Date(entry.time).toLocaleString()}</p>
            {entry.changes.map((change, index) => (
              <details key={`${change.collection}:${change.id}`} open={index === 0}>
                <summary>
                  {change.collection} ·{' '}
                  {((change.after || change.before) as { name?: string; payee?: string })?.name ||
                    ((change.after || change.before) as { payee?: string })?.payee ||
                    change.id}
                </summary>
                <div className="history-comparison">
                  <div>
                    <strong>Before</strong>
                    <HistoryRecord value={change.before} data={data} />
                  </div>
                  <div>
                    <strong>After</strong>
                    <HistoryRecord value={change.after} data={data} />
                  </div>
                </div>
              </details>
            ))}
            {!canRestoreChange(data, entry) && (
              <p className="soft-note">
                {entry.changes.length
                  ? 'A related record has changed since this edit. Restoring it would overwrite newer work.'
                  : 'This batch keeps a summary only. Use the backup downloaded before importing to restore the full batch.'}
              </p>
            )}
            {error && (
              <p className="form-message" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="primary-button"
                disabled={!canRestoreChange(data, entry)}
                onClick={() => {
                  try {
                    restoreChange(data, entry)
                    update((current) => restoreChange(current, entry))
                    setSelected(null)
                  } catch (cause) {
                    setError((cause as Error).message)
                  }
                }}
              >
                Restore these records
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
export function BudgetSuggestions({ data, month, update }: Props & { month: MonthKey }) {
  const [selected, setSelected] = useState<string | null>(null)
  const suggestions = spendingSuggestions(data, month),
    suggestion = suggestions.find((item) => item.category.id === selected)
  return (
    <details className="panel optional-tool">
      <summary>
        <Icon name="ChartNoAxesCombined" size={19} />
        Suggestions from your spending
      </summary>
      <p className="goal-form-note">
        Based on the median of your last 3–6 months marked complete. Project expenses are excluded.
        Suggestions change only after you review them.
      </p>
      {!suggestions.length && (
        <p className="soft-note">
          Mark at least three past months complete in Pockit Pulse. Suggestions appear when their
          typical spending differs from the current limit by at least $10.
        </p>
      )}
      {suggestions.map((item) => (
        <div className="tool-list-row" key={item.category.id}>
          <span>
            {item.category.name}
            <small>
              {item.months} complete months · typical {money(item.median)}
            </small>
          </span>
          <button className="text-button" onClick={() => setSelected(item.category.id)}>
            Review {money(item.suggested)}
          </button>
        </div>
      ))}
      {suggestion && (
        <Modal title="Review a budget suggestion" onClose={() => setSelected(null)}>
          <div className="modal-body">
            <strong>
              {suggestion.category.name}: {money(suggestion.current)} →{' '}
              {money(suggestion.suggested)} monthly
            </strong>
            <p className="goal-form-note">
              Starts in {monthLabel(month)}. This is your spending pattern, not a recommended living
              cost. Check upcoming changes before accepting it.
            </p>
            <button
              className="primary-button"
              onClick={() => {
                update((current) =>
                  applySpendingSuggestion(
                    current,
                    suggestion.category.id,
                    suggestion.suggested,
                    month,
                  ),
                )
                setSelected(null)
              }}
            >
              Use this monthly amount
            </button>
          </div>
        </Modal>
      )}
    </details>
  )
}
export function MonthReview({ data, month, update }: Props & { month: MonthKey }) {
  const [selected, setSelected] = useState(previousCompleteMonths(month)[0])
  const complete = data.settings.completeMonths?.includes(selected) || false
  return (
    <details className="month-review">
      <summary>Confirm a complete month for better comparisons</summary>
      <p className="goal-form-note">
        Only you can confirm that all purchases, refunds and income have been entered. This label is
        your confirmation, not a bank check.
      </p>
      <Field label="Month to review">
        <input
          type="month"
          value={selected}
          max={previousCompleteMonths(month)[0]}
          onChange={(event) => setSelected(event.target.value as MonthKey)}
        />
      </Field>
      <button
        className="secondary-button"
        disabled={!/^\d{4}-(0[1-9]|1[0-2])$/.test(selected) || selected >= month}
        onClick={() =>
          update((current) => ({
            ...current,
            settings: {
              ...current.settings,
              completeMonths: complete
                ? (current.settings.completeMonths || []).filter((item) => item !== selected)
                : [...new Set([...(current.settings.completeMonths || []), selected])],
            },
          }))
        }
      >
        {complete ? 'Remove complete label' : 'Mark this month complete'}
      </button>
    </details>
  )
}

function HistoryRecord({ value, data }: { value: unknown; data: PockitData }) {
  if (!value) return <p className="goal-form-note">No record</p>
  const record = value as Record<string, unknown>
  const labels: Record<string, string> = {
    name: 'Name',
    payee: 'Description',
    amount: 'Amount',
    date: 'Date',
    type: 'Type',
    balance: 'Goal balance',
    monthly: 'Monthly plan',
    baseAmount: 'Amount each period',
    openingBalance: 'Starting account balance',
    asOf: 'Balance date',
    frequency: 'Frequency',
    mode: 'Budget behaviour',
    budget: 'Project budget',
    start: 'Starts',
    end: 'Ends',
    renewalDate: 'Renewal',
    trialEnd: 'Trial ends',
    cancelBy: 'Cancel by',
    period: 'Billing period',
    archived: 'Archived',
    note: 'Note',
    notes: 'Notes',
    categoryId: 'Category',
    accountId: 'From account',
    toAccountId: 'To account',
    goalId: 'Linked goal',
    funding: 'Money assigned',
    changes: 'Period amounts from',
    overrides: 'Monthly exceptions',
    paidMonths: 'Paid months',
    history: 'Goal history',
  }
  const amounts = new Set([
    'amount',
    'balance',
    'monthly',
    'baseAmount',
    'openingBalance',
    'budget',
  ])
  function text(key: string, item: unknown): string {
    if (amounts.has(key) && typeof item === 'number') return money(item)
    if (key === 'categoryId')
      return data.categories.find((category) => category.id === item)?.name || 'Removed category'
    if (key === 'accountId' || key === 'toAccountId')
      return data.accounts?.find((account) => account.id === item)?.name || 'Untracked account'
    if (key === 'goalId') return data.goals.find((goal) => goal.id === item)?.name || 'Removed goal'
    if (key === 'funding' && Array.isArray(item))
      return (
        item
          .map(
            (entry) =>
              `${data.accounts?.find((account) => account.id === entry.accountId)?.name || 'Removed account'}: ${money(entry.amount)}`,
          )
          .join('; ') || 'None assigned'
      )
    if (key === 'history' && Array.isArray(item)) return `${item.length} entries`
    if ((key === 'changes' || key === 'overrides') && item && typeof item === 'object')
      return (
        Object.entries(item)
          .slice(-6)
          .map(([month, amount]) => `${month}: ${money(Number(amount))}`)
          .join('; ') || 'None'
      )
    if (Array.isArray(item)) return item.join(', ') || 'None'
    return typeof item === 'boolean' ? (item ? 'Yes' : 'No') : String(item)
  }
  return (
    <dl className="history-fields">
      {Object.entries(record)
        .filter(([key, value]) => labels[key] && value !== undefined)
        .map(([key, value]) => (
          <div key={key}>
            <dt>{labels[key]}</dt>
            <dd>{text(key, value)}</dd>
          </div>
        ))}
    </dl>
  )
}
