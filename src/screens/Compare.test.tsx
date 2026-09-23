// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { makeDemoData } from '../lib/defaults'
import { currentMonth } from '../lib/finance'
import { CompareScreen } from './Compare'

afterEach(cleanup)

describe('Compare screen', () => {
  it('lets someone choose extra months and switch comparison views', () => {
    render(<CompareScreen data={makeDemoData()} month={currentMonth()} />)
    expect(screen.getByText('Expenses, side by side')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add month' }))
    expect(screen.getByLabelText('MONTH 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Categories/ }))
    expect(screen.getByText('Category by category')).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Include $0 categories'))
    expect((screen.getByLabelText('Include $0 categories') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: /Trend/ }))
    expect(screen.getByText('The longer view', { selector: 'h3' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Plan vs actual/ }))
    expect(screen.getByText('Plan vs actual', { selector: 'h3' })).toBeTruthy()
  })

  it('prevents duplicate comparison months', () => {
    render(<CompareScreen data={makeDemoData()} month={currentMonth()} />)
    const baseline = screen.getByLabelText('BASELINE') as HTMLInputElement
    const second = screen.getByLabelText('MONTH 2') as HTMLInputElement
    const original = second.value
    fireEvent.change(second, { target: { value: baseline.value } })
    expect(second.value).toBe(original)
    expect(screen.getByRole('alert').textContent).toContain('different month')
    fireEvent.change(baseline, { target: { value: '2024-12' } })
    expect((screen.getByLabelText('BASELINE') as HTMLInputElement).value).toBe('2024-12')
    expect(screen.getByText(/December 2024/, { selector: '.compare-column-index' })).toBeTruthy()
  })
})
