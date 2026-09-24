import type { Bill, Category, Frequency, Goal, MonthKey, PockitData, Transaction } from '../types'

export const monthKey = (date: Date): MonthKey =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` as MonthKey
export const currentMonth = () => monthKey(new Date())
export const todayISO = () => {
  const date = new Date()
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`
}
export const shiftMonth = (key: MonthKey, by: number): MonthKey => {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(year, month - 1 + by, 1))
}
export const monthLabel = (key: MonthKey) => {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}
let hideDisplayAmounts = false
/** Display-only masking for the single Pockit app root. This is not encryption or a session lock. */
export const setMoneyPrivacy = (hidden: boolean) => {
  hideDisplayAmounts = hidden
}
export const money = (value: number, _currency: 'CAD' = 'CAD', compact = false) =>
  hideDisplayAmounts
    ? '••••'
    : new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        maximumFractionDigits: compact ? 0 : 2,
        minimumFractionDigits: compact ? 0 : 2,
      }).format(Number.isFinite(value) ? value : 0)
export const monthlyPay = (amount: number, frequency: Frequency) =>
  amount * { weekly: 52 / 12, biweekly: 26 / 12, 'twice-monthly': 2, monthly: 1 }[frequency]
export const transactionsInMonth = (transactions: Transaction[], month: MonthKey) =>
  transactions.filter((t) => t.date.slice(0, 7) === month)
