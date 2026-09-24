import { unzipSync, strFromU8 } from 'fflate'
import type {
  Account,
  Category,
  Goal,
  MonthKey,
  PockitData,
  Transaction,
  TransactionType,
} from '../types'
import { parseCSV } from './csv'
import { categoryPresets, newCategory } from './defaults'
import { categoryPeriodAmount, monthlyPay } from './finance'
import { validISODate } from './numbers'

const files = [
  'transactions.csv',
  'budgets.csv',
  'categories.csv',
  'goals.csv',
  'accounts.csv',
] as const
type FileName = (typeof files)[number]
type Row = Record<string, string>
const maxZip = 10_000_000
const maxExpanded = 30_000_000
const maxRows = 25_000
const key = (value: string) => value.trim().toLocaleLowerCase('en-CA').replace(/\s+/g, ' ')
const categoryIdentity = (group: string, name: string) => `${key(group)}|${key(name)}`
const round = (value: number) => Math.round(value * 100) / 100

function number(value: string, label: string, row: number, allowBlank = false): number | undefined {
  if (!value.trim() && allowBlank) return undefined
  const cleaned = value
    .trim()
    .replace(/[$,\s]/g, '')
    .replace(/%$/, '')
    .replace(/^\((.*)\)$/, '-$1')
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(cleaned))
    throw new Error(`${label}, row ${row}: invalid amount “${value}”.`)
  const result = Number(cleaned)
  if (!Number.isFinite(result) || Math.abs(result) > 1_000_000_000)
    throw new Error(`${label}, row ${row}: amount is out of range.`)
  return round(result)
}
function nonnegative(value: string, label: string, row: number, allowBlank = false) {
  const result = number(value, label, row, allowBlank)
  if (result !== undefined && result < 0)
    throw new Error(`${label}, row ${row}: a negative amount is not valid here.`)
  return result
}
function date(value: string, label: string, row: number): string {
  const clean = value.trim()
  if (/^\d{4}-\d{2}-\d{2}.+/.test(clean) && !/^\d{4}-\d{2}-\d{2}(?:T|\s)\d/.test(clean))
    throw new Error(`${label}, row ${row}: invalid date “${value}”.`)
  const iso = /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(clean)
    ? clean.replaceAll('/', '-')
    : /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)
      ? (() => {
          const [m, d, y] = clean.split('/')
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        })()
      : clean.slice(0, 10)
  const normalized = /^\d{4}-\d{1,2}-\d{1,2}$/.test(iso)
    ? iso
        .split('-')
        .map((part, index) => (index ? part.padStart(2, '0') : part))
        .join('-')
    : iso
  if (!validISODate(normalized)) throw new Error(`${label}, row ${row}: invalid date “${value}”.`)
  return normalized
}
function rows(text: string, filename: FileName, headers: string[]): Row[] {
  const parsed = parseCSV(text.replace(/^\uFEFF/, ''))
  if (!parsed.length) throw new Error(`${filename} is empty or has no header.`)
  const actual = parsed[0].map((item) => item.trim())
  for (const header of headers)
    if (!actual.includes(header)) throw new Error(`${filename} is missing the “${header}” column.`)
  for (const header of actual)
    if (!headers.includes(header))
      throw new Error(
        `${filename} has an unsupported column “${header}”. Pockit stopped to avoid dropping data.`,
      )
  if (new Set(actual).size !== actual.length)
    throw new Error(`${filename} has duplicate column names.`)
  if (parsed.length > maxRows + 1) throw new Error(`${filename} has too many rows.`)
  return parsed.slice(1).map((cells, index) => {
    if (cells.length > actual.length && cells.slice(actual.length).some(Boolean))
      throw new Error(`${filename}, row ${index + 2}: too many columns.`)
    return Object.fromEntries(actual.map((header, column) => [header, cells[column] || '']))
  })
}

export interface WaypointArchive {
  transactions: Row[]
  budgets: Row[]
  categories: Row[]
  goals: Row[]
  accounts: Row[]
}

