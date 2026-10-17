import type { PockitData, Transaction } from '../types'

/** Apply an Activity edit while keeping an explicitly linked goal or bill in step. */
export function changeTransaction(
  data: PockitData,
  before: Transaction | null,
  after: Transaction | null,
): PockitData {
  if (before && after && before.id !== after.id) throw new Error('A transaction ID cannot change.')
  const transactions = before
    ? after
      ? data.transactions.map((transaction) => (transaction.id === before.id ? after : transaction))
      : data.transactions.filter((transaction) => transaction.id !== before.id)
    : after
      ? [...data.transactions, after]
      : data.transactions
  const goals = data.goals.map((goal) => {
    const oldImpact = before?.goalId === goal.id ? goalImpact(goal.kind, before) : 0
    const newImpact = after?.goalId === goal.id ? goalImpact(goal.kind, after) : 0
    if (before?.goalId !== goal.id && after?.goalId !== goal.id) return goal
    const balance = goal.balance - oldImpact + newImpact
    if (balance < -0.001) throw new Error(`The linked movement exceeds ${goal.name}'s balance.`)
    const history = goal.history.filter((entry) => entry.transactionId !== before?.id)
    if (after?.goalId === goal.id)
      history.unshift({
        date: after!.date,
        amount:
          goal.kind === 'saving' && after!.type === 'expense' && !after!.refund
            ? -after!.amount
            : after!.amount,
        note:
          after!.note ||
          (goal.kind === 'debt' || (after!.type === 'expense' && !after!.refund)
            ? goal.kind === 'debt'
              ? 'Debt payment'
              : 'Spending from savings'
            : 'Contribution'),
        transactionId: after!.id,
      })
    let funding = goal.funding
    if (funding && goal.kind === 'saving') {
      funding = funding.map((item) => ({ ...item }))
      for (const [transaction, direction] of [
        [before, -1],
        [after, 1],
      ] as const) {
        if (!transaction || transaction.goalId !== goal.id) continue
        const accountId =
          transaction.type === 'expense' && !transaction.refund
            ? transaction.accountId
            : transaction.toAccountId ||
              (transaction.type === 'income' || transaction.refund
                ? transaction.accountId
                : undefined)
        if (!accountId) continue
        const delta = goalImpact('saving', transaction) * direction
        const entry = funding.find((item) => item.accountId === accountId)
        if (entry) entry.amount = Math.max(0, Math.round((entry.amount + delta) * 100) / 100)
        else if (delta > 0) funding.push({ accountId, amount: delta })
      }
    }
    return { ...goal, balance: Math.max(0, balance), history, ...(funding ? { funding } : {}) }
  })
  const bills = data.bills.map((bill) => {
    const affected = [before, after].some((entry) => entry?.billId === bill.id)
    if (!affected) return bill
    const linkedMonths = new Set(
      transactions
        .filter((entry) => entry.billId === bill.id)
        .map((entry) => entry.date.slice(0, 7)),
    )
    const previousMonth = before?.billId === bill.id ? before.date.slice(0, 7) : undefined
    return {
      ...bill,
      paidMonths: [
        ...new Set([
          ...bill.paidMonths.filter((month) => month !== previousMonth || linkedMonths.has(month)),
          ...linkedMonths,
        ]),
      ],
    }
  })
  return { ...data, transactions, goals, bills }
}

function goalImpact(kind: 'saving' | 'debt', transaction: Transaction) {
  const movement =
    kind === 'debt'
      ? -transaction.amount
      : transaction.type === 'expense' && !transaction.refund
        ? -transaction.amount
        : transaction.refund
          ? transaction.amount
          : transaction.amount
  return movement - (transaction.goalBaselineImpact || 0)
}
