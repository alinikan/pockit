import type { PockitData } from '../types'
import { accountBalance } from './ledger'
import { cents } from './experience'
import { todayISO } from './finance'
export function accountReservations(data: PockitData, accountId: string, exceptGoal?: string) {
  return cents(
    data.goals
      .filter((goal) => goal.kind === 'saving' && goal.id !== exceptGoal)
      .reduce(
        (sum, goal) =>
          sum +
          (goal.funding || [])
            .filter((item) => item.accountId === accountId)
            .reduce((total, item) => total + item.amount, 0),
        0,
      ),
  )
}
export function fundingSummary(data: PockitData, goalId: string) {
  const goal = data.goals.find((item) => item.id === goalId)
  const assigned = cents((goal?.funding || []).reduce((sum, item) => sum + item.amount, 0))
  const issues = (goal?.funding || []).filter((item) => {
    const account = data.accounts?.find(
      (account) => account.id === item.accountId && !account.archived,
    )
    return (
      !account ||
      accountBalance(account, data.transactions, todayISO()) + 0.001 <
        accountReservations(data, item.accountId)
    )
  })
  return {
    assigned,
    unbacked: cents(Math.max(0, (goal?.balance || 0) - assigned)),
    overAssigned: cents(Math.max(0, assigned - (goal?.balance || 0))),
    issues,
  }
}
export function assignGoalFunding(
  data: PockitData,
  goalId: string,
  funding: { accountId: string; amount: number }[],
) {
  const goal = data.goals.find((item) => item.id === goalId && item.kind === 'saving')
  if (!goal) throw new Error('Choose a savings goal.')
  if (new Set(funding.map((item) => item.accountId)).size !== funding.length)
    throw new Error('Use each account once.')
  for (const item of funding) {
    if (!Number.isFinite(item.amount) || item.amount < 0 || cents(item.amount) !== item.amount)
      throw new Error('Use positive amounts with up to two decimal places.')
    const account = data.accounts?.find(
      (account) => account.id === item.accountId && !account.archived && account.kind !== 'credit',
    )
    if (!account || account.asOf > todayISO()) throw new Error('Choose a current asset account.')
    const available =
      accountBalance(account, data.transactions, todayISO()) -
      accountReservations(data, account.id, goalId)
    if (item.amount > available + 0.001)
      throw new Error(
        `${account.name} does not have enough unassigned money. Check its balance or another goal’s assignment.`,
      )
  }
  const balance = cents(funding.reduce((sum, item) => sum + item.amount, 0))
  return {
    ...data,
    goals: data.goals.map((item) =>
      item.id === goalId
        ? {
            ...item,
            funding: funding.filter((entry) => entry.amount > 0),
            balance,
            history:
              balance === item.balance
                ? item.history
                : [
                    {
                      date: todayISO(),
                      amount: cents(balance - item.balance),
                      note: 'Existing money assigned to this goal — no transfer',
                    },
                    ...item.history,
                  ],
          }
        : item,
    ),
  }
}