/** Read only the five known Waypoint CSVs. No archive data leaves the browser. */
export function parseWaypointZip(bytes: Uint8Array): WaypointArchive {
  if (!bytes.length || bytes.length > maxZip)
    throw new Error('Choose a Waypoint ZIP smaller than 10 MB.')
  let expanded = 0
  const seen = new Set<string>()
  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = unzipSync(bytes, {
      filter(info) {
        if (!files.includes(info.name as FileName) || seen.has(info.name))
          throw new Error(`Unexpected or repeated file in ZIP: ${info.name}.`)
        if (info.originalSize > 8_000_000 || (expanded += info.originalSize) > maxExpanded)
          throw new Error('The uncompressed Waypoint data is too large.')
        seen.add(info.name)
        return true
      },
    })
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Could not open this ZIP.')
  }
  for (const file of files)
    if (!unzipped[file]) throw new Error(`This Waypoint ZIP is missing ${file}.`)
  if (Object.values(unzipped).reduce((total, bytes) => total + bytes.length, 0) > maxExpanded)
    throw new Error('The uncompressed Waypoint data is too large.')
  const read = (file: FileName, headers: string[]) => rows(strFromU8(unzipped[file]), file, headers)
  return {
    transactions: read('transactions.csv', [
      'Date',
      'Description',
      'Amount',
      'Category',
      'Group',
      'Type',
      'Tags',
      'Notes',
      'Excluded from Budget',
      'Account',
      'Account Last 4',
      'Bank',
    ]),
    budgets: read('budgets.csv', [
      'Group',
      'Category',
      'Budget Amount',
      'Recurrence',
      'Due Date (Day of Month)',
    ]),
    categories: read('categories.csv', ['Group', 'Category', 'Icon', 'Color']),
    goals: read('goals.csv', [
      'Goal',
      'Type',
      'Target Amount',
      'Current Amount',
      'Remaining Balance',
      'Progress',
      'Monthly Contribution Target',
      'Manual Contributions',
      'Transaction Contributions',
      'Original Debt Amount',
      'Interest Rate',
      'Minimum Payment',
      'Target Date',
      'Description',
    ]),
    accounts: read('accounts.csv', [
      'Bank',
      'Account',
      'Type',
      'Subtype',
      'Account Last 4',
      'Balance',
      'Available Balance',
      'Credit Limit',
      'Connection',
      'Last Updated',
    ]),
  }
}

export interface WaypointOptions {
  startMonth: MonthKey
  cadConfirmed: boolean
  existing: 'keep' | 'waypoint'
  includePossibleDuplicates: boolean
  creditPositiveMeansOwed?: boolean
  accountAsOfDate: string
}
export interface WaypointResult {
  data: PockitData
  counts: {
    categories: number
    goals: number
    accounts: number
    transactions: number
    matched: number
    duplicates: number
  }
  notes: string[]
  changes: string[]
  newRecords: string[]
  skippedTransactions: string[]
}
const waypointId = (kind: string, value: string) => `waypoint:${kind}:${encodeURIComponent(value)}`
const frequency = (value: string): Category['frequency'] => {
  const normalized = key(value)
  const found: Record<string, Category['frequency']> = {
    monthly: 'monthly',
    weekly: 'weekly',
    biweekly: 'biweekly',
    'bi-weekly': 'biweekly',
    'twice monthly': 'twice-monthly',
    'twice-monthly': 'twice-monthly',
    semimonthly: 'twice-monthly',
  }
  if (!found[normalized]) throw new Error(`Unsupported Waypoint recurrence “${value}”.`)
  return found[normalized]
}
const iconMap: Record<string, string> = {
  ShoppingCart: 'ShoppingBasket',
  UtensilsCrossed: 'Utensils',
  Film: 'Clapperboard',
  Repeat: 'Repeat2',
}
function accountKind(value: string): Account['kind'] {
  const normalized = key(value)
  if (/chequ|check/.test(normalized)) return 'chequing'
  if (/sav/.test(normalized)) return 'savings'
  if (/credit|card|loan|line of credit/.test(normalized)) return 'credit'
  if (/invest|broker/.test(normalized)) return 'investment'
  if (/cash/.test(normalized)) return 'cash'
  throw new Error(`Unsupported Waypoint account type “${value}”.`)
}
function txType(value: string): { type: TransactionType; refund: boolean } {
  const normalized = key(value)
  if (['expense', 'debit', 'withdrawal'].includes(normalized))
    return { type: 'expense', refund: false }
  if (['income', 'credit', 'deposit'].includes(normalized)) return { type: 'income', refund: false }
  if (normalized === 'transfer') return { type: 'transfer', refund: false }
  if (normalized === 'refund' || normalized === 'reimbursement')
    return { type: 'expense', refund: true }
  throw new Error(`Unsupported Waypoint transaction type “${value || '(blank)'}”.`)
}
function excluded(value: string, row: number) {
  if (!value.trim() || /^(false|no|0)$/i.test(value.trim())) return false
  if (/^(true|yes|1)$/i.test(value.trim())) return true
  throw new Error(`transactions.csv, row ${row}: invalid Excluded from Budget value.`)
}
function transactionKey(row: Row, occurrence: number) {
  return waypointId(
    'transaction',
    [
      row.Date,
      row.Description,
      row.Amount,
      row.Type,
      row.Category,
      row.Account,
      row['Account Last 4'],
      row.Bank,
      occurrence,
    ]
      .map((part) => key(String(part)))
      .join('|'),
  )
}
function naturalTransactionKey(t: Transaction) {
  return [
    t.date,
    key(t.payee),
    t.amount.toFixed(2),
    t.type,
    t.refund ? 'refund' : '',
    t.accountId || '',
    t.toAccountId || '',
  ].join('|')
}

