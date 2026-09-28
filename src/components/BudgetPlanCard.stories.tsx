import type { Meta, StoryObj } from '@storybook/react-vite'
import { BudgetPlanCard } from './BudgetPlanCard'

const meta = {
  title: 'Budget/Monthly plan',
  component: BudgetPlanCard,
  args: {
    expectedIncome: 5800,
    recordedIncome: 3150,
    allocated: 4375,
    currency: 'CAD',
  },
} satisfies Meta<typeof BudgetPlanCard>

export default meta
type Story = StoryObj<typeof meta>

export const InProgress: Story = {}
export const FullyPlanned: Story = { args: { allocated: 5800, recordedIncome: 5800 } }
export const OverPlanned: Story = { args: { allocated: 6300 } }
export const NoIncomePlan: Story = {
  args: { expectedIncome: 0, recordedIncome: 0, allocated: 0 },
}
