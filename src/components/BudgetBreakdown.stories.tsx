import type { Meta, StoryObj } from '@storybook/react-vite'
import { makeDemoData } from '../lib/defaults'
import { budgetChart } from '../lib/budgetChart'
import { currentMonth, monthSummary } from '../lib/finance'
import { BudgetBreakdown } from './BudgetBreakdown'

const demo = makeDemoData()
const month = currentMonth()
const income = monthSummary(demo, month).income

const meta = {
  title: 'Budget/Breakdown',
  component: BudgetBreakdown,
  args: {
    chart: budgetChart(demo.categories, month, income),
    income,
    currency: 'CAD',
  },
} satisfies Meta<typeof BudgetBreakdown>

export default meta
type Story = StoryObj<typeof meta>

export const PlannedCategories: Story = {}
export const EmptyPlan: Story = { args: { chart: { total: 0, slices: [] } } }
