import type { Meta, StoryObj } from '@storybook/react-vite'
import { GoalReached, SyncIndicator } from './SaveFeedback'

const meta = {
  title: 'Feedback/Save status',
  component: SyncIndicator,
  args: { status: 'saved' },
} satisfies Meta<typeof SyncIndicator>
export default meta
type Story = StoryObj<typeof meta>
export const Saved: Story = {}
export const Syncing: Story = { args: { status: 'saving' } }
export const Offline: Story = { args: { status: 'offline' } }
export const Conflict: Story = { args: { status: 'conflict' } }
export const StorageError: Story = { args: { status: 'error' } }
export const ReachedGoal: Story = {
  render: () => <GoalReached goal={{ name: 'Emergency fund' }} onClose={() => {}} />,
}
export const LongGoalName: Story = {
  render: () => (
    <GoalReached
      goal={{ name: 'A first home and a comfortable emergency cushion for my family' }}
      onClose={() => {}}
    />
  ),
}
