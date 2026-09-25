import { num } from '../lib/numbers'
import { useState } from 'react'
import type { Category, CategoryPolicy, Frequency, MonthKey, PockitData } from '../types'
import { newCategory } from '../lib/defaults'
import {
  beforeWaypointPlan,
  categoryActiveInMonth,
  categoryBudget,
  categoryPolicy,
  billMonthlyReserve,
  categoryPeriodAmount,
  money,
  monthLabel,
  monthSummary,
  monthlyPay,
  rolloverBalance,
  rolloverMonth,
  shiftMonth,
  spendingByCategory,
} from '../lib/finance'
import { Empty, Field, Icon, Modal, Progress, SectionHead } from '../components/UI'
import { coverOverspend } from '../lib/budgetMoves'

const groups = [
  'Food & Dining',
  'Bills & Utilities',
  'Transportation',
  'Savings & Goals',
  'Lifestyle',
]
export function BudgetScreen({
  data,
  month,
  update,
}: {
  data: PockitData
  month: MonthKey
  update: (recipe: (value: PockitData) => PockitData) => void
}) {
  const [editing, setEditing] = useState<Category | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [scope, setScope] = useState<'ongoing' | 'month'>('ongoing')
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [groupDraft, setGroupDraft] = useState<Record<string, string>>({})
  const [groupSelected, setGroupSelected] = useState<Record<string, boolean>>({})
  const [focusedSlice, setFocusedSlice] = useState<string | null>(null)
  const [coverId, setCoverId] = useState<string | null>(null)
  const [coverSource, setCoverSource] = useState('unallocated')
  const [coverAmount, setCoverAmount] = useState(0)
  const [coverMessage, setCoverMessage] = useState('')
  const [moveUndo, setMoveUndo] = useState<{ before: Category[]; after: Category[] } | null>(null)
  const summary = monthSummary(data, month)
  const historicalUnplanned =
    beforeWaypointPlan(data, month) &&
    !data.categories.some((category) => categoryActiveInMonth(category, month))
  const spend = spendingByCategory(data.transactions, month)
  const active = data.categories.filter((c) => !c.archived || (!!c.ends && month <= c.ends))
  const overages = active
    .map((category) => ({
      category,
      available:
        categoryPolicy(category, month).mode === 'rollover'
          ? rolloverBalance(category, data, month)
          : categoryBudget(category, month, summary.income) - (spend[category.id] || 0),
    }))
    .filter((entry) => month >= entry.category.starts && entry.available < -0.001)
  const irregular = data.bills
    .map((bill) => ({ bill, reserve: billMonthlyReserve(bill, month) }))
    .filter((entry) => entry.reserve !== null)
  const allocated = active.reduce((n, c) => n + categoryBudget(c, month, summary.income), 0)
  const chartColors = active.filter((c) => categoryBudget(c, month, summary.income) > 0)
  const focusedCategory = chartColors.find((category) => category.id === focusedSlice)
  let cursor = 0
  const slices = chartColors.map((c) => {
    const percent =
      (categoryBudget(c, month, summary.income) / Math.max(allocated, summary.income, 1)) * 100
    const part = `${c.color} ${cursor}% ${cursor + percent}%`
    cursor += percent
    return part
  })
  const donut = `conic-gradient(${[...slices, `var(--track) ${cursor}% 100%`].join(', ')})`
  function saveCategory() {
    if (!editing?.name.trim()) return
    const value: Category = {
      ...editing,
      name: editing.name.trim(),
      suggested: false,
      needsAmount: editing.baseAmount <= 0 && editing.needsAmount,
      starts: editing.starts > month ? month : editing.starts,
    }
    const original = data.categories.find((c) => c.id === value.id)
    const originalPolicy = original && categoryPolicy(original, month)
    const selectedPolicy: CategoryPolicy = {
      frequency: editing.frequency,
      paymentDay: editing.paymentDay,
      mode: editing.mode,
      targetType: editing.targetType,
      targetValue: editing.targetValue,
      funding: editing.funding,
    }
    if (
      original?.linkedGoalKind &&
      (editing.baseAmount !== categoryPeriodAmount(original, month) ||
        editing.frequency !== originalPolicy?.frequency ||
        editing.mode !== originalPolicy?.mode ||
        editing.targetType !== originalPolicy?.targetType ||
        editing.funding !== originalPolicy?.funding)
    )
      value.linkedGoalKind = undefined
    if (scope === 'month') {
      if (original) {
        Object.assign(value, {
          frequency: original.frequency,
          paymentDay: original.paymentDay,
          mode: original.mode,
          targetType: original.targetType,
          targetValue: original.targetValue,
          funding: original.funding,
        })
        value.policyChanges = original.policyChanges
      }
      value.policyOverrides = { ...original?.policyOverrides, [month]: selectedPolicy }
      value.overrides = { ...value.overrides }
      if (selectedPolicy.mode === 'rollover' && selectedPolicy.targetType !== 'fixed')
        delete value.overrides[month]
      else value.overrides[month] = monthlyPay(value.baseAmount, selectedPolicy.frequency)
      value.baseAmount = original?.baseAmount || 0
      value.changes = original?.changes || {}
    } else {
      value.policyOverrides = Object.fromEntries(
        Object.entries(value.policyOverrides || {}).filter(([key]) => key < month),
      )
      const earlierPolicies = Object.fromEntries(
        Object.entries(original?.policyChanges || {}).filter(([key]) => key < month),
      )
      if (original && month > original.starts) {
        if (!Object.keys(earlierPolicies).length)
          earlierPolicies[original.starts] = {
            frequency: original.frequency,
            paymentDay: original.paymentDay,
            mode: original.mode,
            targetType: original.targetType,
            targetValue: original.targetValue,
            funding: original.funding,
          }
        earlierPolicies[month] = selectedPolicy
      } else if (Object.keys(earlierPolicies).length) {
        earlierPolicies[month] = selectedPolicy
      }
      value.policyChanges = earlierPolicies
      value.overrides = Object.fromEntries(
        Object.entries(value.overrides).filter(([key]) => key < month),
      )
      value.changes = Object.fromEntries(
        Object.entries(value.changes || {}).filter(([key]) => key < month),
      )
      if (original && month > value.starts) {
        value.changes[month] = value.baseAmount
        value.baseAmount = original.baseAmount
      }
    }
    update((d) => ({
      ...d,
      categories: d.categories.some((c) => c.id === value.id)
        ? d.categories.map((c) => (c.id === value.id ? value : c))
        : [...d.categories, value],
    }))
    setEditing(null)
  }
  function openCategory(c: Category) {
    const policy = categoryPolicy(c, month)
    setEditing({
      ...c,
      ...policy,
      baseAmount: Object.hasOwn(c.overrides, month)
        ? c.overrides[month] / monthlyPay(1, policy.frequency)
        : categoryPeriodAmount(c, month),
    })
    setAdvanced(false)
    setScope(Object.hasOwn(c.overrides, month) ? 'month' : 'ongoing')
  }
  function removeCategory() {
    if (
      !editing ||
      !window.confirm(
        `Remove ${editing.name} from ${monthLabel(month)} onward? Earlier plans and transaction labels will stay. You can restore it later.`,
      )
    )
      return
    update((d) => ({
      ...d,
      categories: d.categories.map((c) =>
        c.id === editing.id ? { ...c, archived: true, ends: shiftMonth(month, -1) } : c,
      ),
    }))
    setEditing(null)
  }
  function openGroups() {
    setGroupDraft(Object.fromEntries(active.map((c) => [c.id, c.group])))
    setGroupSelected(Object.fromEntries(active.map((c) => [c.id, true])))
    setGroupsOpen(true)
  }
  function saveGroups() {
    update((d) => ({
      ...d,
      categories: d.categories.map((c) =>
        groupSelected[c.id] ? { ...c, group: groupDraft[c.id] || c.group } : c,
      ),
    }))
    setGroupsOpen(false)
  }
  function openCover(id: string, needed: number) {
    setCoverId(id)
    setCoverSource('unallocated')
    setCoverAmount(Math.round(needed * 100) / 100)
    setCoverMessage('')
  }
  function saveCover() {
    if (!coverId) return
    try {
      const next = coverOverspend(data, month, coverId, coverSource, coverAmount)
      setMoveUndo({ before: data.categories, after: next.categories })
      update((current) => coverOverspend(current, month, coverId, coverSource, coverAmount))
      setCoverId(null)
      setCoverMessage('')
    } catch (error) {
      setCoverMessage(error instanceof Error ? error.message : 'Could not move that amount.')
    }
  }
  return (
    <div className="screen-stack">
      {historicalUnplanned && (
        <p className="soft-note" role="status">
          Waypoint did not include the amounts you planned for this earlier month. Its transactions
          are available in Activity and Compare. Add a plan here only if you know what you used
          then.
        </p>
      )}
      {!historicalUnplanned && summary.income === 0 && (
        <p className="soft-note" role="status">
          No monthly income is planned. If the Waypoint export says $0 but you receive pay, set the
          expected amount in More → Your profile before planning with a percentage of income.
        </p>
      )}
      {!historicalUnplanned && (
        <div className="budget-overview">
          <div className="budget-info">
            <div className="eyebrow">MONTHLY PLAN</div>
            <h2>
              {money(summary.income, data.settings.currency, true)} <span>income</span>
            </h2>
            <div className="budget-info-stat">
              <span>Planned for categories</span>
              <strong>
                {money(allocated, data.settings.currency, true)} of{' '}
                {money(summary.income, data.settings.currency, true)}
              </strong>
            </div>
            <Progress
              value={summary.income ? (allocated / summary.income) * 100 : 0}
              color={allocated > summary.income ? 'var(--red)' : 'var(--lime)'}
            />
            <p>
              {allocated > summary.income
                ? `${money(allocated - summary.income, data.settings.currency, true)} over your income`
                : `${money(summary.income - allocated, data.settings.currency, true)} not yet planned`}{' '}
              ·{' '}
              {Math.max(
                0,
                Math.round(((summary.income - allocated) / Math.max(summary.income, 1)) * 100),
              )}
              % not yet planned
            </p>
          </div>
          <div className="donut-wrap">
            <div className="donut" style={{ background: donut }}>
              <div>
                <small>PLANNED FOR CATEGORIES</small>
                <strong>{money(allocated, data.settings.currency, true)}</strong>
                <span>
                  {allocated > summary.income
                    ? `${money(allocated - summary.income, data.settings.currency, true)} over expected pay`
                    : `${money(summary.income - allocated, data.settings.currency, true)} not yet planned`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="budget-legend">
        {chartColors.map((c) => (
          <button
            key={c.id}
            className={focusedSlice === c.id ? 'active' : ''}
            onClick={() => setFocusedSlice(c.id)}
            aria-label={`Inspect ${c.name} planned amount`}
          >
            <i style={{ background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>
      {focusedCategory && (
        <p className="budget-chart-detail" role="status">
          {focusedCategory.name}:{' '}
          {money(categoryBudget(focusedCategory, month, summary.income), data.settings.currency)}{' '}
          planned for {monthLabel(month)}.
        </p>
      )}
      {overages.length > 0 && (
        <section className="panel cover-panel" aria-label="Categories needing attention">
          <SectionHead
            title="Cover an overage"
            help="Move part of this month's unplanned money or another category's plan. No bank transfer happens. You can undo the move."
          />
          {overages.map(({ category, available }) => (
            <div className="cover-row" key={category.id}>
              <span
                className="category-badge"
                style={{ background: `${category.color}22`, color: category.color }}
              >
                <Icon name={category.icon} size={18} />
              </span>
              <span>
                <strong>{category.name}</strong>
                <small>{money(Math.abs(available))} over its available plan</small>
              </span>
              <button
                className="secondary-button compact"
                onClick={() => openCover(category.id, -available)}
              >
                Cover it
              </button>
            </div>
          ))}
        </section>
      )}
      {moveUndo && (
        <div className="undo-strip" role="status">
          Plan updated for {monthLabel(month)}.{' '}
          <button
            onClick={() => {
              update((current) =>
                JSON.stringify(current.categories) === JSON.stringify(moveUndo.after)
                  ? { ...current, categories: moveUndo.before }
                  : current,
              )
              setMoveUndo(null)
            }}
          >
            Undo
          </button>
        </div>
      )}
      {irregular.length > 0 && (
        <section className="panel irregular-panel" aria-label="Prepare for irregular bills">
          <SectionHead
            title="Prepare for later bills"
            help="Quarterly and yearly bills are easier to handle when you set a little aside each month. This estimate divides the bill across the months until it is next due. Adjust the linked budget category to match what you can afford; no money moves automatically."
          />
          {irregular.map(({ bill, reserve }) => (
            <div className="irregular-row" key={bill.id}>
              <Icon name="CalendarRange" size={20} />
              <span>
                <strong>{bill.name}</strong>
                <small>
                  {money(bill.amount)} due {monthLabel(reserve!.dueMonth)}
                </small>
              </span>
              <strong>{money(reserve!.perMonth)} / month</strong>
              {bill.categoryId &&
              data.categories.some((category) => category.id === bill.categoryId) ? (
                <button
                  className="secondary-button compact"
                  onClick={() =>
                    openCategory(
                      data.categories.find((category) => category.id === bill.categoryId)!,
                    )
                  }
                >
                  Review category
                </button>
              ) : (
                <button
                  className="secondary-button compact"
                  onClick={() => {
                    const category = newCategory(
                      `${bill.name} reserve`,
                      'CalendarRange',
                      'Bills & Utilities',
                      '#a9a3f5',
                      reserve!.perMonth,
                      month,
                    )
                    category.mode = 'rollover'
                    update((current) => ({
                      ...current,
                      categories: [...current.categories, category],
                      bills: current.bills.map((item) =>
                        item.id === bill.id ? { ...item, categoryId: category.id } : item,
                      ),
                    }))
                  }}
                >
                  Create reserve category
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      <section className="panel allocation-panel">
        <SectionHead
          title="Your monthly plan"
          help="A category's planned amount is what you expect to spend or set aside. Some categories start fresh each month; others carry unused money forward. These are planning numbers, not your bank balance."
          aside={
            <div className="section-actions">
              <button className="secondary-button compact" onClick={openGroups}>
                <Icon name="Folders" size={16} /> Sort into groups
              </button>
              <button
                className="primary-button compact"
                onClick={() =>
                  openCategory(newCategory('', 'Shapes', 'Lifestyle', '#a9d8c0', 0, month))
                }
              >
                <Icon name="Plus" size={16} /> Add category
              </button>
            </div>
          }
        />
        {active.some((category) => category.suggested || category.needsAmount) && (
          <div className="starter-budget-notice" role="note">
            <Icon name="MapPin" size={19} />
            <span>
              <strong>Check your starter amounts.</strong> Pockit used 2026 Vancouver examples for
              rent and transit, and general planning examples for other costs. Some payments start
              at $0 until you enter the real amount. Tap each category to enter what you pay or want
              to limit. We never shrink a bill just to make the plan fit your pay.
            </span>
          </div>
        )}
        <div className="allocation-list">
          {active.length ? (
            active.map((c) => {
              const planned = categoryBudget(c, month, summary.income)
              const used = spend[c.id] || 0
              const planUnavailable = month < c.starts
              const isRollover = categoryPolicy(c, month).mode === 'rollover'
              const left = isRollover ? rolloverBalance(c, data, month) : planned - used
              return (
                <button className="allocation-row" key={c.id} onClick={() => openCategory(c)}>
                  <div
                    className="category-badge"
                    style={{ background: `${c.color}22`, color: c.color }}
                  >
                    <Icon name={c.icon} size={19} />
                  </div>
                  <div className="allocation-main">
                    <div>
                      <strong>{c.name}</strong>
                      <small>
                        {c.group}
                        {isRollover ? ' · Unused money carries forward' : ''}
                        {c.needsAmount
                          ? ' · Add your amount'
                          : c.suggested
                            ? ' · Example amount'
                            : ''}
                        {c.linkedGoalKind ? ' · Follows Goals' : ''}
                      </small>
                    </div>
                    <div className="allocation-progress">
                      <Progress
                        value={
                          planUnavailable ? 0 : planned ? (used / planned) * 100 : used ? 100 : 0
                        }
                        color={
                          !planUnavailable && used > planned && !isRollover ? 'var(--red)' : c.color
                        }
                      />
                    </div>
                  </div>
                  <div className="allocation-values">
                    <strong>
                      {planUnavailable ? 'No plan' : money(planned, data.settings.currency, true)}
                    </strong>
                    <small className={!planUnavailable && left < 0 ? 'negative' : ''}>
                      {planUnavailable
                        ? `${money(used, data.settings.currency, true)} spent`
                        : `${money(left, data.settings.currency, true)} left`}
                    </small>
                  </div>
                  <Icon name="ChevronRight" size={17} className="row-arrow" />
                </button>
              )
            })
          ) : (
            <Empty
              icon="Layers3"
              title="No category amounts yet"
              text="Add a category, like Groceries, and choose an amount for this month."
            />
          )}
        </div>
        {data.categories.some(
          (category) => category.archived && category.ends && month > category.ends,
        ) && (
          <details className="archived-categories">
            <summary>Removed categories</summary>
            <p>
              Old transactions keep their category names. Restore a category to plan for it again.
            </p>
            {data.categories
              .filter((category) => category.archived && category.ends && month > category.ends)
              .map((category) => (
                <button
                  key={category.id}
                  className="secondary-button compact"
                  onClick={() =>
                    update((d) => ({
                      ...d,
                      categories: d.categories.map((item) =>
                        item.id === category.id
                          ? { ...item, archived: false, ends: undefined }
                          : item,
                      ),
                    }))
                  }
                >
                  Restore {category.name}
                </button>
              ))}
          </details>
        )}
      </section>
      {editing && (
        <Modal
          title={
            data.categories.some((c) => c.id === editing.id) ? 'Edit category' : 'New category'
          }
          onClose={() => setEditing(null)}
          wide
        >
          <div className="modal-body">
            {data.categories.some(
              (category) =>
                category.id === editing.id && categoryPolicy(category, month).mode === 'rollover',
            ) &&
              (() => {
                const savedCategory = data.categories.find(
                  (category) => category.id === editing.id,
                )!
                const balance = rolloverMonth(savedCategory, data, month)
                return (
                  <div
                    className="rollover-breakdown"
                    aria-label={`${editing.name} balance in ${monthLabel(month)}`}
                  >
                    <strong>How this month’s balance adds up</strong>
                    <span>
                      Carried from last month <b>{money(balance.carried)}</b>
                    </span>
                    <span>
                      {categoryPolicy(savedCategory, month).funding === 'manual'
                        ? 'Added by recorded transfers'
                        : 'Added by this month’s plan'}{' '}
                      <b>{money(balance.added)}</b>
                    </span>
                    <span>
                      Spent this month <b>{money(balance.spent)}</b>
                    </span>
                    <span>
                      Available now <b>{money(balance.available)}</b>
                    </span>
                    <small>
                      Changing a past plan or transaction updates this and future months
                      automatically. These amounts are budget tracking, not a bank balance.
                    </small>
                  </div>
                )
              })()}
            <div className="form-grid">
              <Field label="Category name">
                <input
                  autoFocus
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Groceries"
                />
              </Field>
              <Field label="Group">
                <select
                  value={editing.group}
                  onChange={(e) => setEditing({ ...editing, group: e.target.value })}
                >
                  {groups.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-grid">
              <Field label="Amount to plan each period">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={editing.baseAmount || ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      baseAmount: num(e.target.value),
                      targetValue: num(e.target.value),
                    })
                  }
                  placeholder="0.00"
                />
              </Field>
              <Field label="How often">
                <select
                  value={editing.frequency}
                  onChange={(e) =>
                    setEditing({ ...editing, frequency: e.target.value as Frequency })
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="twice-monthly">Twice a month</option>
                  <option value="biweekly">Every two weeks</option>
                  <option value="weekly">Weekly</option>
                </select>
              </Field>
            </div>
            {editing.linkedGoalKind && (
              <p className="soft-note">
                This amount follows your monthly{' '}
                {editing.linkedGoalKind === 'saving' ? 'saving' : 'debt'} payments in Goals. Enter a
                different amount here if you want this category to have its own plan.
              </p>
            )}
            <Field
              label="Payment day (optional)"
              hint="For bills, add an upcoming bill in Calendar too."
            >
              <input
                type="number"
                min="1"
                max="31"
                value={editing.paymentDay || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    paymentDay: e.target.value
                      ? Math.min(31, Math.max(1, Number(e.target.value)))
                      : undefined,
                  })
                }
                placeholder="e.g. 15"
              />
            </Field>
            <button className="advanced-toggle" onClick={() => setAdvanced(!advanced)}>
              More choices <Icon name={advanced ? 'ChevronUp' : 'ChevronDown'} size={17} />
            </button>
            {advanced && (
              <div className="advanced-content">
                <div className="field">
                  <span>When the period ends, unspent money…</span>
                  <div className="option-pair">
                    <button
                      className={editing.mode === 'fresh' ? 'selected' : ''}
                      onClick={() => setEditing({ ...editing, mode: 'fresh' })}
                    >
                      <Icon name="RefreshCcw" />
                      <strong>Starts fresh</strong>
                      <small>
                        Start with the same amount each period. Good for groceries and gas.
                      </small>
                    </button>
                    <button
                      className={editing.mode === 'rollover' ? 'selected' : ''}
                      onClick={() => setEditing({ ...editing, mode: 'rollover' })}
                    >
                      <Icon name="Layers3" />
                      <strong>Rolls over</strong>
                      <small>Keep unused money for a later trip, repair, or cushion.</small>
                    </button>
                  </div>
                </div>
                {editing.mode === 'rollover' && (
                  <>
                    <Field label="How much to add each period">
                      <select
                        value={editing.targetType}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            targetType: e.target.value as Category['targetType'],
                            funding: e.target.value === 'none' ? 'manual' : editing.funding,
                          })
                        }
                      >
                        <option value="fixed">Fixed amount each period</option>
                        <option value="percent">% of income</option>
                        <option value="none">No set amount, just track the balance</option>
                      </select>
                    </Field>
                    {editing.targetType === 'percent' && (
                      <Field label="Percent of monthly income">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={editing.targetValue || ''}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              targetValue: Math.min(100, num(e.target.value)),
                            })
                          }
                        />
                      </Field>
                    )}
                    {editing.targetType !== 'none' && (
                      <Field label="How will you add money?">
                        <select
                          value={editing.funding}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              funding: e.target.value as Category['funding'],
                            })
                          }
                        >
                          <option value="auto">Add from my planned income</option>
                          <option value="manual">I’ll add money manually</option>
                        </select>
                        <small>
                          {editing.targetType === 'percent'
                            ? 'The monthly plan adjusts when your income changes.'
                            : editing.funding === 'manual'
                              ? 'The planned amount shows in your budget; add a transfer to record real movement.'
                              : 'The planned amount is reserved in your budget. Add a transfer to record real movement.'}
                        </small>
                      </Field>
                    )}
                    {editing.targetType === 'none' && (
                      <div className="soft-note">
                        This category starts with no planned contribution. Expense transactions
                        still change its balance.
                      </div>
                    )}
                  </>
                )}
                <Field label="Applies to">
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'ongoing' | 'month')}
                  >
                    <option value="ongoing">Ongoing · {monthLabel(month)} and future months</option>
                    <option value="month">{monthLabel(month)} only</option>
                  </select>
                </Field>
                <Field label="Notes (optional)">
                  <textarea
                    rows={3}
                    value={editing.notes}
                    onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                    placeholder="What is this money for?"
                  />
                </Field>
              </div>
            )}
            <div className="modal-actions">
              {data.categories.some((c) => c.id === editing.id) && (
                <button className="danger-button" onClick={removeCategory}>
                  Remove category
                </button>
              )}
              <button
                className="primary-button"
                onClick={saveCategory}
                disabled={!editing.name.trim()}
              >
                Save category
              </button>
            </div>
          </div>
        </Modal>
      )}
      {coverId && (
        <Modal title="Cover an overage" onClose={() => setCoverId(null)}>
          <div className="modal-body">
            <p className="modal-description">
              Adjust {monthLabel(month)}'s plan. Your transaction history and account balances stay
              the same.
            </p>
            <Field label="Move from">
              <select value={coverSource} onChange={(event) => setCoverSource(event.target.value)}>
                <option value="unallocated">Not yet planned · {money(summary.unallocated)}</option>
                {active
                  .filter((category) => category.id !== coverId)
                  .map((category) => {
                    const available =
                      categoryPolicy(category, month).mode === 'rollover'
                        ? rolloverBalance(category, data, month)
                        : categoryBudget(category, month, summary.income) -
                          (spend[category.id] || 0)
                    return (
                      <option key={category.id} value={category.id} disabled={available <= 0}>
                        {category.name} · {money(Math.max(0, available))} available
                      </option>
                    )
                  })}
              </select>
            </Field>
            <Field label="Amount">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={coverAmount}
                onChange={(event) => setCoverAmount(num(event.target.value))}
              />
            </Field>
            {coverMessage && (
              <div className="form-message" role="alert">
                {coverMessage}
              </div>
            )}
            <div className="modal-actions">
              <button className="primary-button" onClick={saveCover} disabled={coverAmount <= 0}>
                Move in this month's plan
              </button>
            </div>
          </div>
        </Modal>
      )}
      {groupsOpen && (
        <Modal title="Sort into groups" onClose={() => setGroupsOpen(false)} wide>
          <div className="modal-body">
            <p className="modal-description">
              These are starting suggestions. Uncheck any category you don’t want to change, then
              choose the group that feels right.
            </p>
            <div className="group-list">
              {active.map((c) => (
                <div className="group-row" key={c.id}>
                  <input
                    type="checkbox"
                    checked={groupSelected[c.id] ?? true}
                    onChange={(e) =>
                      setGroupSelected({ ...groupSelected, [c.id]: e.target.checked })
                    }
                  />
                  <span>{c.name}</span>
                  <select
                    disabled={!groupSelected[c.id]}
                    value={groupDraft[c.id] || c.group}
                    onChange={(e) => setGroupDraft({ ...groupDraft, [c.id]: e.target.value })}
                  >
                    {groups.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="primary-button" onClick={saveGroups}>
                Save groups
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
