// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { PockitData } from '../types'
import { currentMonth, todayISO } from '../lib/finance'
import { accountBalance } from '../lib/ledger'
import { makeDemoData } from '../lib/defaults'
import { ActivityScreen } from './Activity'

afterEach(cleanup)

describe('activity', () => {
  it('both save buttons reject a split without a category and accept a valid library selection', () => {
    const data = makeDemoData()
    render(<ActivityScreen data={data} month={currentMonth()} update={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Split between categories' }))
    fireEvent.click(screen.getByRole('button', { name: /^Split 1 category / }))
    fireEvent.click(screen.getByRole('button', { name: 'No category' }))
    for (const name of ['Save transaction', 'Save & add another'])
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /^Split 1 category / }))
    fireEvent.click(screen.getByRole('button', { name: 'Use Toys & Games' }))
    for (const name of ['Save transaction', 'Save & add another'])
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('saves a library category and blank description together, and keeps an explicit choice when the description changes', () => {
    let data = makeDemoData()
    const before = data.categories.length
    render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Category Choose a category/ }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'smokes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use Cigarettes & Tobacco' }))
    fireEvent.change(screen.getByLabelText('Store or purchase (optional)'), {
      target: { value: 'Walmart' },
    })
    expect(screen.getByRole('button', { name: 'Category Cigarettes & Tobacco' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Store or purchase (optional)'), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '24.75' } })
    expect(data.categories).toHaveLength(before)
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(data.categories).toHaveLength(before + 1)
    const added = data.categories.find((item) => item.name === 'Cigarettes & Tobacco')!
    expect(added.baseAmount).toBe(0)
    expect(data.transactions.at(-1)).toMatchObject({
      payee: 'Cigarettes & Tobacco',
      categoryId: added.id,
      amount: 24.75,
    })
  })
  it('cancelling a library choice never adds a category', () => {
    let data = makeDemoData()
    const before = data.categories.length
    render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Category Choose a category/ }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'toys' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use Toys & Games' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(data.categories).toHaveLength(before)
  })
  it.each(['add', 'included'] as const)(
    'offers income categories and previews the %s balance choice before saving',
    (mode) => {
      let data = makeDemoData()
      data.transactions = []
      data.accounts = [
        { id: 'cash', name: 'Chequing', kind: 'chequing', openingBalance: 1000, asOf: todayISO() },
      ]
      render(
        <ActivityScreen
          data={data}
          month={currentMonth()}
          update={(recipe) => {
            data = recipe(data)
          }}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Record income' }))
      expect(screen.queryByText('No category')).toBeNull()
      const category = screen.getByRole('combobox', { name: /Income category/ })
      expect(category.querySelectorAll('option')).toHaveLength(7)
      expect(category.textContent).not.toContain('Groceries')
      fireEvent.change(category, { target: { value: 'benefits' } })
      fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '250' } })
      fireEvent.change(screen.getByLabelText('Income from'), {
        target: { value: 'Benefit deposit' },
      })
      expect(
        (screen.getByRole('button', { name: 'Save transaction' }) as HTMLButtonElement).disabled,
      ).toBe(true)
      fireEvent.click(
        screen.getByRole('radio', {
          name: mode === 'add' ? /Yes, add this income/ : /No, it’s already included/,
        }),
      )
      expect(
        (screen.getByRole('button', { name: 'Save transaction' }) as HTMLButtonElement).disabled,
      ).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
      expect(data.transactions[0]).toMatchObject({
        type: 'income',
        incomeCategory: 'benefits',
        balancePosting: { mode },
      })
      expect(data.transactions[0].categoryId).toBeUndefined()
      expect(accountBalance(data.accounts![0], data.transactions, todayISO())).toBe(
        mode === 'add' ? 1250 : 1000,
      )
    },
  )
  it('can record unassigned income and clears its balance choice when the account changes', () => {
    let data = makeDemoData()
    data.transactions = []
    data.accounts = [
      { id: 'cash', name: 'Chequing', kind: 'chequing', openingBalance: 1000, asOf: todayISO() },
    ]
    render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Record income' }))
    fireEvent.change(screen.getByLabelText('Income from'), { target: { value: 'Gift' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('radio', { name: /Yes, add this income/ }))
    fireEvent.change(screen.getByLabelText('Paid into account'), { target: { value: '' } })
    expect(screen.queryByRole('radio', { name: /Yes, add this income/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(data.transactions[0].balancePosting).toBeUndefined()
    expect(data.transactions[0].accountId).toBeUndefined()
    expect(accountBalance(data.accounts![0], data.transactions, todayISO())).toBe(1000)
  })
  it('suggests the TFSA contribution category and records one transfer instead of an expense', () => {
    let data = makeDemoData()
    const investment = data.categories.find((category) => category.name === 'Investments')!
    data.accounts = [
      {
        id: 'chequing',
        name: 'Chequing',
        kind: 'chequing',
        openingBalance: 1000,
        asOf: '2026-08-31',
      },
      {
        id: 'tfsa',
        name: 'Wealthsimple TFSA',
        kind: 'investment',
        subtype: 'TFSA',
        openingBalance: 500,
        asOf: '2026-08-31',
        contributionCategoryId: investment.id,
      },
    ]
    render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    fireEvent.change(screen.getByLabelText('To account'), { target: { value: 'tfsa' } })
    expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe(investment.id)
    expect(screen.getByText(/An investment contribution/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Payee or description'), {
      target: { value: 'TFSA contribution' },
    })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '200' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(data.transactions.at(-1)).toMatchObject({
      type: 'transfer',
      accountId: 'chequing',
      toAccountId: 'tfsa',
      categoryId: investment.id,
      amount: 200,
    })
  })
  it('records the real amount and date of income independently of the pay schedule', () => {
    let data = makeDemoData()
    const before = data.transactions.filter((item) => item.type === 'income').length
    const setMonth = vi.fn()
    render(
      <ActivityScreen
        data={data}
        month={'2026-09'}
        setMonth={setMonth}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Record income' }))
    expect(screen.getByText(/Record the amount you actually received/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Income from'), { target: { value: 'Overtime pay' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1234.56' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-28' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(data.transactions.filter((item) => item.type === 'income')).toHaveLength(before + 1)
    expect(data.transactions.at(-1)).toMatchObject({
      type: 'income',
      payee: 'Overtime pay',
      amount: 1234.56,
      date: '2026-08-28',
      source: 'manual',
    })
    expect(setMonth).toHaveBeenCalledWith('2026-08')
  })

  it('opens quick add directly on income when requested from Home', () => {
    render(
      <ActivityScreen
        data={makeDemoData()}
        month={currentMonth()}
        update={() => {}}
        quickAdd={1}
        quickAddType="income"
        onQuickAddConsumed={() => {}}
      />,
    )
    expect(screen.getByLabelText('Income from')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Income' }).className).toBe('active')
  })
  it('prefills the calendar date without fixing the income amount', () => {
    render(
      <ActivityScreen
        data={makeDemoData()}
        month="2026-09"
        update={() => {}}
        quickAdd={1}
        quickAddType="income"
        quickAddDate="2026-09-18"
        onQuickAddConsumed={() => {}}
      />,
    )
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-09-18')
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('')
  })
  it('does not call a future estimated payday received income', () => {
    let data = makeDemoData()
    render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Record income' }))
    fireEvent.change(screen.getByLabelText('Income from'), { target: { value: 'Next pay' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1200' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2999-01-10' } })
    expect(screen.getByText(/Record this income after it arrives/)).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Save transaction' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(data.transactions.some((item) => item.payee === 'Next pay')).toBe(false)
  })
  it('opens quick add only for a fresh request and consumes that request', () => {
    const data = makeDemoData()
    const consumed = vi.fn()
    const first = render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={() => {}}
        quickAdd={1}
        onQuickAddConsumed={consumed}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'New transaction' })).toBeTruthy()
    expect(consumed).toHaveBeenCalledOnce()
    first.unmount()
    render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={() => {}}
        quickAdd={0}
        onQuickAddConsumed={consumed}
      />,
    )
    expect(screen.queryByRole('dialog', { name: 'New transaction' })).toBeNull()
  })
  it('suggests a category and saves a transaction', () => {
    let data: PockitData = makeDemoData()
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    const { rerender } = render(
      <ActivityScreen data={data} month={currentMonth()} update={update} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.change(screen.getByPlaceholderText('e.g. Cigarettes or 7-Eleven'), {
      target: { value: 'Costco' },
    })
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '24.50' } })
    expect(screen.getByRole('button', { name: /^Category Groceries/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    rerender(<ActivityScreen data={data} month={currentMonth()} update={update} />)
    expect(data.transactions.at(-1)).toMatchObject({
      payee: 'Costco',
      amount: 24.5,
      type: 'expense',
    })
    expect(screen.getByRole('button', { name: /Costco Groceries.*24.50/ })).toBeTruthy()
  })

  it('allows an optional purchase description but requires a positive finite amount and valid date', () => {
    let data = makeDemoData()
    render(
      <ActivityScreen
        data={data}
        month={currentMonth()}
        update={(recipe) => {
          data = recipe(data)
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    const save = screen.getByRole('button', { name: 'Save transaction' }) as HTMLButtonElement
    const payee = screen.getByLabelText('Store or purchase (optional)')
    const amount = screen.getByLabelText('Amount')
    const date = screen.getByLabelText('Date')
    expect(save.disabled).toBe(true)
    fireEvent.change(payee, { target: { value: '   ' } })
    fireEvent.change(amount, { target: { value: '18' } })
    expect(save.disabled).toBe(false)
    fireEvent.change(payee, { target: { value: 'A shop' } })
    fireEvent.change(amount, { target: { value: '-18' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(amount, { target: { value: '1e309' } })
    expect(save.disabled).toBe(true)
    fireEvent.change(amount, { target: { value: '18' } })
    fireEvent.change(date, { target: { value: '' } })
    expect(save.disabled).toBe(true)
    expect(data.transactions).toHaveLength(20)
    fireEvent.change(date, { target: { value: `${currentMonth()}-20` } })
    expect(save.disabled).toBe(false)
  })

  it('filters transaction types, searches payees, sorts, and resets the view', () => {
    const data = makeDemoData()
    const { container } = render(
      <ActivityScreen data={data} month={currentMonth()} update={() => {}} />,
    )
    const names = () =>
      [...container.querySelectorAll('.transaction-name strong')].map((node) => node.textContent)
    expect(screen.getByRole('button', { name: 'All (14)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Income (2)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Transfer (1)' }))
    expect(names()).toEqual(['Savings transfer'])
    fireEvent.click(screen.getByRole('button', { name: 'Expense (11)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Filter & sort' }))
    fireEvent.change(screen.getByPlaceholderText('Search transactions'), {
      target: { value: 'market' },
    })
    expect(names()).toEqual(['Fresh Market'])
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(names()).toHaveLength(14)
    fireEvent.change(screen.getByLabelText('Sort transactions'), { target: { value: 'highest' } })
    expect(names()[0]).toBe('Paycheque')
    fireEvent.change(screen.getByLabelText('Filter category'), {
      target: { value: data.categories.find((c) => c.name === 'Groceries')!.id },
    })
    expect(names()).toEqual(['Costco', 'Superstore', 'Fresh Market'])
  })

  it('keeps the transaction list ahead of optional import and repeat tools', () => {
    const { container } = render(
      <ActivityScreen data={makeDemoData()} month={currentMonth()} update={() => {}} />,
    )
    const list = container.querySelector('.transaction-panel')!
    const more = container.querySelector('.activity-more')!
    expect(list.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Import transactions from a CSV file' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More ways to add' }))
    expect(screen.getByRole('button', { name: 'Import transactions from a CSV file' })).toBeTruthy()
  })
  it('records a refund and offers date shortcuts without requiring a second refund checkbox', () => {
    let data = makeDemoData()
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    render(<ActivityScreen data={data} month={currentMonth()} update={update} />)
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Refund' }))
    fireEvent.change(screen.getByLabelText('Store or purchase (optional)'), {
      target: { value: 'Returned shoes' },
    })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    const today = new Date()
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(date)
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(data.transactions.at(-1)).toMatchObject({
      type: 'expense',
      refund: true,
      amount: 45,
      date,
    })
  })
  it('keeps comma-separated tags while typing and finds the saved transaction by tag', () => {
    let data = makeDemoData()
    const update = (recipe: (value: PockitData) => PockitData) => {
      data = recipe(data)
    }
    const view = () => <ActivityScreen data={data} month={currentMonth()} update={update} />
    const { rerender, container } = render(view())
    fireEvent.click(screen.getByRole('button', { name: /add transaction/i }))
    fireEvent.change(screen.getByLabelText('Store or purchase (optional)'), {
      target: { value: 'Office supplies' },
    })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '18' } })
    const tags = screen.getByLabelText(/Tags \(optional\)/) as HTMLInputElement
    fireEvent.change(tags, { target: { value: 'work,' } })
    expect(tags.value).toBe('work,')
    fireEvent.change(tags, { target: { value: 'work, reimbursable' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save transaction' }))
    expect(data.transactions.at(-1)?.tags).toEqual(['work', 'reimbursable'])
    rerender(view())
    fireEvent.change(screen.getByPlaceholderText('Search transactions'), {
      target: { value: 'reimbursable' },
    })
    expect(container.querySelectorAll('.transaction-row')).toHaveLength(1)
  })
})
