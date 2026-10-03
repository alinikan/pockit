import type { Category, MonthKey, PockitData } from '../types'
import {
  categoryActiveInMonth,
  categoryBudget,
  categoryPeriodAmount,
  categoryPolicy,
  monthSummary,
  monthlyPay,
  projectGoal,
  simulateDebtPlan,
} from './finance'
import { newCategory } from './defaults'
import { syncGoalPlans } from './goalPlans'

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
  const category = data.categories.find(
    (item) => item.id === input.categoryId && !item.archived && categoryActiveInMonth(item, month),
  )
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
      input.oneTimeExpense ?? 0,
      input.rateRise ?? 0,
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
  if (input.extraDebt === 0 && input.extraSaving === 0 && result.expenseChange === 0)
    throw new Error('Enter a recurring change before applying this plan.')
  const next = { ...data, categories: [...data.categories] }
  const changeMonthlyAmount = (category: Category, amount: number): Category => {
    const ongoingPolicy = categoryPolicy({ ...category, policyOverrides: {} }, month)
    const overrides = { ...category.overrides }
    // Keep this month's special amount/rules while applying the recurring change to future periods.
    if (Object.hasOwn(overrides, month) || category.policyOverrides?.[month])
      overrides[month] = Math.max(
        0,
        categoryBudget(category, month, monthSummary(data, month).income) + amount,
      )
    return {
      ...category,
      overrides,
      changes: {
        ...category.changes,
        [month]: Math.max(
          0,
          categoryPeriodAmount(category, month) + amount / monthlyPay(1, ongoingPolicy.frequency),
        ),
      },
    }
  }
  const reserve = (name: string, amount: number, icon: string, color: string) => {
    const existing = next.categories.find(
      (category) =>
        category.name === name && !category.archived && categoryActiveInMonth(category, month),
    )
    if (existing)
      next.categories = next.categories.map((category) =>
        category.id === existing.id ? changeMonthlyAmount(category, amount) : category,
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
    if (
      !data.categories.some(
        (category) =>
          !category.archived &&
          categoryActiveInMonth(category, month) &&
          category.linkedGoalKind === 'saving',
      )
    )
      reserve(
        `Extra savings: ${data.goals.find((goal) => goal.id === input.goalId)!.name}`,
        input.extraSaving,
        'PiggyBank',
        '#91d9c0',
      )
  }
  if (input.expenseChange !== 0) {
    const category = data.categories.find(
      (item) =>
        item.id === input.categoryId && !item.archived && categoryActiveInMonth(item, month),
    )
    if (!category) throw new Error('Choose a category for the recurring expense change.')
    if (
      categoryPolicy(category, month).mode === 'rollover' &&
      categoryPolicy(category, month).targetType !== 'fixed'
    )
      throw new Error('Edit this percentage or no-target category directly in Budget.')
    next.categories = next.categories.map((item) =>
      item.id === category.id ? changeMonthlyAmount(item, result.expenseChange) : item,
    )
  }
  const synced = syncGoalPlans(data, next, month)
  if (input.extraSaving > 0) {
    synced.categories = synced.categories.map((category) => {
      const before = data.categories.find((item) => item.id === category.id)
      if (
        !before ||
        before.archived ||
        !categoryActiveInMonth(before, month) ||
        before.linkedGoalKind !== 'saving'
      )
        return category
      if (Object.hasOwn(before.overrides, month))
        return {
          ...category,
          overrides: {
            ...category.overrides,
            [month]: before.overrides[month] + input.extraSaving,
          },
        }
      return category
    })
  }
  if (monthSummary(synced, month).unallocated < -0.001)
    throw new Error('This plan exceeds your planned monthly income.')
  return synced
}
