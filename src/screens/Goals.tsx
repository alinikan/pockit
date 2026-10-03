import { validISODate, num } from '../lib/numbers'
import { WhatIfLab } from '../components/WhatIfLab'
import { useId, useState } from 'react'
import { goalChartData, pointFromPosition } from '../lib/goalChart'
import type { Goal, MonthKey, PockitData } from '../types'
import { money, monthSummary, projectGoal, simulateDebtPlan, todayISO } from '../lib/finance'
import { changeTransaction } from '../lib/linked'
import { investmentTransferCategory } from '../lib/accounts'
import { emergencyMilestones } from '../lib/emergency'
import { Empty, Field, Icon, Modal, Progress, SectionHead } from '../components/UI'

const newGoal = (kind: Goal['kind']): Goal => ({
  id: crypto.randomUUID(),
  kind,
  name: '',
  balance: 0,
  target: kind === 'saving' ? 1000 : 0,
  monthly: 0,
  annualInterest: 0,
  color: kind === 'saving' ? '#bdf26c' : '#f29a91',
  icon: kind === 'saving' ? 'Flag' : 'CreditCard',
  history: [],
})
function GoalChart({ goal, currency }: { goal: Goal; currency: 'CAD' }) {
  const [selectedPoint, setSelectedPoint] = useState(0)
  const fillId = useId().replace(/:/g, '')
  if (goal.kind === 'debt' && goal.interestUnknown && goal.balance > 0)
    return (
      <div className="soft-note">
        Add this debt’s interest rate to see a payoff chart. Waypoint did not provide one.
      </div>
    )
  const { months, values, labels, reachesGoal, completedNow } = goalChartData(goal)
  const point = Math.min(selectedPoint, months)
  const ceiling = Math.max(goal.kind === 'saving' ? goal.target : 0, ...values, 1)
  const x = (index: number) => 16 + (index / months) * 288
  const y = (value: number) => 126 - (value / ceiling) * 100
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  const area = `16,126 ${points} 304,126`
  const tickMonths = [...new Set([0, Math.round(months / 2), months])]
  const inspect = (clientX: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect()
    setSelectedPoint(pointFromPosition(clientX, rect.left, rect.width, months))
  }
  return (
    <div className={`goal-chart ${goal.kind}`}>
      <div className="goal-chart-readout" aria-live="polite">
        <span>{point === 0 ? 'Today' : `Month ${point} · ${labels[point]}`}</span>
        <strong>{money(values[point], currency)}</strong>
        <small>{goal.kind === 'debt' ? 'projected balance' : 'projected savings'}</small>
      </div>
      <svg
        viewBox="0 0 320 154"
        role="button"
        tabIndex={0}
        aria-label={`Inspect ${goal.name} projection. Drag or use arrow keys to choose a month.`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          inspect(event.clientX, event.currentTarget)
        }}
        onPointerMove={(event) => {
          if (event.buttons) inspect(event.clientX, event.currentTarget)
        }}
        onPointerUp={() => setSelectedPoint(0)}
        onPointerCancel={() => setSelectedPoint(0)}
        onLostPointerCapture={() => setSelectedPoint(0)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault()
            setSelectedPoint((current) =>
              Math.max(0, Math.min(months, current + (event.key === 'ArrowRight' ? 1 : -1))),
            )
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            setSelectedPoint(event.key === 'Home' ? 0 : months)
          }
        }}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--goal-chart-line)" stopOpacity=".22" />
            <stop offset="100%" stopColor="var(--goal-chart-line)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[26, 76, 126].map((lineY) => (
          <line
            key={lineY}
            x1="16"
            y1={lineY}
            x2="304"
            y2={lineY}
            stroke="currentColor"
            opacity=".17"
            strokeWidth="1"
            strokeDasharray={lineY === 126 ? undefined : '3 5'}
          />
        ))}
        <polygon points={area} fill={`url(#${fillId})`} />
        <polyline
          points={points}
          fill="none"
          stroke="var(--goal-chart-line)"
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 5"
        />
        <line
          x1={x(point)}
          y1="19"
          x2={x(point)}
          y2="126"
          stroke="currentColor"
          opacity=".5"
          strokeDasharray="3 4"
        />
        <circle
          cx={x(0)}
          cy={y(values[0])}
          r="4"
          fill="var(--red)"
          stroke="var(--surface)"
          strokeWidth="2"
        />
        {reachesGoal && (
          <circle
            cx={x(months)}
            cy={y(values[months])}
            r="4"
            fill="var(--green)"
            stroke="var(--surface)"
            strokeWidth="2"
          />
        )}
        <circle
          cx={x(point)}
          cy={y(values[point])}
          r="6"
          fill="var(--goal-chart-line)"
          stroke="var(--surface)"
          strokeWidth="3"
        />
      </svg>
      <div className="goal-chart-axis">
        {tickMonths.map((month) => (
          <span key={month}>{labels[month]}</span>
        ))}
      </div>
      <p className="goal-chart-caption">
        {completedNow
          ? goal.kind === 'debt'
            ? 'Already paid off'
            : 'Goal already reached'
          : reachesGoal
            ? 'Projected finish'
            : '24-month preview'}{' '}
        · Hold and drag to inspect each month.
      </p>
    </div>
  )
}
export function GoalsScreen({
  data,
  month,
  update,
}: {
  data: PockitData
  month: MonthKey
  update: (recipe: (value: PockitData) => PockitData) => void
}) {
  const [editing, setEditing] = useState<Goal | null>(null)
  const [activity, setActivity] = useState<Goal | null>(null)
  const [activityAmount, setActivityAmount] = useState('')
  const [activityNote, setActivityNote] = useState('')
  const [activityDate, setActivityDate] = useState(todayISO())
  const [spendingCategoryId, setSpendingCategoryId] = useState('')
  const [recordTransaction, setRecordTransaction] = useState(true)
  const [activityMode, setActivityMode] = useState<'add' | 'withdraw'>('add')
  const [sourceAccountId, setSourceAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [planOpen, setPlanOpen] = useState(false)
  const [planDraft, setPlanDraft] = useState<NonNullable<PockitData['debtPlan']>>(
    data.debtPlan || { strategy: 'interest', extra: 0, order: [] },
  )
  const savings = data.goals.filter((g) => g.kind === 'saving')
  const debts = data.goals.filter((g) => g.kind === 'debt')
  const debtTotal = debts.reduce((n, g) => n + g.balance, 0)
  const plan = data.debtPlan ? simulateDebtPlan(data.goals, data.debtPlan) : null
  const activeAccounts = (data.accounts || []).filter((account) => !account.archived)
  const activityAmountValid =
    num(activityAmount) >= 0.01 &&
    Math.abs(num(activityAmount) * 100 - Math.round(num(activityAmount) * 100)) < 0.000001
  const activityBalance = data.goals.find((goal) => goal.id === activity?.id)?.balance ?? 0
  const availablePlanRoom = monthSummary(data, month).unallocated
  const emergency = emergencyMilestones(data, month)
  function saveGoal() {
    if (!editing?.name.trim()) return
    const g = { ...editing, name: editing.name.trim() }
    update((d) => ({
      ...d,
      goals: d.goals.some((old) => old.id === g.id)
        ? d.goals.map((old) => (old.id === g.id ? g : old))
        : [...d.goals, g],
    }))
    setEditing(null)
  }
  function removeGoal() {
    if (!editing || !window.confirm(`Delete ${editing.name}?`)) return
    update((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== editing.id) }))
    setEditing(null)
  }
  function recordActivity() {
    const change = Math.round(num(activityAmount) * 100) / 100
    if (
      !activity ||
      !activityAmountValid ||
      !validISODate(activityDate) ||
      activityDate > todayISO() ||
      (recordTransaction &&
        sourceAccountId !== '' &&
        sourceAccountId === destinationAccountId &&
        activityMode !== 'withdraw') ||
      ((activity.kind === 'debt' || activityMode === 'withdraw') && change > activityBalance)
    )
      return
    const transactionId = recordTransaction ? crypto.randomUUID() : undefined
    const date = activityDate
    update((d) => {
      const liveGoal = d.goals.find((goal) => goal.id === activity.id)
      if (
        !liveGoal ||
        ((liveGoal.kind === 'debt' || activityMode === 'withdraw') && change > liveGoal.balance)
      )
        return d
      if (transactionId)
        return changeTransaction(d, null, {
          id: transactionId,
          date,
          payee:
            activityMode === 'withdraw'
              ? `Spending from ${activity.name}`
              : activity.kind === 'debt'
                ? `Payment to ${activity.name}`
                : `Savings for ${activity.name}`,
          amount: change,
          createdAt: new Date().toISOString(),
          type: activityMode === 'withdraw' ? 'expense' : 'transfer',
          accountId: sourceAccountId || undefined,
          toAccountId: activityMode === 'withdraw' ? undefined : destinationAccountId || undefined,
          categoryId:
            activityMode === 'withdraw'
              ? spendingCategoryId || undefined
              : investmentTransferCategory(d, sourceAccountId, destinationAccountId),
          goalId: activity.id,
          note: activityNote || undefined,
        })
      return {
        ...d,
        goals: d.goals.map((g) =>
          g.id === activity.id
            ? {
                ...g,
                balance: Math.max(
                  0,
                  g.balance + (activityMode === 'withdraw' || g.kind === 'debt' ? -change : change),
                ),
                history: [
                  {
                    date,
                    amount: activityMode === 'withdraw' ? -change : change,
                    note:
                      activityNote ||
                      (activityMode === 'withdraw'
                        ? 'Withdrawal'
                        : g.kind === 'debt'
                          ? 'Payment'
                          : 'Contribution'),
                  },
                  ...g.history,
                ],
              }
            : g,
        ),
      }
    })
    setActivity(null)
    setActivityAmount('')
    setActivityNote('')
  }
  const renderGoal = (goal: Goal) => {
    const projection = projectGoal(goal)
    const progress =
      goal.kind === 'saving'
        ? (goal.balance / Math.max(goal.target, 1)) * 100
        : Math.max(0, 100 - (goal.balance / Math.max(goal.balance + goal.monthly * 6, 1)) * 100)
    return (
      <div className="goal-card" key={goal.id}>
        <div className="goal-card-top">
          <div className={`goal-icon ${goal.kind}`}>
            <Icon name={goal.icon} size={23} />
          </div>
          <div>
            <strong>{goal.name}</strong>
            <small>{goal.kind === 'debt' ? 'Debt payoff' : 'Savings goal'}</small>
          </div>
          <button
            className="icon-button"
            aria-label={`Edit ${goal.name}`}
            onClick={() => setEditing({ ...goal })}
          >
            <Icon name="Ellipsis" size={19} />
          </button>
        </div>
        <div className="goal-amount">
          <strong>{money(goal.balance, data.settings.currency, true)}</strong>
          <span>
            {goal.kind === 'saving'
              ? `of ${money(goal.target, data.settings.currency, true)} goal`
              : 'remaining balance'}
          </span>
        </div>
        {goal.waypointKey && (
          <p className="goal-import-note">
            Imported Waypoint balance · add or link later movements to keep progress current.
          </p>
        )}
        {goal.description && <p className="goal-import-note">{goal.description}</p>}
        {goal.targetDate && (
          <p className="goal-import-note">Waypoint target date: {goal.targetDate}</p>
        )}
        {goal.kind === 'saving' && <Progress value={progress} color={goal.color} />}
        <GoalChart goal={goal} currency={data.settings.currency} />
        <div className="goal-plan-line">
          <Icon name="CalendarClock" size={17} />
          <span>
            {goal.monthly > 0
              ? `${money(goal.monthly)}/month planned`
              : 'No monthly amount planned'}
          </span>
          <button className="text-button" onClick={() => setEditing({ ...goal })}>
            {goal.monthly > 0 ? 'Edit plan' : 'Set monthly amount'}
          </button>
        </div>
        <div className="goal-money-actions">
          <button
            className="goal-money-action"
            onClick={() => {
              setActivity(goal)
              setActivityAmount('')
              setActivityNote('')
              setActivityDate(todayISO())
              setRecordTransaction(true)
              setActivityMode('add')
              setSourceAccountId('')
              setDestinationAccountId('')
            }}
          >
            <Icon name={goal.kind === 'saving' ? 'Plus' : 'CreditCard'} size={20} />
            <span>
              <strong>{goal.kind === 'saving' ? 'Save money' : 'Record payment'}</strong>
              <small>
                {goal.kind === 'saving'
                  ? 'Record money added to this goal'
                  : 'Record a payment you made'}
              </small>
            </span>
          </button>
          {goal.kind === 'saving' && goal.balance > 0 && (
            <button
              className="goal-money-action goal-spend-action"
              onClick={() => {
                setActivity(goal)
                setActivityMode('withdraw')
                setActivityAmount('')
                setActivityNote('')
                setActivityDate(todayISO())
                setSpendingCategoryId('')
                setRecordTransaction(true)
                setSourceAccountId('')
                setDestinationAccountId('')
              }}
            >
              <Icon name="ArrowUpRight" size={20} />
              <span>
                <strong>Spend saved money</strong>
                <small>Record a purchase paid from this goal</small>
              </span>
            </button>
          )}
        </div>
        {goal.kind === 'debt' && (
          <div className="debt-details">
            <span>
              Monthly interest{' '}
              <strong>
                {goal.interestUnknown
                  ? 'Unknown'
                  : money(projection.monthlyInterest, data.settings.currency)}
              </strong>
            </span>
            <span>
              Monthly payment <strong>{money(goal.monthly, data.settings.currency)}</strong>
            </span>
            {goal.minimumPayment !== undefined && (
              <span>
                Minimum payment <strong>{money(goal.minimumPayment)}</strong>
              </span>
            )}
            {goal.originalDebtAmount !== undefined && (
              <span>
                Original debt <strong>{money(goal.originalDebtAmount)}</strong>
              </span>
            )}
          </div>
        )}
        {goal.waypointKey &&
        (goal.importedManualContributions || goal.importedTransactionContributions) ? (
          <p className="goal-import-note">
            Waypoint included {money(goal.importedManualContributions || 0)} manual and{' '}
            {money(goal.importedTransactionContributions || 0)} transaction contributions in this
            snapshot. Individual dates were not exported.
          </p>
        ) : null}
        {goal.history.length > 0 && (
          <div className="goal-history">
            <span>RECENT ACTIVITY</span>
            {goal.history.slice(0, 2).map((h, i) => (
              <div key={`${h.date}-${i}`}>
                <span>
                  {h.note} · {h.date}
                </span>
                <strong>{money(h.amount, data.settings.currency)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="screen-stack">
      <section>
        <SectionHead
          title="Savings goals"
          help="Save money records a contribution you already made: for example, $50 from Chequing to TFSA. Spend saved money records a purchase paid from that goal. Set monthly amount changes your forecast, not your real savings. If a movement is already in Activity, edit it and link the goal instead of adding it again. Forecasts are estimates."
          aside={
            <button
              className="primary-button compact"
              onClick={() => setEditing(newGoal('saving'))}
            >
              <Icon name="Plus" size={16} /> Add goal
            </button>
          }
        />
        <div className="goals-grid">
          {savings.length ? (
            savings.map(renderGoal)
          ) : (
            <Empty
              icon="Flag"
              title="Something worth saving for?"
              text="Add a goal and watch your progress grow."
              action={
                <button className="text-button" onClick={() => setEditing(newGoal('saving'))}>
                  Create a goal <Icon name="ArrowRight" size={16} />
                </button>
              }
            />
          )}
        </div>
      </section>
      {emergency.steps.length > 0 && (
        <section className="panel emergency-panel" aria-label="Emergency cushion">
          <SectionHead
            title="Build your emergency cushion"
            help="These are optional checkpoints based on your take-home pay and the essential categories in your selected month's plan. They are not a fixed rule. Adjust categories and your Emergency fund goal to fit your life."
          />
          <p className="panel-subtitle">
            A small first cushion can protect the next paycheque. From there, build toward essential
            expenses.
          </p>
          <div className="emergency-steps">
            {emergency.steps.map((step, index) => (
              <div key={step.label}>
                <span className="emergency-step-icon">
                  <Icon
                    name={index === 0 ? 'Wallet' : index === 1 ? 'Shield' : 'ShieldCheck'}
                    size={20}
                  />
                </span>
                <span>
                  <strong>{step.label}</strong>
                  <small>
                    {money(emergency.saved)} saved toward {money(step.amount)}
                  </small>
                  <Progress
                    value={(emergency.saved / step.amount) * 100}
                    color={index === 0 ? 'var(--lime)' : 'var(--green)'}
                  />
                </span>
                {emergency.saved >= step.amount && <Icon name="CheckCircle2" size={18} />}
              </div>
            ))}
          </div>
          {!emergency.goalId && (
            <button
              className="secondary-button compact"
              onClick={() =>
                setEditing({
                  ...newGoal('saving'),
                  name: 'Emergency fund',
                  target: emergency.steps.at(-1)?.amount || 1000,
                  icon: 'ShieldCheck',
                })
              }
            >
              Create Emergency fund goal
            </button>
          )}
        </section>
      )}
      <section>
        <SectionHead
          title="Debts & payoffs"
          help="Debt forecasts use monthly compounding and the payments you enter. Recorded payments reduce the balance you entered, but Pockit does not add real lender interest or fees to that saved balance automatically. Check it against your statement."
          aside={
            <button
              className="secondary-button compact"
              onClick={() => setEditing(newGoal('debt'))}
            >
              <Icon name="Plus" size={16} /> Add debt
            </button>
          }
        />
        <div className="debt-summary">
          <div className="debt-summary-icon">
            <Icon name="TrendingDown" size={24} />
          </div>
          <div>
            <small>
              YOUR {debts.length} {debts.length === 1 ? 'DEBT' : 'DEBTS'} TOTAL
            </small>
            <strong>{money(debtTotal, data.settings.currency, true)}</strong>
            <span>
              {plan
                ? plan.months === null
                  ? plan.unknownInterest
                    ? 'Add missing interest rates for an estimate'
                    : 'Current payments may not pay this off'
                  : `Plan could finish in ${plan.months} months`
                : 'Build a plan to see the way forward'}
            </span>
          </div>
          <button
            className="primary-button"
            onClick={() => {
              setPlanDraft(
                data.debtPlan || { strategy: 'interest', extra: 0, order: debts.map((d) => d.id) },
              )
              setPlanOpen(true)
            }}
          >
            {plan ? 'Edit plan' : 'Set up a plan'} <Icon name="ArrowRight" size={17} />
          </button>
        </div>
        <div className="goals-grid">
          {debts.length ? (
            debts.map(renderGoal)
          ) : (
            <Empty
              icon="CreditCard"
              title="No debts added"
              text="Add a balance to see a payoff estimate and build a plan."
            />
          )}
        </div>
      </section>
      <WhatIfLab data={data} month={month} update={update} />
      {editing && (
        <Modal
          title={`${data.goals.some((g) => g.id === editing.id) ? 'Edit' : 'Add'} ${editing.kind === 'saving' ? 'savings goal' : 'debt'}`}
          onClose={() => setEditing(null)}
        >
          <div className="modal-body">
            <Field label="Name">
              <input
                autoFocus
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder={editing.kind === 'debt' ? 'Credit card' : 'Emergency fund'}
              />
            </Field>
            <div className="form-grid">
              <Field label={editing.kind === 'debt' ? 'Balance owed' : 'Saved so far'}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.balance || ''}
                  onChange={(e) => setEditing({ ...editing, balance: num(e.target.value) })}
                />
              </Field>
              {editing.kind === 'saving' && (
                <Field label="Goal amount">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editing.target || ''}
                    onChange={(e) => setEditing({ ...editing, target: num(e.target.value) })}
                  />
                </Field>
              )}
              <Field label={editing.kind === 'debt' ? 'Monthly payment' : 'Save per month'}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.monthly || ''}
                  onChange={(e) => setEditing({ ...editing, monthly: num(e.target.value) })}
                />
              </Field>
              <Field label="Annual interest %">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={editing.interestUnknown ? '' : editing.annualInterest}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      annualInterest: num(e.target.value),
                      interestUnknown: !e.target.value,
                    })
                  }
                />
              </Field>
            </div>
            {editing.interestUnknown && (
              <p className="soft-note">
                Waypoint did not include an interest rate. Enter the lender’s rate, or Pockit will
                leave payoff estimates unavailable.
              </p>
            )}
            <Field label="Description (optional)">
              <textarea
                rows={2}
                value={editing.description || ''}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
            </Field>
            <Field label="Target date (optional)">
              <input
                type="date"
                value={editing.targetDate || ''}
                onChange={(event) =>
                  setEditing({ ...editing, targetDate: event.target.value || undefined })
                }
              />
            </Field>
            <div className="modal-actions">
              {data.goals.some((g) => g.id === editing.id) && (
                <button className="danger-button" onClick={removeGoal}>
                  Delete
                </button>
              )}
              <button
                className="primary-button"
                onClick={saveGoal}
                disabled={
                  !editing.name.trim() || (editing.kind === 'saving' && editing.target <= 0)
                }
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}
      {activity && (
        <Modal
          title={
            activity.kind === 'debt'
              ? 'Record a payment'
              : activityMode === 'withdraw'
                ? 'Spend saved money'
                : 'Save money toward your goal'
          }
          onClose={() => setActivity(null)}
        >
          <div className="modal-body">
            <div className="goal-movement-summary">
              <Icon
                name={
                  activity.kind === 'debt'
                    ? 'CreditCard'
                    : activityMode === 'withdraw'
                      ? 'ArrowUpRight'
                      : 'PiggyBank'
                }
                size={24}
              />
              <div>
                <strong>{activity.name}</strong>
                <p>
                  {activity.kind === 'debt'
                    ? 'Record a payment you have made. This reduces your debt and adds a linked transfer in Activity.'
                    : activityMode === 'withdraw'
                      ? 'Record a purchase using these savings. This reduces your goal and adds one expense in Activity.'
                      : 'Record money you have set aside. This increases your goal and adds one transfer in Activity.'}
                </p>
              </div>
            </div>
            <p className="goal-form-note">
              Pockit records what happened; it does not move money at your bank. Already entered
              this in Activity? Edit that transaction and link this goal instead.
            </p>
            <Field label="Amount">
              <input
                autoFocus
                type="number"
                min="0.01"
                step="0.01"
                value={activityAmount}
                onChange={(e) => setActivityAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            {activityAmount !== '' && !activityAmountValid && (
              <p className="form-message" role="alert">
                Enter an amount of at least $0.01, with no more than two decimal places.
              </p>
            )}
            {(activity.kind === 'debt' || activityMode === 'withdraw') &&
              num(activityAmount) > activityBalance && (
                <div className="form-message" role="alert">
                  The amount cannot exceed the current balance. Update the balance first if it has
                  changed.
                </div>
              )}
            <Field label="Date">
              <input
                type="date"
                value={activityDate}
                max={todayISO()}
                onChange={(event) => setActivityDate(event.target.value)}
              />
            </Field>
            {(!validISODate(activityDate) || activityDate > todayISO()) && (
              <p className="form-message" role="alert">
                Choose today or an earlier date for a movement that already happened.
              </p>
            )}
            {activityMode === 'withdraw' && recordTransaction && (
              <Field label="Spending category">
                <select
                  value={spendingCategoryId}
                  onChange={(event) => setSpendingCategoryId(event.target.value)}
                >
                  <option value="">Uncategorized — choose later</option>
                  {data.categories
                    .filter((category) => !category.archived)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
            <Field label="Note (optional)">
              <input
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder={
                  activityMode === 'withdraw'
                    ? 'e.g. Car repair'
                    : activity.kind === 'debt'
                      ? 'e.g. Extra payment'
                      : 'e.g. October savings'
                }
              />
            </Field>
            {recordTransaction && activeAccounts.length > 0 && (
              <div className="goal-account-route">
                <p className="goal-form-note">
                  {activityMode === 'withdraw'
                    ? 'Which account paid for this purchase?'
                    : 'A transfer has two sides: money leaves From and arrives in To. For example, Chequing → TFSA.'}
                </p>
                <Field label={activityMode === 'withdraw' ? 'Paid from account' : 'From account'}>
                  <select
                    aria-label={activityMode === 'withdraw' ? 'Paid from account' : 'From account'}
                    value={sourceAccountId}
                    onChange={(event) => {
                      setSourceAccountId(event.target.value)
                      if (event.target.value === destinationAccountId) setDestinationAccountId('')
                    }}
                  >
                    <option value="">Not tracked in Pockit</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {activityMode !== 'withdraw' && (
                  <div className="goal-route-arrow" aria-hidden="true">
                    <Icon name="ArrowDown" size={20} />
                  </div>
                )}
                {activityMode !== 'withdraw' && (
                  <Field label="To account">
                    <select
                      aria-label="To account"
                      value={destinationAccountId}
                      onChange={(event) => setDestinationAccountId(event.target.value)}
                    >
                      <option value="">Not tracked in Pockit</option>
                      {activeAccounts
                        .filter((account) => account.id !== sourceAccountId)
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
            <details className="goal-record-options">
              <summary>Recording options</summary>
              <label className="linked-action">
                <input
                  type="checkbox"
                  checked={recordTransaction}
                  onChange={(event) => setRecordTransaction(event.target.checked)}
                />
                Save a linked {activityMode === 'withdraw' ? 'expense' : 'transfer'} in Activity
              </label>
              <p className="goal-form-note">
                Leave this on to update your goal and tracked accounts together. Turn it off only to
                adjust goal progress without an Activity entry; account balances will stay
                unchanged.
              </p>
            </details>
            <div className="modal-actions">
              <button
                className="primary-button"
                onClick={recordActivity}
                disabled={
                  !activityAmountValid ||
                  !validISODate(activityDate) ||
                  activityDate > todayISO() ||
                  (recordTransaction &&
                    sourceAccountId !== '' &&
                    sourceAccountId === destinationAccountId &&
                    activityMode !== 'withdraw') ||
                  ((activity.kind === 'debt' || activityMode === 'withdraw') &&
                    num(activityAmount) > activityBalance)
                }
              >
                {activity.kind === 'debt'
                  ? 'Save payment'
                  : activityMode === 'withdraw'
                    ? 'Save expense'
                    : 'Save contribution'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {planOpen && (
        <Modal title="Your debt payoff plan" onClose={() => setPlanOpen(false)} wide>
          <div className="modal-body">
            <p className="modal-description">
              Pockit uses your balances, rates, minimum payments, and extra amount. When one debt is
              paid, its payment rolls to the next debt.
            </p>
            <div className="strategy-grid">
              {[
                ['interest', 'Highest interest first', 'Usually reduces total interest.'],
                ['balance', 'Smallest balance first', 'Early wins can keep momentum.'],
                ['custom', 'My own order', 'Choose the order yourself.'],
              ].map(([value, title, desc]) => (
                <button
                  key={value}
                  className={planDraft.strategy === value ? 'selected' : ''}
                  onClick={() =>
                    setPlanDraft({ ...planDraft, strategy: value as typeof planDraft.strategy })
                  }
                >
                  <Icon
                    name={
                      value === 'interest'
                        ? 'Percent'
                        : value === 'balance'
                          ? 'ListOrdered'
                          : 'GripVertical'
                    }
                    size={20}
                  />
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
            {planDraft.strategy === 'custom' && (
              <div className="custom-order">
                <strong>Payoff order</strong>
                {debts.map((g, i) => (
                  <div key={g.id}>
                    <span>
                      {i + 1}. {g.name}
                    </span>
                    <select
                      value={planDraft.order.indexOf(g.id) + 1 || i + 1}
                      onChange={(e) => {
                        const list = [
                          ...(planDraft.order.length ? planDraft.order : debts.map((d) => d.id)),
                        ]
                        list.splice(list.indexOf(g.id), 1)
                        list.splice(Number(e.target.value) - 1, 0, g.id)
                        setPlanDraft({ ...planDraft, order: list })
                      }}
                    >
                      {debts.map((_, index) => (
                        <option key={index} value={index + 1}>
                          {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
            <Field
              label="Extra monthly payment"
              hint="Only add what you can comfortably afford after essentials and planned savings."
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={planDraft.extra || ''}
                onChange={(e) => setPlanDraft({ ...planDraft, extra: num(e.target.value) })}
                placeholder="0.00"
              />
            </Field>
            {planDraft.extra > Math.max(0, availablePlanRoom) && (
              <div className="form-message" role="alert">
                Extra payments exceed the {money(Math.max(0, availablePlanRoom))} not yet planned in{' '}
                {month}. Review your Budget before relying on this plan. Existing Debt Payments
                category amounts may already cover your minimum payments.
              </div>
            )}
            {(() => {
              const result = simulateDebtPlan(data.goals, planDraft)
              return (
                <div className="plan-result">
                  <div>
                    <small>ESTIMATED DEBT-FREE</small>
                    <strong>
                      {result.months === null
                        ? result.unknownInterest
                          ? 'Add interest rates'
                          : 'Needs a larger payment'
                        : `${result.months} months`}
                    </strong>
                  </div>
                  <div>
                    <small>ESTIMATED INTEREST</small>
                    <strong>
                      {result.unknownInterest
                        ? 'Unknown'
                        : money(result.interest, data.settings.currency, true)}
                    </strong>
                  </div>
                  <div className="plan-order">
                    {result.order.map((g, i) => (
                      <span key={g.id}>
                        {i + 1}. {g.name}
                        {i < result.order.length - 1 ? ' → ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })()}
            <div className="modal-actions">
              <button
                className="primary-button"
                onClick={() => {
                  update((d) => ({ ...d, debtPlan: planDraft }))
                  setPlanOpen(false)
                }}
                disabled={!debts.length || debts.some((goal) => goal.interestUnknown)}
              >
                Save plan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
