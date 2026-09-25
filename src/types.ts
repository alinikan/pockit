export type MonthKey = `${number}-${number}`
export type TransactionType = 'expense' | 'income' | 'transfer'
export type GoalKind = 'saving' | 'debt'
export type CategoryMode = 'fresh' | 'rollover'
export type ContributionTarget = 'fixed' | 'percent' | 'none'
export type FundingMode = 'auto' | 'manual'
export type Frequency = 'weekly' | 'biweekly' | 'twice-monthly' | 'monthly'

export interface CategoryPolicy {
  frequency: Frequency
  paymentDay?: number
  mode: CategoryMode
  targetType: ContributionTarget
  targetValue: number
  funding: FundingMode
}

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
  /** Rules that begin in a chosen month, preserving earlier plan calculations. */
  policyChanges?: Record<string, CategoryPolicy>
  /** Rules that apply to a single month only. */
  policyOverrides?: Record<string, CategoryPolicy>
  notes: string
  /** True until the user checks the example amount against their real spending. */
  suggested?: boolean
  needsAmount?: boolean
  /** Starter plan follows the total monthly amount of this kind of goal until edited separately. */
  linkedGoalKind?: GoalKind
  archived?: boolean
  /** Last month this category is planned, while its earlier history remains visible. */
  ends?: MonthKey
  waypointKey?: string
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
  /** Part of a linked movement already present in an imported goal snapshot. */
  goalBaselineImpact?: number
  billId?: string
  accountId?: string
  toAccountId?: string
  refund?: boolean
  reviewed?: boolean
  cleared?: boolean
  source?: 'manual' | 'csv' | 'receipt' | 'waypoint'
  sourceId?: string
  tags?: string[]
  waypointTagsRaw?: string
  waypointGroup?: string
  waypointTypeRaw?: string
  excludedFromBudget?: boolean
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
  waypointKey?: string
  bank?: string
  lastFour?: string
  subtype?: string
  availableBalance?: number
  creditLimit?: number
  connection?: string
}

export interface Goal {
  id: string
  kind: GoalKind
  name: string
  balance: number
  target: number
  monthly: number
  annualInterest: number
  interestUnknown?: boolean
  color: string
  icon: string
  history: { date: string; amount: number; note: string; transactionId?: string }[]
  waypointKey?: string
  description?: string
  targetDate?: string
  originalDebtAmount?: number
  minimumPayment?: number
  importedManualContributions?: number
  importedTransactionContributions?: number
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
    plannedMonthlyIncome?: number
    plannedIncomeStarts?: MonthKey
    /** First month assigned to the current Waypoint budget snapshot. */
    waypointPlanStarts?: MonthKey
    housing: string
    /** Actual monthly rent or mortgage entered during setup; undefined means use an example. */
    housingPayment?: number
    transport: string
    carPayment?: number
    extras: string[]
    paydayAnchor?: string
    paydayDays?: [number, number]
    cashOnHand?: number
    cashAsOf?: string
    cashUpdatedAt?: string
  }
  settings: {
    theme: 'dark' | 'light'
    palette?: 'pockit' | 'waypoint' | 'ocean' | 'plum'
    smart: boolean
    currency: 'CAD'
    guide?: boolean
    hideAmounts?: boolean
    merchantRules?: { payee: string; categoryId: string }[]
    lastPulseAt?: string
    homeOrder?: string[]
    hiddenHomeSections?: string[]
    mobileTabs?: string[]
  }
  accounts?: Account[]
  categories: Category[]
  transactions: Transaction[]
  goals: Goal[]
  bills: Bill[]
  debtPlan: { strategy: 'interest' | 'balance' | 'custom'; extra: number; order: string[] } | null
}