/** Preview and apply use this same pure function so the counts match the saved result. */
export function importWaypoint(
  archive: WaypointArchive,
  current: PockitData,
  options: WaypointOptions,
): WaypointResult {
  if (!options.cadConfirmed)
    throw new Error('Confirm that the amounts in this export are Canadian dollars.')
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(options.startMonth))
    throw new Error('Choose a valid budget start month.')
  if (
    archive.accounts.some((row) => !row['Last Updated']) &&
    !validISODate(options.accountAsOfDate)
  )
    throw new Error('Choose the date for account balances without “Last Updated”.')
  if (
    archive.accounts.some(
      (row) => /credit|card|loan/i.test(row.Type) && Number(row.Balance.replace(/[$,]/g, '')) > 0,
    ) &&
    options.creditPositiveMeansOwed === undefined
  )
    throw new Error(
      'Choose how positive credit account balances are shown in Waypoint before importing.',
    )
  const notes: string[] = []
  const changes: string[] = []
  const newRecords: string[] = []
  const skippedTransactions: string[] = []
  const counts = {
    categories: 0,
    goals: 0,
    accounts: 0,
    transactions: 0,
    matched: 0,
    duplicates: 0,
  }
  const data: PockitData = {
    ...current,
    profile: { ...current.profile },
    categories: [...current.categories],
    goals: [...current.goals],
    accounts: [...(current.accounts || [])],
    transactions: [...current.transactions],
  }
  if (archive.budgets.length) data.profile.waypointPlanStarts = options.startMonth
  const initialCategoryIds = new Set(current.categories.map((category) => category.id))
  const claimedCategoryIds = new Set<string>()
  const categoryDetails = new Map<string, Row>()
  archive.categories.forEach((row, index) => {
    if (!row.Category.trim())
      throw new Error(`categories.csv, row ${index + 2}: category name is blank.`)
    const identity = categoryIdentity(row.Group, row.Category)
    if (categoryDetails.has(identity))
      throw new Error(`categories.csv has duplicate category “${row.Category}” in “${row.Group}”.`)
    categoryDetails.set(identity, row)
  })
  const detailsFor = (group: string, name: string) =>
    categoryDetails.get(categoryIdentity(group, name)) ||
    (key(group)
      ? undefined
      : [...categoryDetails.values()].filter((row) => key(row.Category) === key(name)).length === 1
        ? [...categoryDetails.values()].find((row) => key(row.Category) === key(name))
        : undefined)
  const matchCategory = (name: string, group: string, sourceKey: string) => {
    const bySource = data.categories.find((item) => item.waypointKey === sourceKey)
    if (bySource) return bySource
    const exact = data.categories.find(
      (item) => key(item.name) === key(name) && key(item.group) === key(group),
    )
    if (exact) return exact
    const sameName = data.categories.filter(
      (item) =>
        initialCategoryIds.has(item.id) &&
        !claimedCategoryIds.has(item.id) &&
        key(item.name) === key(name),
    )
    return sameName.length === 1 ? sameName[0] : undefined
  }
  let monthlyIncome: number | undefined
  let statedAllocated: number | undefined
  let statedRemaining: number | undefined
  const budgetNames = new Set<string>()
  archive.budgets.forEach((row, index) => {
    const name = row.Category.trim()
    if (!name) return
    if (name === 'Remaining') {
      statedRemaining = number(row['Budget Amount'], 'budgets.csv', index + 2)
      return
    }
    const amount = nonnegative(row['Budget Amount'], 'budgets.csv', index + 2)
    if (amount === undefined)
      throw new Error(`budgets.csv, row ${index + 2}: budget amount is blank.`)
    if (name === 'Monthly Income') {
      monthlyIncome = amount
      return
    }
    if (name === 'Total Allocated') {
      statedAllocated = amount
      return
    }
    const details = detailsFor(row.Group, name)
    const preset = categoryPresets.find(([presetName]) => key(presetName) === key(name))
    const chosenGroup = (row.Group || details?.Group || preset?.[2] || 'Other').trim()
    const identity = categoryIdentity(chosenGroup, name)
    if (budgetNames.has(identity)) throw new Error(`budgets.csv has duplicate category “${name}”.`)
    budgetNames.add(identity)
    const color =
      details?.Color && /^#[0-9a-fA-F]{6}$/.test(details.Color)
        ? details.Color
        : preset?.[3] || '#9bd5c2'
    if (details?.Color && !/^#[0-9a-fA-F]{6}$/.test(details.Color))
      throw new Error(`categories.csv: invalid colour for ${name}.`)
    const candidate = newCategory(
      name,
      details?.Icon ? iconMap[details.Icon] || details.Icon : preset?.[1] || 'Shapes',
      chosenGroup,
      color,
      amount,
      options.startMonth,
    )
    candidate.frequency = frequency(row.Recurrence)
    const due = row['Due Date (Day of Month)'].trim()
    if (due) {
      const day = Number(due)
      if (!Number.isInteger(day) || day < 1 || day > 31)
        throw new Error(`budgets.csv, row ${index + 2}: payment day must be 1–31.`)
      candidate.paymentDay = day
    }
    candidate.waypointKey = waypointId('category', identity)
    const match = matchCategory(name, chosenGroup, candidate.waypointKey)
    if (match) {
      claimedCategoryIds.add(match.id)
      counts.matched++
      if (options.existing === 'waypoint') {
        if (
          match.frequency !== candidate.frequency ||
          (match.mode === 'rollover' && match.targetType !== 'fixed')
        )
          throw new Error(
            `${name} has a different Pockit recurrence or a percentage/no-target rollover. Choose “Keep existing Pockit values”, or adjust this category in Budget before importing Waypoint amounts.`,
          )
        const beforeAmount = categoryPeriodAmount(match, options.startMonth)
        if (
          beforeAmount !== amount ||
          match.paymentDay !== candidate.paymentDay ||
          match.frequency !== candidate.frequency
        )
          changes.push(
            `${name} plan: ${beforeAmount.toFixed(2)} → ${amount.toFixed(2)} CAD per period; payment day ${match.paymentDay || 'none'} → ${candidate.paymentDay || 'none'}.`,
          )
        data.categories = data.categories.map((item) =>
          item.id === match.id
            ? {
                ...item,
                name,
                icon: candidate.icon,
                color,
                group: chosenGroup,
                starts: item.starts > options.startMonth ? options.startMonth : item.starts,
                archived: false,
                changes: { ...item.changes, [options.startMonth]: amount },
                overrides: Object.fromEntries(
                  Object.entries(item.overrides).filter(([month]) => month !== options.startMonth),
                ),
                paymentDay: candidate.paymentDay,
                waypointKey: candidate.waypointKey,
              }
            : item,
        )
      } else
        data.categories = data.categories.map((item) =>
          item.id === match.id ? { ...item, waypointKey: candidate.waypointKey } : item,
        )
    } else {
      data.categories.push(candidate)
      counts.categories++
      newRecords.push(`Category · ${name} · ${amount.toFixed(2)} CAD`)
    }
  })
  for (const details of categoryDetails.values()) {
    const chosenGroup =
      details.Group ||
      categoryPresets.find(([name]) => key(name) === key(details.Category))?.[2] ||
      'Other'
    const sourceKey = waypointId('category', categoryIdentity(chosenGroup, details.Category))
    if (budgetNames.has(categoryIdentity(chosenGroup, details.Category))) continue
    const candidate = newCategory(
      details.Category,
      iconMap[details.Icon] || details.Icon || 'Shapes',
      chosenGroup,
      details.Color || '#9bd5c2',
      0,
      options.startMonth,
    )
    if (details.Color && !/^#[0-9a-fA-F]{6}$/.test(details.Color))
      throw new Error(`categories.csv: invalid colour for ${details.Category}.`)
    candidate.waypointKey = sourceKey
    const match = matchCategory(details.Category, chosenGroup, sourceKey)
    if (!match) {
      data.categories.push(candidate)
      counts.categories++
      newRecords.push(`Category · ${details.Category} · no allocation in ZIP`)
    } else {
      claimedCategoryIds.add(match.id)
      data.categories = data.categories.map((item) =>
        item.id === match.id ? { ...item, waypointKey: sourceKey } : item,
      )
    }
  }
  if (monthlyIncome !== undefined) {
    if (options.existing === 'waypoint' || current.profile.plannedMonthlyIncome === undefined) {
      const beforeIncome =
        current.profile.plannedMonthlyIncome ??
        monthlyPay(current.profile.payAmount, current.profile.payFrequency)
      if (beforeIncome !== monthlyIncome)
        changes.push(
          `Monthly income plan: ${beforeIncome.toFixed(2)} → ${monthlyIncome.toFixed(2)} CAD.`,
        )
      data.profile.plannedMonthlyIncome = monthlyIncome
      data.profile.plannedIncomeStarts = options.startMonth
    }
    notes.push(
      'Monthly Income is a budget estimate, not a paycheque frequency. Your pay schedule stays unchanged.',
    )
    if (
      monthlyIncome === 0 &&
      archive.transactions.some((row) => ['income', 'credit', 'deposit'].includes(key(row.Type)))
    )
      notes.push(
        'Waypoint exported a $0 monthly income plan, but this ZIP contains recorded income. Set your expected monthly income in More → Your profile before relying on allocation percentages.',
      )
  }
  if (statedAllocated !== undefined) {
    const total = round(
      archive.budgets
        .filter(
          (row) =>
            row.Category &&
            !['Monthly Income', 'Total Allocated', 'Remaining'].includes(row.Category),
        )
        .reduce((sum, row) => sum + (number(row['Budget Amount'], 'budgets.csv', 0) || 0), 0),
    )
    if (Math.abs(total - statedAllocated) > 0.01)
      notes.push(
        `Waypoint says total allocated is ${statedAllocated.toFixed(2)}, but category rows sum to ${total.toFixed(2)}. Review the source export.`,
      )
  }
  if (
    monthlyIncome !== undefined &&
    statedAllocated !== undefined &&
    statedRemaining !== undefined &&
    Math.abs(round(monthlyIncome - statedAllocated) - statedRemaining) > 0.01
  )
    notes.push(
      'Waypoint’s monthly income, total allocated, and remaining figures do not reconcile. Review the source export.',
    )
  if (archive.budgets.length && !archive.transactions.length)
    notes.push(
      'This export has no transactions. Spending, comparisons, and transaction history will stay empty until you add or import activity.',
    )
  if (archive.transactions.length === 100)
    notes.push(
      'This ZIP contains exactly 100 transactions. That may be complete, but if Waypoint shows older activity, check whether the export includes it before switching apps. Pockit cannot recover rows absent from the ZIP.',
    )
  if (!archive.accounts.length)
    notes.push(
      'This export has no accounts or balances. Pockit will not invent a bank balance or bank connection.',
    )
  if (archive.budgets.some((row) => row['Due Date (Day of Month)']))
    notes.push(
      'Budget payment days are saved on categories. They are not treated as confirmed bills or payments.',
    )
  if (archive.transactions.some((row) => key(row.Type) === 'transfer' && row.Account))
    notes.push(
      'For account-linked transfers, a positive amount goes into the listed account and a negative amount goes out. Check this convention against your Waypoint export.',
    )

  const goalNames = new Set<string>()
  archive.goals.forEach((row, index) => {
    const name = row.Goal.trim()
    if (!name) throw new Error(`goals.csv, row ${index + 2}: goal name is blank.`)
    const kind =
      key(row.Type) === 'debt'
        ? 'debt'
        : key(row.Type) === 'savings' || key(row.Type) === 'saving'
          ? 'saving'
          : null
    if (!kind) throw new Error(`goals.csv, row ${index + 2}: unsupported goal type “${row.Type}”.`)
    const balance =
      nonnegative(
        kind === 'debt' ? row['Remaining Balance'] : row['Current Amount'],
        'goals.csv',
        index + 2,
      ) ?? 0
    const target =
      kind === 'saving' ? (nonnegative(row['Target Amount'], 'goals.csv', index + 2) ?? 0) : 0
    const monthly =
      nonnegative(row['Monthly Contribution Target'], 'goals.csv', index + 2, true) ?? 0
    const interest = nonnegative(row['Interest Rate'], 'goals.csv', index + 2, true) ?? 0
    const identity = `${kind}:${key(name)}`
    if (goalNames.has(identity)) throw new Error(`goals.csv has duplicate ${kind} goal “${name}”.`)
    goalNames.add(identity)
    const candidate: Goal = {
      id: crypto.randomUUID(),
      kind,
      name,
      balance,
      target,
      monthly,
      annualInterest: interest,
      interestUnknown: kind === 'debt' && !row['Interest Rate'].trim(),
      color: kind === 'debt' ? '#f29a91' : '#bdf26c',
      icon: kind === 'debt' ? 'CreditCard' : 'Flag',
      history: [],
      waypointKey: waypointId('goal', identity),
      description: row.Description || undefined,
      targetDate: row['Target Date'] ? date(row['Target Date'], 'goals.csv', index + 2) : undefined,
      originalDebtAmount: nonnegative(row['Original Debt Amount'], 'goals.csv', index + 2, true),
      minimumPayment: nonnegative(row['Minimum Payment'], 'goals.csv', index + 2, true),
      importedManualContributions: nonnegative(
        row['Manual Contributions'],
        'goals.csv',
        index + 2,
        true,
      ),
      importedTransactionContributions: nonnegative(
        row['Transaction Contributions'],
        'goals.csv',
        index + 2,
        true,
      ),
    }
    const namedGoals = data.goals.filter(
      (item) => item.kind === kind && key(item.name) === key(name),
    )
    const match =
      data.goals.find((item) => item.waypointKey === candidate.waypointKey) ||
      (namedGoals.length === 1 ? namedGoals[0] : undefined)
    if (!match && namedGoals.length > 1)
      throw new Error(
        `goals.csv, row ${index + 2}: multiple Pockit goals match “${name}”. Rename one before importing.`,
      )
    if (match) {
      counts.matched++
      if (options.existing === 'waypoint') {
        if (
          match.balance !== balance ||
          match.monthly !== monthly ||
          match.annualInterest !== interest ||
          match.interestUnknown !== candidate.interestUnknown
        )
          changes.push(
            `${name} goal: balance ${match.balance.toFixed(2)} → ${balance.toFixed(2)} CAD; monthly ${match.monthly.toFixed(2)} → ${monthly.toFixed(2)} CAD; interest ${match.interestUnknown ? 'unknown' : `${match.annualInterest}%`} → ${candidate.interestUnknown ? 'unknown' : `${interest}%`}.`,
          )
        data.goals = data.goals.map((item) =>
          item.id === match.id
            ? { ...item, ...candidate, id: item.id, history: item.history }
            : item,
        )
      } else
        data.goals = data.goals.map((item) =>
          item.id === match.id ? { ...item, waypointKey: candidate.waypointKey } : item,
        )
    } else {
      data.goals.push(candidate)
      counts.goals++
      newRecords.push(
        `${kind === 'debt' ? 'Debt' : 'Savings goal'} · ${name} · ${balance.toFixed(2)} CAD balance`,
      )
    }
  })
  const accountLookup = new Map<string, string>()
  archive.accounts.forEach((row, index) => {
    const name = row.Account.trim()
    if (!name) throw new Error(`accounts.csv, row ${index + 2}: account name is blank.`)
    const balance = number(row.Balance, 'accounts.csv', index + 2)
    if (balance === undefined) throw new Error(`accounts.csv, row ${index + 2}: balance is blank.`)
    const kind = accountKind(row.Type)
    const identity = [key(row.Bank), key(name), row['Account Last 4'].trim()].join('|')
    if (accountLookup.has(identity))
      throw new Error(`accounts.csv has duplicate account “${name}”.`)
    const asOf = row['Last Updated']
      ? date(row['Last Updated'], 'accounts.csv', index + 2)
      : options.accountAsOfDate
    let openingBalance = balance
    if (kind === 'credit' && balance > 0 && options.creditPositiveMeansOwed)
      openingBalance = -balance
    const candidate: Account = {
      id: crypto.randomUUID(),
      name,
      kind,
      openingBalance,
      asOf,
      asOfTime: `${asOf}T23:59:59.999Z`,
      waypointKey: waypointId('account', identity),
      bank: row.Bank || undefined,
      lastFour: row['Account Last 4'] || undefined,
      subtype: row.Subtype || undefined,
      availableBalance: number(row['Available Balance'], 'accounts.csv', index + 2, true),
      creditLimit: nonnegative(row['Credit Limit'], 'accounts.csv', index + 2, true),
      connection: row.Connection || undefined,
    }
    const namedAccounts =
      data.accounts?.filter(
        (item) =>
          key(item.name) === key(name) &&
          (item.lastFour || '') === (row['Account Last 4'] || '') &&
          (!row.Bank || !item.bank || key(item.bank) === key(row.Bank)),
      ) || []
    const match =
      data.accounts?.find((item) => item.waypointKey === candidate.waypointKey) ||
      (namedAccounts.length === 1 ? namedAccounts[0] : undefined)
    if (!match && namedAccounts.length > 1)
      throw new Error(
        `accounts.csv, row ${index + 2}: multiple Pockit accounts match “${name}”. Rename one before importing.`,
      )
    if (match) {
      counts.matched++
      if (options.existing === 'waypoint') {
        if (match.openingBalance !== openingBalance || match.asOf !== asOf)
          changes.push(
            `${name} account snapshot: ${match.openingBalance.toFixed(2)} CAD on ${match.asOf} → ${openingBalance.toFixed(2)} CAD on ${asOf}.`,
          )
        data.accounts = data.accounts?.map((item) =>
          item.id === match.id
            ? {
                ...item,
                ...candidate,
                id: item.id,
                archived: false,
                reconciliations: item.reconciliations,
              }
            : item,
        )
      } else
        data.accounts = data.accounts?.map((item) =>
          item.id === match.id ? { ...item, waypointKey: candidate.waypointKey } : item,
        )
      accountLookup.set(identity, match.id)
    } else {
      data.accounts?.push(candidate)
      counts.accounts++
      accountLookup.set(identity, candidate.id)
      newRecords.push(`Account · ${name} · ${openingBalance.toFixed(2)} CAD snapshot`)
    }
  })
  const occurrence = new Map<string, number>()
  const existingNatural = new Set(data.transactions.map(naturalTransactionKey))
  archive.transactions.forEach((row, index) => {
    const dateValue = date(row.Date, 'transactions.csv', index + 2)
    const payee = row.Description.trim()
    if (!payee) throw new Error(`transactions.csv, row ${index + 2}: description is blank.`)
    const amount = number(row.Amount, 'transactions.csv', index + 2)
    if (!amount) throw new Error(`transactions.csv, row ${index + 2}: amount must be nonzero.`)
    const { type, refund } = txType(row.Type)
    if (refund && amount < 0)
      throw new Error(
        `transactions.csv, row ${index + 2}: a refund or reimbursement must have a positive amount.`,
      )
    if (type === 'expense' && !refund && amount > 0)
      throw new Error(`transactions.csv, row ${index + 2}: an expense must have a negative amount.`)
    if (type === 'income' && amount < 0)
      throw new Error(`transactions.csv, row ${index + 2}: income must have a positive amount.`)
    const categoryChoices = row.Category
      ? data.categories.filter(
          (item) =>
            key(item.name) === key(row.Category) &&
            (!row.Group || key(item.group) === key(row.Group)),
        )
      : []
    const categoryId = categoryChoices.length === 1 ? categoryChoices[0].id : undefined
    if (row.Category && !categoryId)
      throw new Error(
        `transactions.csv, row ${index + 2}: category “${row.Category}” is missing from the archive.`,
      )
    const accountIdentity = [key(row.Bank), key(row.Account), row['Account Last 4'].trim()].join(
      '|',
    )
    const accountCandidates = row.Account
      ? data.accounts?.filter(
          (item) =>
            key(item.name) === key(row.Account) &&
            (!row['Account Last 4'] || item.lastFour === row['Account Last 4']) &&
            (!row.Bank || !item.bank || key(item.bank) === key(row.Bank)),
        ) || []
      : []
    const accountId = row.Account
      ? accountLookup.get(accountIdentity) ||
        (accountCandidates.length === 1 ? accountCandidates[0].id : undefined)
      : undefined
    if (row.Account && !accountId)
      throw new Error(
        `transactions.csv, row ${index + 2}: account “${row.Account}” has no matching account row.`,
      )
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      date: dateValue,
      payee,
      amount: Math.abs(amount),
      type,
      refund,
      categoryId,
      accountId: type === 'transfer' && amount > 0 ? undefined : accountId,
      toAccountId: type === 'transfer' && amount > 0 ? accountId : undefined,
      note: row.Notes || undefined,
      tags: row.Tags
        ? row.Tags.split(/[;,]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
      waypointTagsRaw: row.Tags || undefined,
      waypointGroup: row.Group || undefined,
      waypointTypeRaw: row.Type || undefined,
      excludedFromBudget: excluded(row['Excluded from Budget'], index + 2),
      source: 'waypoint',
      reviewed: true,
      cleared: true,
    }
    const baseKey = transactionKey(row, 0)
    const ordinal = (occurrence.get(baseKey) || 0) + 1
    occurrence.set(baseKey, ordinal)
    transaction.sourceId = transactionKey(row, ordinal)
    if (data.transactions.some((item) => item.sourceId === transaction.sourceId)) {
      counts.duplicates++
      skippedTransactions.push(
        `${dateValue} · ${payee} · ${Math.abs(amount).toFixed(2)} CAD (already imported)`,
      )
      return
    }
    if (
      existingNatural.has(naturalTransactionKey(transaction)) &&
      !options.includePossibleDuplicates
    ) {
      counts.duplicates++
      skippedTransactions.push(
        `${dateValue} · ${payee} · ${Math.abs(amount).toFixed(2)} CAD (possible match)`,
      )
      return
    }
    data.transactions.push(transaction)
    counts.transactions++
  })
  if (JSON.stringify(data).length > 4_500_000)
    throw new Error(
      'This combined budget is too large for Pockit’s current browser backup. Nothing was imported. Keep the Waypoint ZIP and contact the project maintainer about a larger-data migration.',
    )
  return { data, counts, notes, changes, newRecords, skippedTransactions }
}
