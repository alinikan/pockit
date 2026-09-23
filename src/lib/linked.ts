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
    if (!oldImpact && !newImpact) return goal
    const balance = goal.balance - oldImpact + newImpact
    if (balance < -0.001) throw new Error(`The linked movement exceeds ${goal.name}'s balance.`)
    const history = goal.history.filter((entry) => entry.transactionId !== before?.id)
    if (newImpact && after)
      history.unshift({
        date: after.date,
        amount: Math.abs(newImpact),
        note: after.note || (newImpact < 0 ? 'Withdrawal or payment' : 'Contribution'),
        transactionId: after.id,
      })
    return { ...goal, balance: Math.max(0, balance), history }
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
  if (kind === 'debt') return -transaction.amount
  return transaction.type === 'expense' && !transaction.refund
    ? -transaction.amount
    : transaction.refund
      ? transaction.amount
      : transaction.amount
}
