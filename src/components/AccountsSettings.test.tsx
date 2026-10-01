// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AccountsSettings } from './AccountsSettings'
import { makeInitialData, newCategory } from '../lib/defaults'
import { parseBackup } from '../lib/backup'

afterEach(cleanup)
describe('manual investment account setup', () => {
  it('creates a zero-balance TFSA with the chosen investment category and restores it correctly', () => {
    let data = makeInitialData()
    data.categories = [
      newCategory('Investments', 'TrendingUp', 'Savings & Goals', '#123456', 200, '2026-09'),
    ]
    render(
      <AccountsSettings
        data={data}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.change(screen.getByLabelText('Account name'), {
      target: { value: 'Wealthsimple TFSA' },
    })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'tfsa' } })
    expect(
      (screen.getByRole('button', { name: 'Add account' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect((screen.getByLabelText('Contribution category') as HTMLSelectElement).value).toBe(
      data.categories[0].id,
    )
    fireEvent.change(screen.getByLabelText('Balance today in CAD'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))
    expect(data.accounts![0]).toMatchObject({
      name: 'Wealthsimple TFSA',
      kind: 'investment',
      subtype: 'TFSA',
      openingBalance: 0,
      contributionCategoryId: data.categories[0].id,
    })
    expect(parseBackup(JSON.stringify(data)).accounts![0].subtype).toBe('TFSA')
  })
  it('allows choosing the contribution category later without silently assigning one', () => {
    let data = makeInitialData()
    data.categories = [
      newCategory('Investments', 'TrendingUp', 'Savings & Goals', '#123456', 200, '2026-09'),
    ]
    render(
      <AccountsSettings
        data={data}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.change(screen.getByLabelText('Account name'), { target: { value: 'TFSA' } })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'tfsa' } })
    fireEvent.change(screen.getByLabelText('Contribution category'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Balance today in CAD'), {
      target: { value: '1250.63' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))
    expect(data.accounts![0].contributionCategoryId).toBe('')
    expect(data.accounts![0].openingBalance).toBe(1250.63)
  })
})
