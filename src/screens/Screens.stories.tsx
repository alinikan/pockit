import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { makeDemoData } from '../lib/defaults'
import { currentMonth } from '../lib/finance'
import type { PockitData } from '../types'
import { HomeScreen } from './Home'
import { GoalsScreen } from './Goals'
import { CompareScreen } from './Compare'
import { ActivityScreen } from './Activity'

function ScreenPreview({ screen }: { screen: 'Home' | 'Activity' | 'Goals' | 'Compare' }) {
  const [data, setData] = useState<PockitData>(() => makeDemoData())
  const month = currentMonth()
  const update = (recipe: (value: PockitData) => PockitData) => setData(recipe)

  if (screen === 'Home')
    return (
      <HomeScreen
        data={data}
        month={month}
        setTab={() => {}}
        onAddIncome={() => {}}
        update={update}
      />
    )
  if (screen === 'Goals') return <GoalsScreen data={data} month={month} update={update} />
  if (screen === 'Activity') return <ActivityScreen data={data} month={month} update={update} />
  return <CompareScreen data={data} month={month} />
}

const meta = {
  title: 'Screens',
  component: ScreenPreview,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof ScreenPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Home: Story = { args: { screen: 'Home' } }
export const Activity: Story = { args: { screen: 'Activity' } }
export const Goals: Story = { args: { screen: 'Goals' } }
export const Compare: Story = { args: { screen: 'Compare' } }
