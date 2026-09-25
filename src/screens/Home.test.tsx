// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeDemoData } from '../lib/defaults'
import type { PockitData } from '../types'
import { currentMonth } from '../lib/finance'
import { HomeScreen } from './Home'

afterEach(cleanup)

describe('Home customization', () => {
  it('hides, reorders, and resets sections without changing money data', () => {
    let data: PockitData = makeDemoData()
    const before = JSON.stringify(data.transactions)
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    const view = () => (
      <HomeScreen
        data={data}
        month={currentMonth()}
        setTab={() => {}}
        openCoach={() => {}}
        update={update}
      />
    )
    const { rerender, container } = render(view())
    fireEvent.click(screen.getByRole('button', { name: 'Customize Home' }))
    const modal = screen.getByRole('dialog', { name: 'Customize Home' })
    fireEvent.click(within(modal).getByRole('checkbox', { name: /Weekly check-in/ }))
    rerender(view())
    expect(screen.queryByLabelText('Pockit Pulse')).toBeNull()
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Move Income and expenses up',
      }),
    )
    rerender(view())
    expect(data.settings.homeOrder?.at(-2)).toBe('trends')
    const cards = [...container.querySelectorAll('.screen-stack > [style*="order:"]')]
    expect(cards.length).toBeGreaterThan(4)
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset layout' }),
    )
    rerender(view())
    expect(screen.getByLabelText('Pockit Pulse')).toBeTruthy()
    expect(data.settings.homeOrder).toBeUndefined()
    expect(JSON.stringify(data.transactions)).toBe(before)
  })
})
