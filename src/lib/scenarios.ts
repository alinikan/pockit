import type { MonthKey, PockitData } from '../types'
import { monthSummary, projectGoal, simulateDebtPlan } from './finance'

export interface ScenarioInput {
  extraDebt: number
  extraSaving: number
  expenseChange: number
  goalId: string
}

export function calculateScenario(data: PockitData, month: MonthKey, input: ScenarioInput) {
  const extraDebt = Math.max(0, Number.isFinite(input.extraDebt) ? input.extraDebt : 0)
  const extraSaving = Math.max(0, Number.isFinite(input.extraSaving) ? input.extraSaving : 0)
  const expenseChange = Number.isFinite(input.expenseChange) ? input.expenseChange : 0
  const summary = monthSummary(data, month)
  const roomBefore = summary.income - summary.allocated
  const roomAfter = roomBefore - extraDebt - extraSaving - expenseChange
  const debtPlan = data.debtPlan || { strategy: 'interest' as const, extra: 0, order: [] }
  const debtBefore = simulateDebtPlan(data.goals, debtPlan)
  const debtAfter = simulateDebtPlan(data.goals, { ...debtPlan, extra: debtPlan.extra + extraDebt })
  const selectedGoal = data.goals.find((goal) => goal.id === input.goalId && goal.kind === 'saving')
  const goalBefore = selectedGoal ? projectGoal(selectedGoal) : null
  const goalAfter = selectedGoal ? projectGoal(selectedGoal, extraSaving) : null
  return { roomBefore, roomAfter, debtBefore, debtAfter, goalBefore, goalAfter, selectedGoal }
}