export const categoryPeriodAmount = (category: Category, month: MonthKey) => {
  const latest = Object.keys(category.changes || {})
    .filter((key) => key <= month)
    .sort()
    .at(-1)
  return latest ? category.changes[latest] : category.baseAmount
}
export const categoryBudget = (category: Category, month: MonthKey, monthlyIncome: number) => {
  if (category.archived || month < category.starts) return 0
  if (Object.prototype.hasOwnProperty.call(category.overrides, month))
    return category.overrides[month]
  if (category.mode === 'rollover' && category.targetType === 'percent')
    return Math.max(0, (monthlyIncome * category.targetValue) / 100)
  if (category.mode === 'rollover' && category.targetType === 'none') return 0
  return monthlyPay(categoryPeriodAmount(category, month), category.frequency)
}
export const spendingByCategory = (transactions: Transaction[], month: MonthKey) => {
  const totals: Record<string, number> = {}
  for (const t of transactionsInMonth(transactions, month)) {
    if (t.type !== 'expense' || t.excludedFromBudget) continue
    const direction = t.refund ? -1 : 1
    if (t.splits?.length) {
      for (const split of t.splits)
        totals[split.categoryId] = (totals[split.categoryId] || 0) + split.amount * direction
    } else if (t.categoryId)
      totals[t.categoryId] = (totals[t.categoryId] || 0) + t.amount * direction
  }
  return totals
}
export const monthSummary = (data: PockitData, month: MonthKey) => {
  const plannedIncome =
    data.profile.plannedMonthlyIncome !== undefined &&
    month >= (data.profile.plannedIncomeStarts || month)
      ? data.profile.plannedMonthlyIncome
      : monthlyPay(data.profile.payAmount, data.profile.payFrequency)
  const txs = transactionsInMonth(data.transactions, month)
  const actualIncome = txs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const spent = txs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + (t.refund ? -t.amount : t.amount), 0)
  const allocated = data.categories.reduce(
    (sum, c) => sum + categoryBudget(c, month, plannedIncome),
    0,
  )
  return {
    income: plannedIncome,
    plannedIncome,
    actualIncome,
    spent,
    remaining: plannedIncome - spent,
    recordedNet: actualIncome - spent,
    allocated,
    unallocated: plannedIncome - allocated,
  }
}
export const rolloverBalance = (category: Category, data: PockitData, month: MonthKey) => {
  if (category.mode !== 'rollover')
    return (
      categoryBudget(category, month, monthSummary(data, month).income) -
      (spendingByCategory(data.transactions, month)[category.id] || 0)
    )
  let total = 0
  let cursor = category.starts
  let guard = 0
  while (cursor <= month && guard++ < 240) {
    const income = monthSummary(data, cursor).income
    total +=
      category.funding === 'manual'
        ? transactionsInMonth(data.transactions, cursor)
            .filter(
              (t) => t.categoryId === category.id && (t.type === 'transfer' || t.type === 'income'),
            )
            .reduce((n, t) => n + t.amount, 0)
        : categoryBudget(category, cursor, income)
    total -= spendingByCategory(data.transactions, cursor)[category.id] || 0
    cursor = shiftMonth(cursor, 1)
  }
  return total
}
export interface Projection {
  months: number | null
  monthlyInterest: number
  endingBalance: number
}
export const projectGoal = (goal: Goal, extra = 0): Projection => {
  const principal = Math.max(0, goal.balance)
  if (goal.kind === 'debt' && goal.interestUnknown && principal > 0)
    return { months: null, monthlyInterest: 0, endingBalance: principal }
  const payment = Math.max(0, goal.monthly + extra)
  const rate = Math.max(0, goal.annualInterest) / 1200
  const monthlyInterest = principal * rate
  if (goal.kind === 'debt' && principal === 0)
    return { months: 0, monthlyInterest: 0, endingBalance: 0 }
  if (goal.kind === 'saving' && principal >= goal.target)
    return { months: 0, monthlyInterest, endingBalance: principal }
  if (
    (payment <= 0 && (goal.kind === 'debt' || rate <= 0)) ||
    (goal.kind === 'debt' && payment <= monthlyInterest)
  )
    return { months: null, monthlyInterest, endingBalance: principal }
  let balance = principal
  for (let months = 1; months <= 600; months++) {
    balance =
      goal.kind === 'debt'
        ? Math.max(0, balance * (1 + rate) - payment)
        : balance * (1 + rate) + payment
    if (
      (goal.kind === 'debt' && balance <= 0) ||
      (goal.kind === 'saving' && balance >= goal.target)
    )
      return { months, monthlyInterest, endingBalance: balance }
  }
  return { months: null, monthlyInterest, endingBalance: balance }
}
export const projectionText = (goal: Goal, extra = 0) => {
  if (goal.kind === 'debt' && goal.interestUnknown && goal.balance > 0)
    return 'Enter interest rate for an estimate'
  const { months } = projectGoal(goal, extra)
  if (months === null)
    return goal.kind === 'debt' ? 'Payment does not cover interest' : 'Add a monthly contribution'
  if (months === 0) return goal.kind === 'debt' ? 'Paid off' : 'Goal reached'
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return `${goal.kind === 'debt' ? 'Debt-free' : 'Goal reached'} ${new Intl.DateTimeFormat('en-CA', { month: 'short', year: 'numeric' }).format(date)}`
}
export const budgetHealth = (data: PockitData, month: MonthKey) => {
  const summary = monthSummary(data, month)
  const spend = spendingByCategory(data.transactions, month)
  const trouble = data.categories.filter(
    (c) => !c.archived && (spend[c.id] || 0) > categoryBudget(c, month, summary.income),
  )
  return { ...summary, trouble, spend }
}
export const billsForMonth = (bills: Bill[], month: MonthKey) => {
  const [year, number] = month.split('-').map(Number)
  const days = new Date(year, number, 0).getDate()
  return bills
    .filter((bill) => {
      if (!bill.starts) return !bill.frequency || bill.frequency === 'monthly'
      if (!bill.frequency || bill.frequency === 'monthly') return month >= bill.starts
      const [startYear, startMonth] = bill.starts.split('-').map(Number)
      const distance = (year - startYear) * 12 + number - startMonth
      return distance >= 0 && distance % (bill.frequency === 'quarterly' ? 3 : 12) === 0
    })
    .map((bill) => ({
      ...bill,
      date: `${month}-${String(Math.min(bill.day, days)).padStart(2, '0')}`,
      paid: bill.paidMonths.includes(month),
      skipped: bill.skippedMonths?.includes(month) || false,
    }))
}
/** Budget reminders are plans, not confirmed bills or paid transactions. */
export const categoryDueDates = (data: PockitData, month: MonthKey) => {
  const [year, number] = month.split('-').map(Number)
  const days = new Date(year, number, 0).getDate()
  const income = monthSummary(data, month).income
  const billCategories = new Set(
    billsForMonth(data.bills, month)
      .map((bill) => bill.categoryId)
      .filter(Boolean),
  )
  return data.categories
    .filter(
      (category) =>
        !category.archived &&
        category.paymentDay &&
        !billCategories.has(category.id) &&
        categoryBudget(category, month, income) > 0,
    )
    .map((category) => ({
      category,
      date: `${month}-${String(Math.min(category.paymentDay!, days)).padStart(2, '0')}`,
      amount: categoryBudget(category, month, income),
    }))
}
/** An estimate to set aside each month until the next quarterly or yearly bill. */
export const billMonthlyReserve = (bill: Bill, month: MonthKey) => {
  if (bill.frequency !== 'quarterly' && bill.frequency !== 'yearly') return null
  const period = bill.frequency === 'quarterly' ? 3 : 12
  for (let offset = 0; offset <= 24; offset++) {
    const dueMonth = shiftMonth(month, offset)
    const due = billsForMonth([bill], dueMonth)[0]
    if (due && !due.paid && !due.skipped)
      return {
        dueMonth,
        perMonth: Math.ceil((bill.amount / Math.min(period, offset + 1)) * 100) / 100,
      }
  }
  return null
}
export const categorizePayee = (payee: string, categories: Category[]) => {
  const q = payee.toLowerCase()
  const rules: [RegExp, string][] = [
    [/grocery|superstore|safeway|walmart|costco|loblaw|no frills/, 'Groceries'],
    [/uber eats|doordash|restaurant|cafe|coffee|tim hortons|starbucks/, 'Dining Out'],
    [/shell|esso|petro|chevron|gas station/, 'Gas'],
    [/netflix|spotify|apple\.com|disney|prime video/, 'Subscriptions'],
    [/hydro|electric|water bill|fortis/, 'Utilities'],
    [/rent|landlord/, 'Rent'],
    [/telus|rogers|bell mobility|freedom mobile/, 'Phone'],
  ]
  const name = rules.find(([pattern]) => pattern.test(q))?.[1]
  return categories.find((c) => c.name === name)?.id
}
export const recurringMerchants = (transactions: Transaction[]) => {
  const groups = new Map<string, Transaction[]>()
  for (const t of transactions.filter((t) => t.type === 'expense')) {
    const key = t.payee.trim().toLowerCase()
    groups.set(key, [...(groups.get(key) || []), t])
  }
  return [...groups.entries()]
    .filter(([, txs]) => {
      if (txs.length < 2) return false
      const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date))
      return sorted.some(
        (t, i) =>
          i > 0 &&
          Math.abs(t.amount - sorted[i - 1].amount) <= Math.max(2, t.amount * 0.1) &&
          (new Date(t.date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000 >= 25 &&
          (new Date(t.date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000 <= 35,
      )
    })
    .map(([name]) => name)
}
export const receiptFields = (text: string) => {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  const totalLine = [...lines]
    .reverse()
    .find(
      (line) => /\b(total|amount due|balance due)\b/i.test(line) && /\d[\d,]*\.\d{2}/.test(line),
    )
  const amount = totalLine
    ? Number(totalLine.match(/\d[\d,]*\.\d{2}(?!.*\d[\d,]*\.\d{2})/)?.[0].replaceAll(',', '') || 0)
    : 0
  return { payee: lines[0]?.slice(0, 60) || '', amount: Number.isFinite(amount) ? amount : 0 }
}
export const simulateDebtPlan = (goals: Goal[], plan: NonNullable<PockitData['debtPlan']>) => {
  const debts = goals.filter((g) => g.kind === 'debt' && g.balance > 0)
  if (debts.some((goal) => goal.interestUnknown))
    return {
      months: null,
      interest: 0,
      payoffMonths: {} as Record<string, number>,
      order: debts,
      unknownInterest: true,
    }
  const ordered = [...debts].sort((a, b) =>
    plan.strategy === 'interest'
      ? b.annualInterest - a.annualInterest
      : plan.strategy === 'balance'
        ? a.balance - b.balance
        : (plan.order.includes(a.id) ? plan.order.indexOf(a.id) : Number.MAX_SAFE_INTEGER) -
          (plan.order.includes(b.id) ? plan.order.indexOf(b.id) : Number.MAX_SAFE_INTEGER),
  )
  const balances = Object.fromEntries(ordered.map((g) => [g.id, g.balance])) as Record<
    string,
    number
  >
  const payments = Object.fromEntries(ordered.map((g) => [g.id, g.monthly])) as Record<
    string,
    number
  >
  const startingPayment =
    ordered.reduce((n, g) => n + Math.max(0, g.monthly), 0) + Math.max(0, plan.extra)
  let interest = 0
  const payoffMonths: Record<string, number> = {}
  if (!ordered.length)
    return { months: 0, interest, payoffMonths, order: ordered, unknownInterest: false }
  for (let month = 1; month <= 600; month++) {
    for (const debt of ordered)
      if (balances[debt.id] > 0) {
        const charge = (balances[debt.id] * Math.max(0, debt.annualInterest)) / 1200
        balances[debt.id] += charge
        interest += charge
      }
    let available = startingPayment
    for (const debt of ordered)
      if (balances[debt.id] > 0) {
        const amount = Math.min(balances[debt.id], payments[debt.id])
        balances[debt.id] -= amount
        available -= amount
        if (balances[debt.id] <= 0) payoffMonths[debt.id] = month
      }
    for (const debt of ordered)
      if (available > 0 && balances[debt.id] > 0) {
        const amount = Math.min(balances[debt.id], available)
        balances[debt.id] -= amount
        available -= amount
        if (balances[debt.id] <= 0) payoffMonths[debt.id] = month
      }
    if (ordered.every((debt) => balances[debt.id] <= 0))
      return { months: month, interest, payoffMonths, order: ordered, unknownInterest: false }
  }
  return { months: null, interest, payoffMonths, order: ordered, unknownInterest: false }
}
