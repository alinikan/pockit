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
  possibleDuplicateIds: string[]
  exactDuplicates: number
}

export interface CSVMapping {
  date: number
  payee: number
  amount: number
  debit: number
  credit: number
  type: number
  reference: number
}

export function inferCSVMapping(headers: string[]): CSVMapping {
  const normalized = headers.map((cell) => cell.toLowerCase().replace(/[^a-z]/g, ''))
  const column = (...names: string[]) => normalized.findIndex((item) => names.includes(item))
  return {
    date: column('date', 'transactiondate', 'posteddate'),
    payee: column('description', 'payee', 'merchant', 'name'),
    amount: column('amount'),
    debit: column('debit', 'withdrawal', 'moneyout'),
    credit: column('credit', 'deposit', 'moneyin'),
    type: column('type', 'transactiontype'),
    reference: column('transactionid', 'reference', 'referenceid', 'id'),
  }
}

export function previewCSV(
  text: string,
  existing: Transaction[],
  categories: Category[],
  mapping?: CSVMapping,
  accountId?: string,
): CSVPreview {
  if (text.length > 2_000_000) throw new Error('Choose a CSV smaller than 2 MB.')
  const rows = parseCSV(text.replace(/^\uFEFF/, ''))
  if (!rows.length) throw new Error('This CSV is empty.')
  if (rows.length > 5001) throw new Error('Import at most 5,000 rows at a time.')
  const columns = mapping || inferCSVMapping(rows[0])
  const {
    date: dateColumn,
    payee: payeeColumn,
    amount: amountColumn,
    debit: debitColumn,
    credit: creditColumn,
    type: typeColumn,
    reference: referenceColumn,
  } = columns
  if (
    dateColumn < 0 ||
    payeeColumn < 0 ||
    (amountColumn < 0 && debitColumn < 0 && creditColumn < 0)
  )
    throw new Error('CSV needs Date, Description or Payee, and Amount or Debit/Credit columns.')
  const seen = new Set(existing.map(fingerprint))
  const knownIds = new Set(existing.map((transaction) => transaction.sourceId).filter(Boolean))
  const transactions: Transaction[] = [],
    errors: string[] = []
  let duplicates = 0
  let exactDuplicates = 0
  const possibleDuplicateIds: string[] = []
  rows.slice(1).forEach((row, index) => {
    const date = dateValue(row[dateColumn] || '')
    const payee = (row[payeeColumn] || '').trim()
    const debit = debitColumn < 0 ? 0 : amountValue(row[debitColumn] || '0')
    const credit = creditColumn < 0 ? 0 : amountValue(row[creditColumn] || '0')
    const signed = amountColumn < 0 ? 0 : amountValue(row[amountColumn] || '0')
    const rawType = typeColumn < 0 ? '' : (row[typeColumn] || '').trim().toLowerCase()
    const refund =
      rawType === 'refund' ||
      ((amountColumn < 0 ? credit > 0 : signed > 0) && /\b(refund|return|reversal)\b/i.test(payee))
    const type: TransactionType =
      rawType === 'transfer'
        ? 'transfer'
        : refund
          ? 'expense'
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
    const amount =
      amountColumn < 0 ? (type === 'income' || refund ? credit : debit) : Math.abs(signed)
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
      refund,
      categoryId: type === 'expense' ? categorizePayee(payee, categories) : undefined,
      createdAt: new Date().toISOString(),
      source: 'csv',
      reviewed: false,
      cleared: true,
      accountId: accountId || undefined,
      sourceId:
        referenceColumn >= 0 && row[referenceColumn]?.trim()
          ? `${accountId || 'unassigned'}:${row[referenceColumn].trim()}`
          : undefined,
    }
    if (transaction.sourceId && knownIds.has(transaction.sourceId)) {
      exactDuplicates++
      return
    }
    if (transaction.sourceId) knownIds.add(transaction.sourceId)
    const key = fingerprint(transaction)
    if (seen.has(key)) {
      duplicates++
      possibleDuplicateIds.push(transaction.id)
    }
    seen.add(key)
    transactions.push(transaction)
  })
  return { transactions, errors, duplicates, possibleDuplicateIds, exactDuplicates }
}
