import { useState } from 'react'
import type { MonthKey, PockitData } from '../types'
import {
  categoryActiveInMonth,
  categoryBudget,
  categoryPolicy,
  money,
  monthLabel,
  monthSummary,
  todayISO,
} from '../lib/finance'
import { applyScenario, calculateScenario, requiredMonthlySaving } from '../lib/scenarios'
import { paychequeForecast } from '../lib/payday'
import { Field, Icon, Modal, SectionHead } from './UI'

const choices = [
  {
    id: 'saving',
    title: 'Save faster',
    detail: 'Find a monthly amount that reaches your goal sooner.',
    icon: 'PiggyBank',
  },
  {
    id: 'debt',
    title: 'Pay debt sooner',
    detail: 'See what an extra monthly payment could save.',
    icon: 'CreditCard',
  },
  {
    id: 'expense',
    title: 'Change a monthly budget',
    detail: 'Try spending less, or make room for a higher bill.',
    icon: 'SlidersHorizontal',
  },
  {
    id: 'surprise',
    title: 'Handle a surprise cost',
    detail: 'Check how a one-time expense affects your plan.',
    icon: 'Wrench',
  },
  {
    id: 'pay',
    title: 'Miss a paycheque',
    detail: 'See the gap if one expected payment does not arrive.',
    icon: 'Wallet',
  },
  {
    id: 'rate',
    title: 'Test a higher debt rate',
    detail: 'See how higher interest changes your payoff.',
    icon: 'Percent',
  },
] as const
type Scenario = (typeof choices)[number]['id']
const planFields = (data: PockitData) =>
  JSON.stringify({ goals: data.goals, categories: data.categories, debtPlan: data.debtPlan })

