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
  const linkedGoalId = before?.goalId || after?.goalId
  const delta = linkedGoalId ? (after?.amount || 0) - (before?.amount || 0) : 0
  const goals = linkedGoalId
    ? data.goals.map((goal) =>
        goal.id !== linkedGoalId
          ? goal
          : {
              ...goal,
              balance: Math.max(0, goal.balance + (goal.kind === 'debt' ? -delta : delta)),
              history: after
                ? before
                  ? goal.history.map((entry) =>
                      entry.transactionId === before.id
                        ? {
                            ...entry,
                            date: after.date,
                            amount: after.amount,
                            note: after.note || entry.note,
                          }
                        : entry,
                    )
                  : [
                      {
                        date: after.date,
                        amount: after.amount,
                        note: after.note || (goal.kind === 'debt' ? 'Payment' : 'Contribution'),
                        transactionId: after.id,
                      },
                      ...goal.history,
                    ]
                : goal.history.filter((entry) => entry.transactionId !== before!.id),
            },
      )
    : data.goals
  const linkedBillId = before?.billId || after?.billId
  const bills = linkedBillId
    ? data.bills.map((bill) => {
        if (bill.id !== linkedBillId) return bill
        const previousMonth = before?.date.slice(0, 7)
        const nextMonth = after?.date.slice(0, 7)
        return {
          ...bill,
          paidMonths: [
            ...new Set([
              ...bill.paidMonths.filter((month) => month !== previousMonth),
              ...(nextMonth ? [nextMonth] : []),
            ]),
          ],
        }
      })
    : data.bills
  return { ...data, transactions, goals, bills }
}
