import { describe, expect, it } from 'vitest'
import { makeDemoData } from './defaults'
import { parseCSV, previewCSV } from './csv'

describe('reviewed CSV import', () => {
  it('reads quotes, escaped quotes, and multiline descriptions', () => {
    expect(
      parseCSV(
        'Date,Description,Amount\n2026-09-02,"Shop, Inc.",-12.50\n2026-09-03,"Say ""Hi""",-2',
      ),
    ).toEqual([
      ['Date', 'Description', 'Amount'],
      ['2026-09-02', 'Shop, Inc.', '-12.50'],
      ['2026-09-03', 'Say "Hi"', '-2'],
    ])
    expect(() => parseCSV('Date,"Unclosed')).toThrow(/not closed/)
  })
  it('understands signed amounts, debit/credit columns, dates, and duplicates', () => {
    const data = makeDemoData()
    const text =
      'Date,Description,Amount\n09/20/2026,Costco,-24.50\n09/21/2026,Salary,100.00\n09/20/2026,Costco,-24.50'
    const result = previewCSV(text, data.transactions, data.categories)
    expect(
      result.transactions.map((transaction) => [
        transaction.date,
        transaction.type,
        transaction.amount,
      ]),
    ).toEqual([
      ['2026-09-20', 'expense', 24.5],
      ['2026-09-21', 'income', 100],
    ])
    expect(result.duplicates).toBe(1)
    expect(result.transactions[0].categoryId).toBe(
      data.categories.find((category) => category.name === 'Groceries')?.id,
    )
    const debit = previewCSV(
      'Date,Payee,Debit,Credit\n2026/09/20,Electric,42.20,\n2026/09/21,Refund,,10.00',
      [],
      data.categories,
    )
    expect(debit.transactions.map((transaction) => transaction.type)).toEqual(['expense', 'income'])
  })
  it('reports bad rows while keeping good rows for preview', () => {
    const result = previewCSV(
      'Date,Description,Amount\n2026-02-30,Wrong,-5\n2026-02-28,Okay,-4',
      [],
      [],
    )
    expect(result.transactions).toHaveLength(1)
    expect(result.errors).toEqual(['Row 2: check the date, description, and amount.'])
  })
  it('rejects files with missing headers or excessive size', () => {
    expect(() => previewCSV('No,Useful,Headers\na,b,c', [], [])).toThrow(/needs Date/)
    expect(() => previewCSV('x'.repeat(2_000_001), [], [])).toThrow(/2 MB/)
  })
})