export function WhatIfLab({
  data,
  month,
  update,
}: {
  data: PockitData
  month: MonthKey
  update: (recipe: (value: PockitData) => PockitData) => void
}) {
  const savings = data.goals.filter((goal) => goal.kind === 'saving')
  const categories = data.categories.filter(
    (category) => !category.archived && categoryActiveInMonth(category, month),
  )
  const hasDebt = data.goals.some((goal) => goal.kind === 'debt' && goal.balance > 0)
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [choicesOpen, setChoicesOpen] = useState(true)
  const [goalId, setGoalId] = useState(savings[0]?.id || '')
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [deadlineMonths, setDeadlineMonths] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<{ before: PockitData; after: PockitData } | null>(null)
  const selectedGoalId = savings.some((goal) => goal.id === goalId) ? goalId : savings[0]?.id || ''
  const selectedCategoryId = categories.some((category) => category.id === categoryId)
    ? categoryId
    : categories[0]?.id || ''
  const value = Number(amount)
  const validAmount =
    scenario === 'pay' ||
    (amount.trim() !== '' &&
      Number.isFinite(value) &&
      Math.abs(value) <= (scenario === 'rate' ? 100 : 1000000) &&
      (scenario === 'expense' || value >= 0))
  const input = {
    extraDebt: scenario === 'debt' && validAmount ? value : 0,
    extraSaving: scenario === 'saving' && validAmount ? value : 0,
    expenseChange: scenario === 'expense' && validAmount ? value : 0,
    goalId: selectedGoalId,
    categoryId: selectedCategoryId,
    oneTimeExpense: scenario === 'surprise' && validAmount ? value : 0,
    missedPay: scenario === 'pay',
    rateRise: scenario === 'rate' && validAmount ? value : 0,
  }
  const result = calculateScenario(data, month, input)
  const payday = paychequeForecast(data, todayISO())
  const deadline = Number(deadlineMonths)
  const required =
    result.selectedGoal &&
    deadlineMonths !== '' &&
    Number.isInteger(deadline) &&
    deadline > 0 &&
    deadline <= 600
      ? requiredMonthlySaving(
          result.selectedGoal.balance,
          result.selectedGoal.target,
          result.selectedGoal.annualInterest,
          deadline,
        )
      : null
  const recurring = scenario === 'debt' || scenario === 'saving' || scenario === 'expense'
  const missing =
    scenario === 'saving' && !savings.length
      ? 'Add a savings goal first, then try a monthly contribution here.'
      : (scenario === 'debt' || scenario === 'rate') && !hasDebt
        ? 'Add a debt first so Pockit can estimate your payoff.'
        : scenario === 'expense' && !categories.length
          ? 'Add a budget category first, then try changing its monthly amount.'
          : scenario === 'pay' && data.profile.payAmount <= 0
            ? 'Set your expected paycheque amount in More → Paycheques first.'
            : ''
  const hasChange =
    validAmount &&
    !missing &&
    (scenario === 'pay' || (scenario === 'expense' ? result.expenseChange !== 0 : value > 0))
  const selectedPolicy = categories.find((item) => item.id === selectedCategoryId)
  const applyIssue =
    recurring && hasChange && result.roomAfter < 0
      ? 'This plan exceeds your planned monthly income. Try a smaller amount or reduce another category first.'
      : scenario === 'expense' &&
          selectedPolicy &&
          categoryPolicy(selectedPolicy, month).mode === 'rollover' &&
          categoryPolicy(selectedPolicy, month).targetType !== 'fixed'
        ? 'This category uses a percentage or has no monthly target. Change its rule directly in Budget.'
        : ''
  const undoAvailable = !!undo && planFields(data) === planFields(undo.after)
  const choice = choices.find((item) => item.id === scenario)
  const duration = (months: number | null) =>
    months === null
      ? 'No finish date yet'
      : months === 0
        ? 'Already reached'
        : `${months} ${months === 1 ? 'month' : 'months'}`
  function choose(id: Scenario) {
    setScenario(id)
    setChoicesOpen(false)
    setAmount('')
    setDeadlineMonths('')
    setError('')
    setApplyOpen(false)
  }
  function apply() {
    try {
      const next = applyScenario(data, month, input)
      setUndo({ before: data, after: next })
      update((current) =>
        planFields(current) === planFields(data) &&
        JSON.stringify(current.profile) === JSON.stringify(data.profile)
          ? { ...current, goals: next.goals, categories: next.categories, debtPlan: next.debtPlan }
          : current,
      )
      setApplyOpen(false)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not apply that plan.')
    }
  }
  return (
    <section className="panel whatif-panel" aria-label="What-if Lab">
      <SectionHead
        title="What-if Lab"
        help="A safe place to test an idea before changing your plan. For example, try saving an extra $50 each month and see how much sooner you could reach your goal. Estimates use the amounts and interest rates you entered. Nothing is recorded as income or spending here."
      />
      <p className="panel-subtitle">
        What would happen if…? Choose one idea, try an amount, and see the difference.
      </p>
      {scenario && (
        <div className="lab-switcher">
          <span>
            <Icon name={choice!.icon} size={20} />
            <strong>{choice?.title}</strong>
          </span>
          <button
            className="text-button"
            aria-expanded={choicesOpen}
            onClick={() => setChoicesOpen(!choicesOpen)}
          >
            {choicesOpen ? 'Close ideas' : 'Change idea'}
          </button>
        </div>
      )}
      {choicesOpen && (
        <div className="lab-choices" aria-label="Choose a scenario">
          {choices.map((item) => (
            <button
              key={item.id}
              aria-pressed={scenario === item.id}
              onClick={() => choose(item.id)}
            >
              <Icon name={item.icon} size={22} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      {!scenario && (
        <div className="lab-empty">
          <Icon name="FlaskConical" size={24} />
          <p>Your budget stays unchanged while you explore. Start with a question above.</p>
        </div>
      )}
      {scenario && (
        <div className="lab-workspace">
          <div className="lab-step-heading">
            <span>1</span>
            <div>
              <h3>{choice?.title}</h3>
              <p>Monthly plan for {monthLabel(month)} · all amounts in CAD</p>
            </div>
          </div>
          {missing ? (
            <p className="lab-guidance" role="status">
              {missing}
            </p>
          ) : (
            <>
              <div className="whatif-controls">
                {scenario === 'saving' && (
                  <Field label="Savings goal">
                    <select
                      value={selectedGoalId}
                      onChange={(event) => setGoalId(event.target.value)}
                    >
                      {savings.map((goal) => (
                        <option key={goal.id} value={goal.id}>
                          {goal.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {scenario === 'expense' && (
                  <Field label="Category affected">
                    <select
                      value={selectedCategoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {scenario !== 'pay' && (
                  <Field
                    label={
                      scenario === 'saving'
                        ? 'Extra to a savings goal each month'
                        : scenario === 'debt'
                          ? 'Extra debt payment each month'
                          : scenario === 'expense'
                            ? 'Recurring monthly expense change'
                            : scenario === 'surprise'
                              ? 'One-time surprise expense'
                              : 'Interest rate rise (percentage points)'
                    }
                  >
                    <input
                      type="number"
                      min={scenario === 'expense' ? '-1000000' : '0'}
                      max={scenario === 'rate' ? '100' : '1000000'}
                      step={scenario === 'rate' ? '0.25' : '0.01'}
                      value={amount}
                      placeholder={
                        scenario === 'expense'
                          ? 'e.g. -50 to spend less'
                          : scenario === 'rate'
                            ? 'e.g. 2'
                            : 'e.g. 50'
                      }
                      onChange={(event) => {
                        setAmount(event.target.value)
                        setError('')
                      }}
                    />
                  </Field>
                )}
              </div>
              <p className="lab-guidance">
                {scenario === 'saving'
                  ? `You currently plan ${money(result.selectedGoal!.monthly)} each month for ${result.selectedGoal!.name}. Try an extra $50 or $100.`
                  : scenario === 'debt'
                    ? 'This is in addition to your existing monthly debt payments. Your payoff strategy stays the same.'
                    : scenario === 'expense'
                      ? `Current monthly budget: ${money(
                          categoryBudget(
                            categories.find((item) => item.id === selectedCategoryId)!,
                            month,
                            monthSummary(data, month).income,
                          ),
                        )}. Enter -50 to reduce it by $50, or 50 to increase it by $50.`
                      : scenario === 'pay'
                        ? `This removes one expected paycheque of ${money(data.profile.payAmount)} from this month’s plan. Your actual income entries stay unchanged.`
                        : scenario === 'rate'
                          ? 'Enter 2 to test a rise from, for example, 19% to 21%. This tests all your debts; it does not change their saved rates.'
                          : 'Try the cost of a repair or an unexpected bill. This is a preview; record the actual purchase in Activity when it happens.'}
              </p>
              {scenario === 'saving' && (
                <details className="lab-deadline">
                  <summary>Have a target date in mind?</summary>
                  <Field label="Reach this goal in (months)">
                    <input
                      type="number"
                      min="1"
                      max="600"
                      step="1"
                      value={deadlineMonths}
                      placeholder="e.g. 12"
                      onChange={(event) => setDeadlineMonths(event.target.value)}
                    />
                  </Field>
                  {required !== null && (
                    <div>
                      <p>
                        You would need about <strong>{money(required)}/month</strong> in total for{' '}
                        {deadline} months.
                      </p>
                      <button
                        className="secondary-button compact"
                        onClick={() =>
                          setAmount(
                            String(
                              Math.max(
                                0,
                                Math.round((required - result.selectedGoal!.monthly) * 100) / 100,
                              ),
                            ),
                          )
                        }
                      >
                        Try this monthly amount
                      </button>
                    </div>
                  )}
                  {deadlineMonths !== '' && required === null && (
                    <p role="alert">Enter a whole number from 1 to 600 months.</p>
                  )}
                </details>
              )}
              {amount !== '' && !validAmount && (
                <p className="form-message" role="alert">
                  Enter a valid{' '}
                  {scenario === 'expense'
                    ? 'change between −$1,000,000 and $1,000,000'
                    : scenario === 'rate'
                      ? 'increase from 0 to 100 percentage points'
                      : 'amount from $0 to $1,000,000'}
                  .
                </p>
              )}
              {hasChange ? (
                <>
                  <div className="lab-step-heading">
                    <span>2</span>
                    <div>
                      <h3>See the difference</h3>
                      <p>A preview based on your current plan</p>
                    </div>
                  </div>
                  <div className="whatif-results">
                    <div className={result.roomAfter < 0 ? 'lab-shortfall' : 'lab-room'}>
                      <Icon name="Wallet" size={20} />
                      <span>Income left after your planned amounts</span>
                      <div className="lab-before-after">
                        <span>
                          Current plan<strong>{money(result.roomBefore)}</strong>
                        </span>
                        <Icon name="ArrowRight" size={18} />
                        <span>
                          With this idea<strong>{money(result.roomAfter)}</strong>
                        </span>
                      </div>
                      <small>
                        {result.roomAfter < 0
                          ? `${money(-result.roomAfter)} more than your expected income. Reduce another planned amount or try a smaller change.`
                          : 'Money left to assign in your monthly budget. This is not your bank balance.'}
                      </small>
                    </div>
                    {(scenario === 'debt' || scenario === 'rate') && (
                      <div>
                        <Icon name="CreditCard" size={20} />
                        <span>Time until all debts are paid</span>
                        <strong>
                          {result.debtBefore.unknownInterest
                            ? 'Add missing interest rates in Goals'
                            : `${duration(result.debtBefore.months)} → ${duration(result.debtAfter.months)}`}
                        </strong>
                        <small>
                          {result.debtBefore.unknownInterest
                            ? 'A reliable payoff estimate needs an interest rate for each debt.'
                            : `Estimated total interest: ${money(result.debtBefore.interest)} → ${money(result.debtAfter.interest)}.`}
                        </small>
                      </div>
                    )}
                    {scenario === 'saving' && (
                      <div>
                        <Icon name="Target" size={20} />
                        <span>Time to reach {result.selectedGoal!.name}</span>
                        <strong>
                          {duration(result.goalBefore!.months)} →{' '}
                          {duration(result.goalAfter!.months)}
                        </strong>
                        <small>
                          New monthly contribution:{' '}
                          {money(result.selectedGoal!.monthly + input.extraSaving)}. Assumes regular
                          contributions and your entered interest rate.
                        </small>
                      </div>
                    )}
                    {scenario === 'surprise' && payday.afterBills !== null && (
                      <div>
                        <Icon name="CalendarClock" size={20} />
                        <span>Cash estimate after this cost</span>
                        <strong>{money(payday.afterBills - input.oneTimeExpense)}</strong>
                        <small>
                          From today until payday, after upcoming bills. Separate from the selected
                          month’s budget.
                        </small>
                      </div>
                    )}
                  </div>
                  {scenario === 'expense' && result.expenseChange !== value && (
                    <p className="lab-guidance">
                      A budget cannot go below $0. This preview reduces it by{' '}
                      {money(Math.abs(result.expenseChange))}.
                    </p>
                  )}
                  {recurring ? (
                    <div className="whatif-actions">
                      <p className="whatif-note">
                        Like the result? Review exactly what will change before saving it.
                      </p>
                      <button className="primary-button compact" onClick={() => setApplyOpen(true)}>
                        Review recurring changes <Icon name="ArrowRight" size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="lab-preview-note">
                      <Icon name="Eye" size={19} />
                      <span>
                        <strong>Preview only</strong> Your budget, paycheques, and interest rates
                        have not changed.
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="lab-empty-message">
                  {scenario === 'expense' && validAmount && value < 0 && result.expenseChange === 0
                    ? 'This category already has a $0 budget. Choose another category or try an increase.'
                    : 'Enter an amount above to see a before-and-after comparison.'}
                </p>
              )}
            </>
          )}
        </div>
      )}
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      {undo && (
        <div className="undo-strip" role="status">
          Recurring plan applied.{' '}
          {undoAvailable ? (
            <button
              onClick={() => {
                update((current) =>
                  planFields(current) === planFields(undo.after)
                    ? {
                        ...current,
                        goals: undo.before.goals,
                        categories: undo.before.categories,
                        debtPlan: undo.before.debtPlan,
                      }
                    : current,
                )
                setUndo(null)
              }}
            >
              Undo
            </button>
          ) : (
            <span>The plan has since changed. Edit it in Budget or Goals.</span>
          )}
        </div>
      )}
      {applyOpen && (
        <Modal title="Apply this plan?" onClose={() => setApplyOpen(false)}>
          <div className="modal-body">
            <p className="modal-description">
              This saves planned amounts only. It does not move money or create transactions.
            </p>
            <ul className="scenario-review">
              {input.extraDebt > 0 && (
                <li>
                  Extra {money(input.extraDebt)} each month to debt payoff, with a matching budget
                  allocation.
                </li>
              )}
              {input.extraSaving > 0 && (
                <li>
                  Extra {money(input.extraSaving)} each month to {result.selectedGoal?.name}, with a
                  matching budget allocation.
                </li>
              )}
              {result.expenseChange !== 0 && (
                <li>
                  {result.expenseChange > 0 ? 'Increase' : 'Decrease'}{' '}
                  {categories.find((category) => category.id === selectedCategoryId)?.name} by{' '}
                  {money(Math.abs(result.expenseChange))} monthly.
                </li>
              )}
            </ul>
            <p className="goal-form-note">
              Budget allocations begin in {monthLabel(month)} and continue in future months.{' '}
              {scenario !== 'expense' && 'Your goal or debt plan updates now.'} Earlier transactions
              stay unchanged.
            </p>
            <strong>Income left to assign: {money(result.roomAfter)}</strong>
            {applyIssue && (
              <p className="form-message" role="alert">
                {applyIssue}
              </p>
            )}
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setApplyOpen(false)}>
                Keep exploring
              </button>
              <button
                className="primary-button"
                disabled={!!applyIssue || !hasChange}
                onClick={apply}
              >
                Apply recurring plan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
