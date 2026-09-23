import type { Category, Transaction, TransactionType } from '../types'
import { categorizePayee } from './finance'
import { validISODate } from './numbers'

export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [],
    cell = '',
    quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (!quoted && !cell.trim()) quoted = true
      else if (quoted) quoted = false
      else cell += char
    } else if (char === ',' && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim())
      cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else cell += char
  }
  if (quoted) throw new Error('A quoted CSV value was not closed.')
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

const dateValue = (value: string) => {
  const text = value.trim()
  const converted = /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)
    ? text
        .split('/')
        .map((part, index) => (index ? part.padStart(2, '0') : part))
        .join('-')
    : /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)
      ? (() => {
          const [month, day, year] = text.split('/')
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        })()
      : text
  return validISODate(converted) ? converted : null
}
const amountValue = (value: string) =>
  Number(value.replace(/[,$\s]/g, '').replace(/^\((.*)\)$/, '-$1'))
const fingerprint = (transaction: Pick<Transaction, 'date' | 'payee' | 'amount' | 'type'>) =>
  `${transaction.date}|${transaction.payee.trim().toLowerCase()}|${transaction.amount.toFixed(2)}|${transaction.type}`

export interface CSVPreview {
  transactions: Transaction[]
  errors: string[]
  duplicates: number
}

export function previewCSV(
  text: string,
  existing: Transaction[],
  categories: Category[],
): CSVPreview {
  if (text.length > 2_000_000) throw new Error('Choose a CSV smaller than 2 MB.')
  const rows = parseCSV(text.replace(/^\uFEFF/, ''))
  if (!rows.length) throw new Error('This CSV is empty.')
  if (rows.length > 5001) throw new Error('Import at most 5,000 rows at a time.')
  const header = rows[0].map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ''))
  const column = (...names: string[]) => header.findIndex((item) => names.includes(item))
  const dateColumn = column('date', 'transactiondate', 'posteddate')
  const payeeColumn = column('description', 'payee', 'merchant', 'name')
  const amountColumn = column('amount')
  const debitColumn = column('debit', 'withdrawal', 'moneyout')
  const creditColumn = column('credit', 'deposit', 'moneyin')
  const typeColumn = column('type', 'transactiontype')
  if (
    dateColumn < 0 ||
    payeeColumn < 0 ||
    (amountColumn < 0 && debitColumn < 0 && creditColumn < 0)
  )
    throw new Error('CSV needs Date, Description or Payee, and Amount or Debit/Credit columns.')
  const seen = new Set(existing.map(fingerprint))
  const transactions: Transaction[] = [],
    errors: string[] = []
  let duplicates = 0
  rows.slice(1).forEach((row, index) => {
    const date = dateValue(row[dateColumn] || '')
    const payee = (row[payeeColumn] || '').trim()
    const debit = debitColumn < 0 ? 0 : amountValue(row[debitColumn] || '0')
    const credit = creditColumn < 0 ? 0 : amountValue(row[creditColumn] || '0')
    const signed = amountColumn < 0 ? 0 : amountValue(row[amountColumn] || '0')
    const rawType = typeColumn < 0 ? '' : (row[typeColumn] || '').trim().toLowerCase()
    const type: TransactionType =
      rawType === 'transfer'
        ? 'transfer'
        : rawType === 'income' || rawType === 'credit'
          ? 'income'
          : rawType === 'expense' || rawType === 'debit'
            ? 'expense'
            : amountColumn < 0
              ? credit > 0
                ? 'income'
                : 'expense'
              : signed >= 0
                ? 'income'
                : 'expense'
    const amount = amountColumn < 0 ? (type === 'income' ? credit : debit) : Math.abs(signed)
    if (!date || !payee || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      errors.push(`Row ${index + 2}: check the date, description, and amount.`)
      return
    }
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      date,
      payee,
      amount: Math.round(amount * 100) / 100,
      type,
      categoryId: type === 'expense' ? categorizePayee(payee, categories) : undefined,
      createdAt: new Date().toISOString(),
    }
    const key = fingerprint(transaction)
    if (seen.has(key)) {
      duplicates++
      return
    }
    seen.add(key)
    transactions.push(transaction)
  })
  return { transactions, errors, duplicates }
}
