import { useState } from 'react'
import type { PockitData } from '../types'
import { assignGoalFunding, fundingSummary, accountReservations } from '../lib/goalFunding'
import { accountBalance } from '../lib/ledger'
import { money, todayISO } from '../lib/finance'
import { Field, Icon, Modal } from './UI'
export function GoalFunding({
  data,
  goalId,
  update,
}: {
  data: PockitData
  goalId: string
  update: (recipe: (data: PockitData) => PockitData) => void
}) {
  const goal = data.goals.find((item) => item.id === goalId)!
  const summary = fundingSummary(data, goalId)
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [error, setError] = useState('')
  const accounts = (data.accounts || []).filter(
    (item) => !item.archived && item.kind !== 'credit' && item.asOf <= todayISO(),
  )
  const total = Object.values(draft).reduce((sum, value) => sum + (Number(value) || 0), 0)
  return (
    <>
      <div className="goal-funding-line">
        <Icon name="Wallet" size={17} />
        <span>
          {goal.funding
            ? `${money(summary.assigned)} assigned in accounts`
            : 'Where is this goal’s money?'}
          {(summary.unbacked > 0 || summary.overAssigned > 0 || summary.issues.length > 0) &&
            goal.funding && (
              <small className="warning-text">
                Check assignments against goal progress and account balances.
              </small>
            )}
        </span>
        <button
          className="text-button"
          onClick={() => {
            setDraft(
              Object.fromEntries(
                (goal.funding || []).map((item) => [item.accountId, String(item.amount)]),
              ),
            )
            setError('')
            setOpen(true)
          }}
        >
          {goal.funding ? 'Manage' : 'Assign existing money'}
        </button>
      </div>
      {open && (
        <Modal title={`Money behind ${goal.name}`} onClose={() => setOpen(false)}>
          <div className="modal-body">
            <p className="goal-form-note">
              Assign money already in your accounts to this purpose. Several goals can share an
              account, but the same money can only be assigned once. This does not make a bank
              transfer or add an Activity transaction.
            </p>
            {accounts.length ? (
              accounts.map((account) => (
                <Field
                  key={account.id}
                  label={account.name}
                  hint={`${money(accountBalance(account, data.transactions, todayISO()) - accountReservations(data, account.id, goalId))} available before this goal’s assignment`}
                >
                  <input
                    aria-label={`Assign from ${account.name}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft[account.id] || ''}
                    placeholder="0.00"
                    onChange={(event) => setDraft({ ...draft, [account.id]: event.target.value })}
                  />
                </Field>
              ))
            ) : (
              <p>Add a current asset account in More → Accounts first.</p>
            )}
            <div className="tool-result">
              <span>Goal balance after assigning</span>
              <strong>
                {money(goal.balance)} → {money(total)}
              </strong>
              <small>
                Your goal history records any balance adjustment. Other goals and your account
                balances stay unchanged. Investment balances can change with the market.
              </small>
            </div>
            {error && (
              <p className="form-message" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="primary-button"
                disabled={
                  !accounts.length ||
                  Object.values(draft).some(
                    (value) => !Number.isFinite(Number(value)) || Number(value) < 0,
                  )
                }
                onClick={() => {
                  try {
                    const funding = accounts.map((account) => ({
                      accountId: account.id,
                      amount: Number(draft[account.id] || 0),
                    }))
                    assignGoalFunding(data, goalId, funding)
                    update((current) => assignGoalFunding(current, goalId, funding))
                    setOpen(false)
                  } catch (cause) {
                    setError((cause as Error).message)
                  }
                }}
              >
                Save assignments
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
