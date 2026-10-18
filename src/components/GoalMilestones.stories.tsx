import type { Meta, StoryObj } from '@storybook/react-vite'
import { GoalMilestones } from './GoalMilestones'
const meta = {
  title: 'Goals/Savings checkpoints',
  component: GoalMilestones,
  args: {
    goal: {
      id: 'demo',
      name: 'Emergency fund',
      kind: 'saving',
      balance: 2350,
      target: 6000,
      monthly: 300,
      annualInterest: 0,
      color: '#b9b4ff',
      icon: 'Flag',
      history: [],
    },
  },
} satisfies Meta<typeof GoalMilestones>
export default meta
type Story = StoryObj<typeof meta>
export const InProgress: Story = {}
export const NoMonthlyAmount: Story = { args: { goal: { ...meta.args.goal, monthly: 0 } } }
export const Reached: Story = { args: { goal: { ...meta.args.goal, balance: 6000 } } }
export const SmallGoal: Story = { args: { goal: { ...meta.args.goal, target: 0.01, balance: 0 } } }
