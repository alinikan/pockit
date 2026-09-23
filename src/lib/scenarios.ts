import type { MonthKey, PockitData } from '../types'
import {
  categoryBudget,
  categoryPeriodAmount,
  monthSummary,
  monthlyPay,
  projectGoal,
  simulateDebtPlan,
} from './finance'
import { newCategory } from './defaults'

export interface ScenarioInput {
  extraDebt: number
  extraSaving: number
  expenseChange: number
  goalId: string
  missedPay?: boolean
  oneTimeExpense?: number
  rateRise?: number
  categoryId?: string
}

export function requiredMonthlySaving(
  balance: number,
  target: number,
  annualInterest: number,
  months: number,
) {
  if (!Number.isFinite(months) || months <= 0) return null
  const rate = Math.max(0, annualInterest) / 1200
  const gap = target - balance * Math.pow(1 + rate, months)
  if (gap <= 0) return 0
  if (rate === 0) return Math.ceil((gap / months) * 100) / 100
  return Math.ceil(((gap * rate) / (Math.pow(1 + rate, months) - 1)) * 100) / 100
}

export function calculateScenario(data: PockitData, month: MonthKey, input: ScenarioInput) {
  const extraDebt = Math.max(0, Number.isFinite(input.extraDebt) ? input.extraDebt : 0)
  const extraSaving = Math.max(0, Number.isFinite(input.extraSaving) ? input.extraSaving : 0)
  const requestedExpenseChange = Number.isFinite(input.expenseChange) ? input.expenseChange : 0
  const oneTimeExpense = Math.max(
    0,
    Number.isFinite(input.oneTimeExpense) ? input.oneTimeExpense! : 0,
  )
  const rateRise = Math.max(0, Number.isFinite(input.rateRise) ? input.rateRise! : 0)
  const summary = monthSummary(data, month)
  const category = data.categories.find((item) => item.id === input.categoryId)
  const expenseChange =
    category && requestedExpenseChange < 0
      ? Math.max(requestedExpenseChange, -categoryBudget(category, month, summary.income))
      : requestedExpenseChange
  const roomBefore = summary.income - summary.allocated
  const roomAfter =
    roomBefore -
    extraDebt -
    extraSaving -
    expenseChange -
    oneTimeExpense -
    (input.missedPay ? data.profile.payAmount : 0)
  const debtPlan = data.debtPlan || { strategy: 'interest' as const, extra: 0, order: [] }
  const debtBefore = simulateDebtPlan(data.goals, debtPlan)
  const debtAfter = simulateDebtPlan(
    data.goals.map((goal) =>
      goal.kind === 'debt' ? { ...goal, annualInterest: goal.annualInterest + rateRise } : goal,
    ),
    { ...debtPlan, extra: debtPlan.extra + extraDebt },
  )
  const selectedGoal = data.goals.find((goal) => goal.id === input.goalId && goal.kind === 'saving')
  const goalBefore = selectedGoal ? projectGoal(selectedGoal) : null
  const goalAfter = selectedGoal ? projectGoal(selectedGoal, extraSaving) : null
  return {
    roomBefore,
    roomAfter,
    debtBefore,
    debtAfter,
    goalBefore,
    goalAfter,
    selectedGoal,
    oneTimeExpense,
    missedPayAmount: input.missedPay ? data.profile.payAmount : 0,
    rateRise,
    expenseChange,
  }
}

export function applyScenario(data: PockitData, month: MonthKey, input: ScenarioInput): PockitData {
  if (
    ![
      input.extraDebt,
      input.extraSaving,
      input.expenseChange,
      input.oneTimeExpense || 0,
      input.rateRise || 0,
    ].every(Number.isFinite)
  )
    throw new Error('Enter valid amounts before applying this plan.')
  if (input.extraDebt < 0 || input.extraSaving < 0)
    throw new Error('Extra debt and savings amounts cannot be negative.')
  if (input.missedPay || input.oneTimeExpense || input.rateRise)
    throw new Error(
      'One-time or rate-change scenarios are previews. Apply recurring changes separately.',
    )
  const result = calculateScenario(data, month, input)
  if (result.roomAfter < -0.001) throw new Error('This plan exceeds your planned monthly income.')
  const next = { ...data, categories: [...data.categories] }
  const reserve = (name: string, amount: number, icon: string, color: string) => {
    const existing = next.categories.find(
      (category) => category.name === name && !category.archived,
    )
    if (existing)
      next.categories = next.categories.map((category) =>
        category.id === existing.id
          ? {
              ...category,
              changes: {
                ...category.changes,
                [month]: categoryPeriodAmount(category, month) + amount,
              },
            }
          : category,
      )
    else next.categories.push(newCategory(name, icon, 'Savings & Goals', color, amount, month))
  }
  if (input.extraDebt > 0) {
    if (!data.goals.some((goal) => goal.kind === 'debt' && goal.balance > 0))
      throw new Error('Add a debt goal before applying an extra debt payment.')
    next.debtPlan = {
      ...(data.debtPlan || { strategy: 'interest' as const, extra: 0, order: [] }),
      extra: (data.debtPlan?.extra || 0) + input.extraDebt,
    }
    reserve('Extra debt payments', input.extraDebt, 'CreditCard', '#f29a91')
  }
  if (input.extraSaving > 0) {
    if (!data.goals.some((goal) => goal.id === input.goalId && goal.kind === 'saving'))
      throw new Error('Choose a savings goal first.')
    next.goals = data.goals.map((goal) =>
      goal.id === input.goalId && goal.kind === 'saving'
        ? { ...goal, monthly: goal.monthly + input.extraSaving }
        : goal,
    )
    reserve(
      `Extra savings: ${data.goals.find((goal) => goal.id === input.goalId)!.name}`,
      input.extraSaving,
      'PiggyBank',
      '#91d9c0',
    )
  }
  if (input.expenseChange !== 0) {
    const category = data.categories.find((item) => item.id === input.categoryId)
    if (!category) throw new Error('Choose a category for the recurring expense change.')
    if (category.mode === 'rollover' && category.targetType !== 'fixed')
      throw new Error('Edit this percentage or no-target category directly in Budget.')
    next.categories = next.categories.map((item) =>
      item.id === category.id
        ? {
            ...item,
            changes: {
              ...item.changes,
              [month]: Math.max(
                0,
                categoryPeriodAmount(item, month) +
                  result.expenseChange / monthlyPay(1, item.frequency),
              ),
            },
          }
        : item,
    )
  }
  return next
}
