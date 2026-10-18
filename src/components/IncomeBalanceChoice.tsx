import { useId } from 'react'
import type { PockitData, Transaction } from '../types'
import { money, shortDate, todayISO } from '../lib/finance'
import { prepareIncomeEntry } from '../lib/income'
import { accountBalance } from '../lib/ledger'
import { validISODate } from '../lib/numbers'
import { Icon } from './UI'

export function IncomeBalanceChoice({
  data,
  entry,
  onChange,
}: {
  data: PockitData
  entry: Transaction
  onChange: (posting: Transaction['balancePosting']) => void
}) {
  const name = useId()
  const account = data.accounts?.find((item) => item.id === entry.accountId)
  if (!account || entry.type !== 'income') return null
  const before = data.transactions.find((item) => item.id === entry.id) || null
  const legacy =
    before?.type === 'income' && before.accountId === account.id && !before.balancePosting
  const current = accountBalance(account, data.transactions, todayISO())
  function preview(mode?: 'add' | 'included') {
    const posting = mode ? { mode, date: todayISO(), time: new Date().toISOString() } : undefined
    const candidate = prepareIncomeEntry({ ...entry, balancePosting: posting }, before)
    return accountBalance(
      account!,
      [
        ...data.transactions.filter((item) => item.id !== entry.id),
        {
          ...candidate,
          createdAt: candidate.createdAt || new Date().toISOString(),
        },
      ],
      todayISO(),
    )
  }
  const choices = [
    ...(legacy
      ? [
          {
            mode: undefined,
            label: 'Keep existing handling',
            detail: 'Uses the original entry date and your last balance check.',
          },
        ]
      : []),
    {
      mode: 'add' as const,
      label: 'Yes, add this income',
      detail: 'Add the deposit to the balance Pockit shows now.',
    },
    {
      mode: 'included' as const,
      label: 'No, it’s already included',
      detail: 'Keep the income in Activity without adding it again.',
    },
  ]
  return (
    <fieldset className="income-balance-choice">
      <legend>
        <Icon name="Landmark" size={18} /> Update this account’s balance?
      </legend>
      <p>
        {account.name} · Currently {money(current)}
      </p>
      {choices.map((choice) => (
        <label key={choice.mode || 'automatic'} className="income-balance-option">
          <input
            type="radio"
            name={name}
            checked={
              choice.mode ? entry.balancePosting?.mode === choice.mode : !entry.balancePosting
            }
            onChange={() =>
              onChange(
                choice.mode
                  ? { mode: choice.mode, date: todayISO(), time: new Date().toISOString() }
                  : undefined,
              )
            }
          />
          <span>
            <strong>{choice.label}</strong>
            <small>{choice.detail}</small>
            <span className="income-balance-preview">
              {money(current)} <span aria-label="becomes">→</span> {money(preview(choice.mode))}
            </span>
          </span>
        </label>
      ))}
      <p className="goal-form-note" role="status">
        {!entry.balancePosting && !legacy
          ? 'Choose yes or no before saving.'
          : entry.balancePosting?.mode === 'add'
            ? `Your income is recorded on ${validISODate(entry.date) ? shortDate(entry.date) : 'the date you choose'}. The balance preview shows the effect of saving; a newer checked balance can already include a saved entry.`
            : 'This keeps the income in your reports. For an existing entry, the preview also replaces its previous balance effect.'}
      </p>
      <details>
        <summary>Which option should I choose?</summary>
        <p>
          Choose Yes if this deposit is missing from Pockit’s current account balance. Choose No if
          the balance you last entered already includes it—for example, when adding an older
          paycheque.
        </p>
        <p>
          Last checked: {shortDate(account.reconciledAt?.slice(0, 10) || account.asOf)}. These
          choices update Pockit’s estimate; they do not move money at your bank.
        </p>
      </details>
    </fieldset>
  )
}
