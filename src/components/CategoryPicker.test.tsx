// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CategoryLibraryDialog, CategoryPicker } from './CategoryPicker'
import { makeInitialData, newCategory } from '../lib/defaults'
import { spendingCategoryLibrary } from '../lib/categoryLibrary'

afterEach(cleanup)

it('searches familiar words and stages a choice without adding data', () => {
  const onChange = vi.fn()
  const categories = [newCategory('Rent', 'House')]
  render(<CategoryPicker categories={categories} onChange={onChange} />)
  const trigger = screen.getByRole('button', { name: 'Category Choose a category' })
  fireEvent.click(trigger)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'smokes' } })
  fireEvent.click(screen.getByRole('button', { name: 'Use Cigarettes & Tobacco' }))
  expect(onChange).toHaveBeenCalledWith(
    spendingCategoryLibrary.find((item) => item.name === 'Cigarettes & Tobacco')!.id,
  )
  expect(categories).toHaveLength(1)
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it('closes only the picker on Escape and provides a useful empty result', () => {
  const outsideEscape = vi.fn()
  render(
    <div onKeyDown={outsideEscape}>
      <CategoryPicker categories={[]} onChange={() => {}} />
    </div>,
  )
  fireEvent.click(screen.getByRole('button', { name: /Choose a category/ }))
  const search = screen.getByRole('searchbox')
  fireEvent.change(search, { target: { value: 'nothingmatches1234' } })
  expect(screen.getByText(/No matching category/)).toBeTruthy()
  fireEvent.keyDown(search, { key: 'Escape' })
  expect(outsideEscape).not.toHaveBeenCalled()
  expect(screen.queryByRole('searchbox')).toBeNull()
})

it('keeps bulk choices through filtering and cancel never adds them', () => {
  const onAdd = vi.fn(),
    onClose = vi.fn()
  render(<CategoryLibraryDialog data={makeInitialData()} onAdd={onAdd} onClose={onClose} />)
  fireEvent.click(screen.getByRole('checkbox', { name: /Toys & Games/ }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cigarettes' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /Cigarettes & Tobacco/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onAdd).not.toHaveBeenCalled()
  expect(onClose).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Add 2 categories' }))
  expect(onAdd.mock.calls[0][0]).toHaveLength(2)
})
