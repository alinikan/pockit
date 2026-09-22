import { num } from '../lib/numbers'
import { useState } from 'react'
import type { Goal, MonthKey, PockitData } from '../types'
import { money, projectGoal, projectionText, simulateDebtPlan, todayISO } from '../lib/finance'
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
function GoalChart({ goal }: { goal: Goal }) {
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
  return (
    <div className="goal-chart">
      <svg viewBox="0 0 100 55" preserveAspectRatio="none" aria-label="Projected balance chart">
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
    </div>
  )
}
export function GoalsScreen({
  data,
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
  const [planOpen, setPlanOpen] = useState(false)
  const [planDraft, setPlanDraft] = useState<NonNullable<PockitData['debtPlan']>>(
    data.debtPlan || { strategy: 'interest', extra: 0, order: [] },
  )
  const savings = data.goals.filter((g) => g.kind === 'saving')
  const debts = data.goals.filter((g) => g.kind === 'debt')
  const debtTotal = debts.reduce((n, g) => n + g.balance, 0)
  const plan = data.debtPlan ? simulateDebtPlan(data.goals, data.debtPlan) : null
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
    if (!activity || !Number(activityAmount)) return
    const change = Number(activityAmount)
    update((d) => ({
      ...d,
      goals: d.goals.map((g) =>
        g.id === activity.id
          ? {
              ...g,
              balance: Math.max(0, g.balance + (g.kind === 'debt' ? -change : change)),
              history: [
                {
                  date: todayISO(),
                  amount: change,
                  note: activityNote || (g.kind === 'debt' ? 'Payment' : 'Contribution'),
                },
                ...g.history,
              ],
            }
          : g,
      ),
    }))
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
        {goal.kind === 'saving' && <Progress value={progress} color={goal.color} />}
        <GoalChart goal={goal} />
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
            }}
          >
            {goal.kind === 'saving' ? 'Add progress' : 'Record payment'}{' '}
            <Icon name="ArrowRight" size={15} />
          </button>
        </div>
        {goal.kind === 'debt' && (
          <div className="debt-details">
            <span>
              Monthly interest{' '}
              <strong>{money(projection.monthlyInterest, data.settings.currency)}</strong>
            </span>
            <span>
              Monthly payment <strong>{money(goal.monthly, data.settings.currency)}</strong>
            </span>
          </div>
        )}
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
      <section>
        <SectionHead
          title="Debts & payoffs"
          help="Debt estimates use monthly compounding and the payments you enter. They exclude fees, changing rates, and new borrowing."
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
                  ? 'Current payments may not pay this off'
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
                  value={editing.annualInterest || ''}
                  onChange={(e) => setEditing({ ...editing, annualInterest: num(e.target.value) })}
                />
              </Field>
            </div>
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
          title={activity.kind === 'debt' ? 'Record a payment' : 'Add goal progress'}
          onClose={() => setActivity(null)}
        >
          <div className="modal-body">
            <p className="modal-description">
              This updates the {activity.name} balance and its history. Add a transaction separately
              if you want it in Activity too.
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
            <Field label="Note (optional)">
              <input
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder="e.g. Extra payment"
              />
            </Field>
            <div className="modal-actions">
              <button
                className="primary-button"
                onClick={recordActivity}
                disabled={!Number(activityAmount)}
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
            {(() => {
              const result = simulateDebtPlan(data.goals, planDraft)
              return (
                <div className="plan-result">
                  <div>
                    <small>ESTIMATED DEBT-FREE</small>
                    <strong>
                      {result.months === null
                        ? 'Needs a larger payment'
                        : `${result.months} months`}
                    </strong>
                  </div>
                  <div>
                    <small>ESTIMATED INTEREST</small>
                    <strong>{money(result.interest, data.settings.currency, true)}</strong>
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
                disabled={!debts.length}
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
