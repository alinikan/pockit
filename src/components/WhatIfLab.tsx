import { useState } from 'react'
import type { MonthKey, PockitData } from '../types'
import { money } from '../lib/finance'
import { calculateScenario } from '../lib/scenarios'
import { Icon, SectionHead } from './UI'

export function WhatIfLab({ data, month }: { data: PockitData; month: MonthKey }) {
  const [extraDebt, setExtraDebt] = useState(0)
  const [extraSaving, setExtraSaving] = useState(0)
  const [expenseChange, setExpenseChange] = useState(0)
  const [goalId, setGoalId] = useState(data.goals.find((goal) => goal.kind === 'saving')?.id || '')
  const savings = data.goals.filter((goal) => goal.kind === 'saving')
  const selectedGoalId = savings.some((goal) => goal.id === goalId) ? goalId : savings[0]?.id || ''
  const result = calculateScenario(data, month, {
    extraDebt,
    extraSaving,
    expenseChange,
    goalId: selectedGoalId,
  })
  const currency = data.settings.currency
  const months = (value: number | null) =>
    value === null
      ? 'No payoff at this payment'
      : value === 0
        ? 'Already reached'
        : `${value} ${value === 1 ? 'month' : 'months'}`
  return (
    <section className="panel whatif-panel" aria-label="What-if Lab">
      <SectionHead
        title="What-if Lab"
        help="Try changes without changing your real budget. Pockit recalculates the estimated dates using your current balances, rates, and monthly payments."
      />
      <p className="panel-subtitle">
        Explore a plan. These sliders never save changes or move money.
      </p>
      <div className="whatif-controls">
        <label>
          Extra toward debt each month <strong>{money(extraDebt, currency)}</strong>
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            value={extraDebt}
            onChange={(e) => setExtraDebt(Number(e.target.value))}
          />
        </label>
        <label>
          Extra toward a savings goal <strong>{money(extraSaving, currency)}</strong>
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            value={extraSaving}
            onChange={(e) => setExtraSaving(Number(e.target.value))}
          />
        </label>
        <label>
          Other monthly expense change{' '}
          <strong>
            {expenseChange >= 0 ? '+' : '−'}
            {money(Math.abs(expenseChange), currency)}
          </strong>
          <input
            type="range"
            min="-300"
            max="300"
            step="10"
            value={expenseChange}
            onChange={(e) => setExpenseChange(Number(e.target.value))}
          />
        </label>
        {savings.length > 0 && (
          <label>
            Savings goal
            <select value={selectedGoalId} onChange={(e) => setGoalId(e.target.value)}>
              {savings.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="whatif-results">
        <div>
          <Icon name="Wallet" size={19} />
          <span>Unallocated monthly plan</span>
          <strong>
            {money(result.roomBefore, currency)} → {money(result.roomAfter, currency)}
          </strong>
          <small>
            {result.roomAfter < 0
              ? 'This scenario plans more than your estimated income.'
              : 'After your current allocations and these changes.'}
          </small>
        </div>
        {result.debtBefore.order.length > 0 && (
          <div>
            <Icon name="CreditCard" size={19} />
            <span>All debts paid off</span>
            <strong>
              {months(result.debtBefore.months)} → {months(result.debtAfter.months)}
            </strong>
            <small>Uses your debt payoff strategy and current interest rates.</small>
          </div>
        )}
        {result.selectedGoal && (
          <div>
            <Icon name="Target" size={19} />
            <span>{result.selectedGoal.name} reached</span>
            <strong>
              {months(result.goalBefore!.months)} → {months(result.goalAfter!.months)}
            </strong>
            <small>Based on a fixed monthly contribution and current annual interest.</small>
          </div>
        )}
      </div>
      <p className="whatif-note">
        Estimates assume payments and rates stay the same. “Unallocated” is a budget figure, not
        cash in your bank account.
      </p>
    </section>
  )
}
