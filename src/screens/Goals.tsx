import { num } from '../lib/numbers'
import { WhatIfLab } from '../components/WhatIfLab'
import { useState } from 'react'
import type { Goal, MonthKey, PockitData } from '../types'
import {
  money,
  monthSummary,
  projectGoal,
  projectionText,
  simulateDebtPlan,
  todayISO,
} from '../lib/finance'
import { changeTransaction } from '../lib/linked'
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
  if (goal.kind === 'debt' && goal.interestUnknown && goal.balance > 0)
    return (
      <div className="soft-note">
        Add this debt’s interest rate to see a payoff chart. Waypoint did not provide one.
      </div>
    )
  const projection = projectGoal(goal)
  const months = Math.max(1, Math.min(projection.months || 24, 24))
  let balance = goal.balance
  const values = [balance]
  for (let i = 0; i < months; i++) {
    balance =
      goal.kind === 'debt'
        ? Math.max(0, balance * (1 + goal.annualInterest / 1200) - goal.monthly)
        : balance * (1 + goal.annualInterest / 1200) + goal.monthly
    values.push(balance)
  }
  const ceiling = Math.max(goal.target, goal.balance, ...values, 1)
  const points = values.map((v, i) => `${(i / months) * 100},${50 - (v / ceiling) * 42}`).join(' ')
  const point = Math.min(selectedPoint, months)
  return (
    <div className="goal-chart">
      <svg
        viewBox="0 0 100 55"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${goal.name} projected balance from today to ${months} months`}
      >
        <line
          x1="0"
          y1="50"
          x2="100"
          y2="50"
          stroke="currentColor"
          opacity=".12"
          strokeWidth=".5"
        />
        <polyline
          points={points}
          fill="none"
          stroke={goal.color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div>
        <span>Today</span>
        <span>{months} months</span>
      </div>
      <label className="goal-chart-inspector">
        <span>Inspect projection</span>
        <input
          type="range"
          min="0"
          max={months}
          step="1"
          value={point}
          aria-label={`Inspect ${goal.name} projection`}
          onChange={(event) => setSelectedPoint(Number(event.target.value))}
        />
        <output aria-live="polite">
          {point === 0 ? 'Today' : `Month ${point}`}: {money(values[point], currency)}
        </output>
      </label>
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
    const change = num(activityAmount)
    if (
      !activity ||
      change <= 0 ||
      ((activity.kind === 'debt' || activityMode === 'withdraw') && change > activity.balance)
    )
      return
    const transactionId = recordTransaction ? crypto.randomUUID() : undefined
    const date = todayISO()
    update((d) => {
      if (transactionId)
        return changeTransaction(d, null, {
          id: transactionId,
          date,
          payee: activity.name,
          amount: change,
          createdAt: new Date().toISOString(),
          type: activityMode === 'withdraw' ? 'expense' : 'transfer',
          accountId: sourceAccountId || undefined,
          toAccountId: activityMode === 'withdraw' ? undefined : destinationAccountId || undefined,
          categoryId:
            activityMode === 'withdraw'
              ? d.categories.find((category) => category.name === 'Emergency')?.id
              : undefined,
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
                    amount: change,
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
        <div className="goal-card-footer">
          <div>
            <Icon name="CalendarClock" size={16} />
            <span>{projectionText(goal)}</span>
          </div>
          <button
            onClick={() => {
              setActivity(goal)
              setActivityAmount('')
              setActivityNote('')
              setRecordTransaction(true)
              setActivityMode('add')
              setSourceAccountId('')
              setDestinationAccountId('')
            }}
          >
            {goal.kind === 'saving' ? 'Add progress' : 'Record payment'}{' '}
            <Icon name="ArrowRight" size={15} />
          </button>
        </div>
        {goal.kind === 'saving' && goal.balance > 0 && (
          <button
            className="text-button"
            onClick={() => {
              setActivity(goal)
              setActivityMode('withdraw')
              setActivityAmount('')
              setActivityNote('')
              setRecordTransaction(true)
              setSourceAccountId('')
              setDestinationAccountId('')
            }}
          >
            <Icon name="ArrowUpRight" size={16} /> Use money from this goal
          </button>
        )}
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
          help="A goal forecast uses your saved balance, monthly contribution, and annual interest rate. It is an estimate, not a guarantee."
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
                ? 'Use goal money'
                : 'Add goal progress'
          }
          onClose={() => setActivity(null)}
        >
          <div className="modal-body">
            <p className="modal-description">
              This updates {activity.name} and its history. Record the movement in Activity so your
              account balance and spending stay in step. A debt payment moves money to your lender;
              the card purchases were counted when you made them. For debt, refresh the balance from
              your lender’s statement when interest or fees post.
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
            {(activity.kind === 'debt' || activityMode === 'withdraw') &&
              num(activityAmount) > activity.balance && (
                <div className="form-message" role="alert">
                  The amount cannot exceed the current balance. Update the balance first if it has
                  changed.
                </div>
              )}
            <Field label="Note (optional)">
              <input
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder="e.g. Extra payment"
              />
            </Field>
            {recordTransaction && activeAccounts.length > 0 && (
              <div className="form-grid">
                <Field
                  label={activityMode === 'withdraw' ? 'Spend from account' : 'Pay from account'}
                >
                  <select
                    value={sourceAccountId}
                    onChange={(event) => setSourceAccountId(event.target.value)}
                  >
                    <option value="">Choose later</option>
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </Field>
                {activityMode !== 'withdraw' && (
                  <Field label={activity.kind === 'debt' ? 'Debt account' : 'Savings account'}>
                    <select
                      value={destinationAccountId}
                      onChange={(event) => setDestinationAccountId(event.target.value)}
                    >
                      <option value="">Choose later</option>
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
            <label className="linked-action">
              <input
                type="checkbox"
                checked={recordTransaction}
                onChange={(e) => setRecordTransaction(e.target.checked)}
              />{' '}
              Also record in Activity as {activityMode === 'withdraw' ? 'an expense' : 'a transfer'}
            </label>
            <div className="modal-actions">
              <button
                className="primary-button"
                onClick={recordActivity}
                disabled={
                  num(activityAmount) <= 0 ||
                  ((activity.kind === 'debt' || activityMode === 'withdraw') &&
                    num(activityAmount) > activity.balance)
                }
              >
                Save progress
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
                Extra payments exceed the {money(Math.max(0, availablePlanRoom))} unallocated in{' '}
                {month}. Review your Budget before relying on this plan. Existing Debt Payments
                allocations may already cover your minimum payments.
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
