import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { goalChartData, pointFromPosition } from './goalChart'

const demoGoals = makeDemoData().goals

describe('goal chart projection', () => {
  it('shows every month through a debt payoff, including dates past 24 months', () => {
    const debt = {
      ...demoGoals.find((goal) => goal.kind === 'debt')!,
      balance: 2700,
      monthly: 100,
      annualInterest: 0,
    }
    const chart = goalChartData(debt, new Date(2026, 8, 27))
    expect(chart.months).toBe(27)
    expect(chart.values).toHaveLength(28)
    expect(chart.values[0]).toBe(2700)
    expect(chart.values.at(-1)).toBe(0)
    expect(chart.labels[0]).toMatch(/Sep 2026/)
    expect(chart.labels.at(-1)).toMatch(/Dec 2028/)
    expect(chart.reachesGoal).toBe(true)
  })

  it('labels a no-payment debt as a preview rather than implying payoff', () => {
    const debt = {
      ...demoGoals.find((goal) => goal.kind === 'debt')!,
      monthly: 0,
      annualInterest: 12,
    }
    const chart = goalChartData(debt, new Date(2026, 8, 27))
    expect(chart.months).toBe(24)
    expect(chart.reachesGoal).toBe(false)
    expect(chart.values.at(-1)).toBeGreaterThan(chart.values[0])
  })

  it('does not move an already completed goal into the future', () => {
    const saving = {
      ...demoGoals.find((goal) => goal.kind === 'saving')!,
      balance: 6000,
      target: 6000,
    }
    const chart = goalChartData(saving, new Date(2026, 8, 27))
    expect(chart.completedNow).toBe(true)
    expect(chart.reachesGoal).toBe(false)
    expect(chart.values).toEqual([6000, 6000])
  })

  it('keeps inspection inside the chart and handles a zero-width layout', () => {
    expect(pointFromPosition(-100, 10, 300, 20)).toBe(0)
    expect(pointFromPosition(160, 10, 300, 20)).toBe(10)
    expect(pointFromPosition(900, 10, 300, 20)).toBe(20)
    expect(pointFromPosition(160, 10, 0, 20)).toBe(0)
  })
})
