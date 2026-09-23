export type MonthKey = `${number}-${number}`
export type TransactionType = 'expense' | 'income' | 'transfer'
export type GoalKind = 'saving' | 'debt'
export type CategoryMode = 'fresh' | 'rollover'
export type ContributionTarget = 'fixed' | 'percent' | 'none'
export type FundingMode = 'auto' | 'manual'
export type Frequency = 'weekly' | 'biweekly' | 'twice-monthly' | 'monthly'

export interface Category {
  id: string
  name: string
  icon: string
  group: string
  color: string
  baseAmount: number
  changes: Record<string, number>
  overrides: Record<string, number>
  starts: MonthKey
  frequency: Frequency
  paymentDay?: number
  mode: CategoryMode
  targetType: ContributionTarget
  targetValue: number
  funding: FundingMode
  notes: string
  archived?: boolean
}

export interface Transaction {
  id: string
  date: string
  payee: string
  amount: number
  type: TransactionType
  categoryId?: string
  note?: string
  receiptName?: string
  createdAt?: string
  goalId?: string
  billId?: string
  accountId?: string
  toAccountId?: string
  refund?: boolean
  reviewed?: boolean
  cleared?: boolean
  source?: 'manual' | 'csv' | 'receipt'
  sourceId?: string
  importBatchId?: string
  splits?: { categoryId: string; amount: number }[]
}

export interface Account {
  id: string
  name: string
  kind: 'chequing' | 'savings' | 'credit' | 'investment' | 'cash'
  openingBalance: number
  asOf: string
  asOfTime?: string
  reconciledAt?: string
  reconciliations?: { date: string; balance: number; adjustment: number }[]
  archived?: boolean
}

export interface Goal {
  id: string
  kind: GoalKind
  name: string
  balance: number
  target: number
  monthly: number
  annualInterest: number
  color: string
  icon: string
  history: { date: string; amount: number; note: string; transactionId?: string }[]
}

export interface Bill {
  id: string
  name: string
  amount: number
  day: number
  categoryId?: string
  paidMonths: string[]
  skippedMonths?: string[]
  frequency?: 'monthly' | 'quarterly' | 'yearly'
  starts?: MonthKey
  notes?: string
  paymentType?: 'expense' | 'transfer'
  accountId?: string
  toAccountId?: string
}

export interface PockitData {
  version: 1
  onboarded: boolean
  onboardingStep?: number
  profile: {
    name: string
    reason: string
    payAmount: number
    payFrequency: Frequency
    housing: string
    transport: string
    extras: string[]
    paydayAnchor?: string
    paydayDays?: [number, number]
    cashOnHand?: number
    cashAsOf?: string
    cashUpdatedAt?: string
  }
  settings: {
    theme: 'dark' | 'light'
    smart: boolean
    currency: 'CAD'
    guide?: boolean
    hideAmounts?: boolean
    merchantRules?: { payee: string; categoryId: string }[]
    lastPulseAt?: string
  }
  accounts?: Account[]
  categories: Category[]
  transactions: Transaction[]
  goals: Goal[]
  bills: Bill[]
  debtPlan: { strategy: 'interest' | 'balance' | 'custom'; extra: number; order: string[] } | null
}
