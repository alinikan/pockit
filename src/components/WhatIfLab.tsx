import { useState } from 'react'
import type { MonthKey, PockitData } from '../types'
import { money, todayISO } from '../lib/finance'
import { applyScenario, calculateScenario, requiredMonthlySaving } from '../lib/scenarios'
import { paychequeForecast } from '../lib/payday'
import { Field, Icon, Modal, SectionHead } from './UI'

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
  const [goalId, setGoalId] = useState(savings[0]?.id || '')
  const [extraDebt, setExtraDebt] = useState(0)
  const [extraSaving, setExtraSaving] = useState(0)
  const [expenseChange, setExpenseChange] = useState(0)
  const [categoryId, setCategoryId] = useState(
    data.categories.find((category) => !category.archived)?.id || '',
  )
  const [oneTimeExpense, setOneTimeExpense] = useState(0)
  const [missedPay, setMissedPay] = useState(false)
  const [rateRise, setRateRise] = useState(0)
  const [deadlineMonths, setDeadlineMonths] = useState(0)
  const [applyOpen, setApplyOpen] = useState(false)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<{ before: PockitData; after: PockitData } | null>(null)
  const selectedGoalId = savings.some((goal) => goal.id === goalId) ? goalId : savings[0]?.id || ''
  const selectedCategoryId = data.categories.some((category) => category.id === categoryId)
    ? categoryId
    : data.categories[0]?.id || ''
  const input = {
    extraDebt,
    extraSaving,
    expenseChange,
    goalId: selectedGoalId,
    categoryId: selectedCategoryId,
    oneTimeExpense,
    missedPay,
    rateRise,
  }
  const result = calculateScenario(data, month, input)
  const payday = paychequeForecast(data, todayISO())
  const required =
    result.selectedGoal && deadlineMonths > 0
      ? requiredMonthlySaving(
          result.selectedGoal.balance,
          result.selectedGoal.target,
          result.selectedGoal.annualInterest,
          deadlineMonths,
        )
      : null
  const canApply =
    !missedPay &&
    !oneTimeExpense &&
    !rateRise &&
    (extraDebt > 0 || extraSaving > 0 || result.expenseChange !== 0)
  const duration = (value: number | null) =>
    value === null
      ? 'No finish date at this payment'
      : value === 0
        ? 'Already reached'
        : `${value} ${value === 1 ? 'month' : 'months'}`
  function preset(name: string) {
    setExtraDebt(0)
    setExtraSaving(0)
    setExpenseChange(0)
    setOneTimeExpense(0)
    setMissedPay(false)
    setRateRise(0)
    setError('')
    if (name === 'pay') setMissedPay(true)
    if (name === 'rent') {
      setExpenseChange(150)
      setCategoryId(
        data.categories.find((category) => /rent|mortgage/i.test(category.name))?.id ||
          selectedCategoryId,
      )
    }
    if (name === 'repair') setOneTimeExpense(900)
    if (name === 'rate') setRateRise(2)
    if (name === 'debt') setExtraDebt(50)
  }
  function apply() {
    try {
      const next = applyScenario(data, month, input)
      setUndo({ before: data, after: next })
      update((current) => (current === data ? next : current))
      setApplyOpen(false)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not apply that plan.')
      setApplyOpen(false)
    }
  }
  return (
    <section className="panel whatif-panel" aria-label="What-if Lab">
      <SectionHead
        title="What-if Lab"
        help="Try a change without saving it. Projections use your current balances, fixed interest rates, and monthly amounts. Apply recurring changes only after reviewing them."
      />
      <p className="panel-subtitle">
        Test a surprise or a new habit. Your real budget stays as it is until you choose Apply.
      </p>
      <div className="scenario-presets" aria-label="Quick scenarios">
        {(
          [
            ['pay', 'Miss a paycheque', 'Wallet'],
            ['rent', 'Housing +$150', 'House'],
            ['repair', '$900 repair', 'Wrench'],
            ['rate', 'Interest +2%', 'Percent'],
            ['debt', 'Extra $50 debt', 'CreditCard'],
          ] as const
        ).map(([id, label, icon]) => (
          <button key={id} onClick={() => preset(id)}>
            <Icon name={icon} size={19} />
            {label}
          </button>
        ))}
      </div>
      <div className="whatif-controls">
        <Field label="Extra debt payment each month">
          <input
            type="number"
            min="0"
            max="100000"
            step="10"
            value={extraDebt}
            onChange={(event) => setExtraDebt(Math.max(0, Number(event.target.value) || 0))}
          />
        </Field>
        <Field label="Extra to a savings goal each month">
          <input
            type="number"
            min="0"
            max="100000"
            step="10"
            value={extraSaving}
            onChange={(event) => setExtraSaving(Math.max(0, Number(event.target.value) || 0))}
          />
        </Field>
        <Field label="Recurring monthly expense change">
          <input
            type="number"
            min="-100000"
            max="100000"
            step="10"
            value={expenseChange}
            onChange={(event) => setExpenseChange(Number(event.target.value) || 0)}
          />
        </Field>
        {expenseChange !== 0 && (
          <Field label="Category affected">
            <select
              value={selectedCategoryId}
              onChange={(event) => setCategoryId(event.target.value)}
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
        )}
        <Field label="One-time surprise expense">
          <input
            type="number"
            min="0"
            max="1000000"
            step="10"
            value={oneTimeExpense}
            onChange={(event) => setOneTimeExpense(Math.max(0, Number(event.target.value) || 0))}
          />
        </Field>
        <Field label="Interest rate rise (percentage points)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.25"
            value={rateRise}
            onChange={(event) => setRateRise(Math.max(0, Number(event.target.value) || 0))}
          />
        </Field>
        <label className="check-line">
          <input
            type="checkbox"
            checked={missedPay}
            onChange={(event) => setMissedPay(event.target.checked)}
          />{' '}
          Miss one paycheque of {money(data.profile.payAmount)}
        </label>
        {savings.length > 0 && (
          <Field label="Savings goal">
            <select value={selectedGoalId} onChange={(event) => setGoalId(event.target.value)}>
              {savings.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {result.selectedGoal && (
          <Field label="Reach this goal in (months)">
            <input
              type="number"
              min="1"
              max="600"
              value={deadlineMonths || ''}
              onChange={(event) =>
                setDeadlineMonths(Math.max(0, Math.floor(Number(event.target.value) || 0)))
              }
              placeholder="Optional"
            />
          </Field>
        )}
      </div>
      <div className="whatif-results">
        <div>
          <Icon name="Wallet" size={19} />
          <span>Room in this month's plan</span>
          <strong>
            {money(result.roomBefore)} → {money(result.roomAfter)}
          </strong>
          <small>
            {result.roomAfter < 0
              ? 'This scenario exceeds planned income. Reduce or delay something before applying.'
              : 'Expected pay after planned category amounts and the changes above.'}
          </small>
        </div>
        {payday.afterBills !== null && oneTimeExpense > 0 && (
          <div>
            <Icon name="CalendarClock" size={19} />
            <span>Estimate until payday after surprise</span>
            <strong>{money(payday.afterBills - oneTimeExpense)}</strong>
            <small>Only the one-time expense is added to this cash estimate.</small>
          </div>
        )}
        {result.debtBefore.order.length > 0 && (
          <div>
            <Icon name="CreditCard" size={19} />
            <span>All debts paid off</span>
            <strong>
              {result.debtBefore.unknownInterest
                ? 'Add missing interest rates'
                : `${duration(result.debtBefore.months)} → ${duration(result.debtAfter.months)}`}
            </strong>
            <small>
              {result.debtBefore.unknownInterest
                ? 'Waypoint did not provide every debt rate, so Pockit cannot calculate this payoff scenario yet.'
                : `Estimated total interest: ${money(result.debtBefore.interest)} → ${money(result.debtAfter.interest)}.`}
            </small>
          </div>
        )}
        {result.selectedGoal && (
          <div>
            <Icon name="Target" size={19} />
            <span>{result.selectedGoal.name} reached</span>
            <strong>
              {duration(result.goalBefore!.months)} → {duration(result.goalAfter!.months)}
            </strong>
            <small>Fixed monthly contribution and current annual interest assumed.</small>
          </div>
        )}
        {required !== null && result.selectedGoal && (
          <div>
            <Icon name="TrendingUp" size={19} />
            <span>To reach it in {deadlineMonths} months</span>
            <strong>{money(required)} per month</strong>
            <small>
              {money(Math.max(0, required - result.selectedGoal.monthly))} more than your current
              monthly contribution.
            </small>
          </div>
        )}
      </div>
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <div className="whatif-actions">
        <p className="whatif-note">
          Estimates assume fixed rates and regular payments. A plan is not cash in your bank.
          One-time and rate-change examples remain previews.
        </p>
        <button
          className="primary-button compact"
          disabled={!canApply || result.roomAfter < 0}
          onClick={() => setApplyOpen(true)}
        >
          Review recurring changes <Icon name="ArrowRight" size={16} />
        </button>
      </div>
      {undo && (
        <div className="undo-strip" role="status">
          Recurring plan applied.{' '}
          <button
            onClick={() => {
              update((current) =>
                JSON.stringify({
                  goals: current.goals,
                  categories: current.categories,
                  debtPlan: current.debtPlan,
                }) ===
                JSON.stringify({
                  goals: undo.after.goals,
                  categories: undo.after.categories,
                  debtPlan: undo.after.debtPlan,
                })
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
        </div>
      )}
      {applyOpen && (
        <Modal title="Apply this plan?" onClose={() => setApplyOpen(false)}>
          <div className="modal-body">
            <p className="modal-description">
              Only recurring planned amounts change. Pockit does not move money or change any bank
              account.
            </p>
            <ul className="scenario-review">
              {extraDebt > 0 && <li>Extra {money(extraDebt)} each month to debt payoff</li>}
              {extraSaving > 0 && (
                <li>
                  Extra {money(extraSaving)} each month to {result.selectedGoal?.name}
                </li>
              )}
              {result.expenseChange !== 0 && (
                <li>
                  {result.expenseChange > 0 ? 'Increase' : 'Decrease'}{' '}
                  {data.categories.find((category) => category.id === selectedCategoryId)?.name} by{' '}
                  {money(Math.abs(result.expenseChange))} monthly from {month}
                </li>
              )}
            </ul>
            <strong>Room after these changes: {money(result.roomAfter)}</strong>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setApplyOpen(false)}>
                Keep exploring
              </button>
              <button className="primary-button" onClick={apply}>
                Apply recurring plan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}
