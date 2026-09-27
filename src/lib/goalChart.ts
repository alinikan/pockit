import type { Goal } from '../types'
import { projectGoal } from './finance'

export interface GoalChartData {
  months: number
  values: number[]
  labels: string[]
  reachesGoal: boolean
  completedNow: boolean
}

export function goalChartData(goal: Goal, now = new Date()): GoalChartData {
  const projectedMonths = projectGoal(goal).months
  const completedNow = projectedMonths === 0
  const reachesGoal = projectedMonths !== null && !completedNow
  // A goal with no finish date gets a clearly labelled two-year preview.
  const months = projectedMonths === null ? 24 : Math.max(1, projectedMonths)
  const rate = Math.max(0, goal.annualInterest) / 1200
  const monthly = Math.max(0, goal.monthly)
  const values = [Math.max(0, goal.balance)]
  for (let index = 1; index <= months; index++) {
    const previous = values[index - 1]
    const next = completedNow
      ? previous
      : goal.kind === 'debt'
        ? Math.max(0, previous * (1 + rate) - monthly)
        : previous * (1 + rate) + monthly
    values.push(Number.isFinite(next) ? next : previous)
  }
  const labels = values.map((_, index) =>
    new Intl.DateTimeFormat('en-CA', { month: 'short', year: 'numeric' }).format(
      new Date(now.getFullYear(), now.getMonth() + index, 1),
    ),
  )
  return { months, values, labels, reachesGoal, completedNow }
}

export function pointFromPosition(clientX: number, left: number, width: number, months: number) {
  if (!Number.isFinite(clientX) || !Number.isFinite(left) || width <= 0) return 0
  const ratio = Math.max(0, Math.min(1, (clientX - left) / width))
  return Math.round(ratio * months)
}
