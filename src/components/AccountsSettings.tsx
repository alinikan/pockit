import { useState } from 'react'
import type { Account, PockitData } from '../types'
import { money, todayISO } from '../lib/finance'
import { accountBalance, reconcileAccount } from '../lib/ledger'
import { Field, Icon, SectionHead } from './UI'

export function AccountsSettings({
  data,
  update,
}: {
  data: PockitData
  update: (recipe: (current: PockitData) => PockitData) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Account['kind']>('chequing')
  const [balance, setBalance] = useState('')
  const [reconciling, setReconciling] = useState<string | null>(null)
  const [actual, setActual] = useState('')
  const [message, setMessage] = useState('')
  function addAccount() {
    const amount = Number(balance)
    if (!name.trim() || !Number.isFinite(amount)) return
    const now = new Date().toISOString()
    update((current) => ({
      ...current,
      accounts: [
        ...(current.accounts || []),
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          kind,
          openingBalance: kind === 'credit' ? -Math.abs(amount) : amount,
          asOf: todayISO(),
          asOfTime: now,
          reconciledAt: now,
          reconciliations: [
            {
              date: todayISO(),
              balance: kind === 'credit' ? -Math.abs(amount) : amount,
              adjustment: 0,
            },
          ],
        },
      ],
    }))
    setName('')
    setBalance('')
    setMessage('Account added. Assign transactions to it in Activity.')
  }
  function saveReconciliation(id: string) {
    const amount = Number(actual)
    if (!actual.trim() || !Number.isFinite(amount)) {
      setMessage('Enter the balance shown by your account.')
      return
    }
    const account = data.accounts?.find((item) => item.id === id)
    update((current) =>
      reconcileAccount(
        current,
        id,
        account?.kind === 'credit' ? -Math.abs(amount) : amount,
        todayISO(),
        new Date().toISOString(),
      ),
    )
    setReconciling(null)
    setActual('')
    setMessage('Balance reconciled. Pockit now starts its estimate from this amount.')
  }
  return (
    <section className="panel settings-panel" id="accounts">
      <SectionHead
        title="Manual accounts"
        help="Add the balance shown today in each account. Assign new transactions to an account so Pockit can estimate its balance. Reconcile when the bank and Pockit differ; no bank is connected."
      />
      <p className="panel-subtitle">
        Keep chequing, savings, credit cards, and cash distinct. Credit-card purchases are expenses;
        paying the card is a transfer.
      </p>
      {(data.accounts || []).map((account) => (
        <div className="account-card" key={account.id}>
          <div className="account-icon">
            <Icon
              name={
                account.kind === 'credit'
                  ? 'CreditCard'
                  : account.kind === 'investment'
                    ? 'TrendingUp'
                    : 'Landmark'
              }
              size={21}
            />
          </div>
          <div>
            <strong>{account.name}</strong>
            <small>
              {account.kind} · starting balance checked{' '}
              {account.reconciledAt?.slice(0, 10) || account.asOf}
            </small>
          </div>
          <strong>
            {account.kind === 'credit'
              ? accountBalance(account, data.transactions) > 0
                ? `${money(accountBalance(account, data.transactions))} credit`
                : `${money(Math.abs(accountBalance(account, data.transactions)))} owed`
              : money(accountBalance(account, data.transactions))}
          </strong>
          <button
            className="secondary-button compact"
            onClick={() => {
              setReconciling(account.id)
              setActual('')
            }}
          >
            Reconcile
          </button>
          <button
            className="text-button"
            onClick={() =>
              update((current) => ({
                ...current,
                accounts: current.accounts?.map((item) =>
                  item.id === account.id ? { ...item, archived: !item.archived } : item,
                ),
              }))
            }
          >
            {account.archived ? 'Restore' : 'Archive'}
          </button>
          {reconciling === account.id && (
            <div className="reconcile-form">
              <Field
                label={
                  account.kind === 'credit'
                    ? 'Amount owed on your statement in CAD'
                    : 'Balance shown by your account now'
                }
              >
                <input
                  type="number"
                  min={account.kind === 'credit' ? 0 : undefined}
                  step="0.01"
                  inputMode="decimal"
                  value={actual}
                  onChange={(event) => setActual(event.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <p>This resets the estimate from today. Earlier transactions stay in your history.</p>
              <button
                className="primary-button compact"
                onClick={() => saveReconciliation(account.id)}
              >
                Use this balance
              </button>
              <button className="text-button" onClick={() => setReconciling(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      ))}
      <div className="account-add">
        <h3>Add a manual account</h3>
        <div className="form-grid">
          <Field label="Account name">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Everyday chequing"
            />
          </Field>
          <Field label="Type">
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as Account['kind'])}
            >
              <option value="chequing">Chequing</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit card</option>
              <option value="investment">Investment</option>
              <option value="cash">Cash</option>
            </select>
          </Field>
          <Field label={kind === 'credit' ? 'Amount owed today in CAD' : 'Balance today in CAD'}>
            <input
              type="number"
              min={kind === 'credit' ? 0 : undefined}
              step="0.01"
              inputMode="decimal"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              placeholder="0.00"
            />
          </Field>
        </div>
        <button
          className="secondary-button compact"
          disabled={!name.trim() || !balance.trim() || !Number.isFinite(Number(balance))}
          onClick={addAccount}
        >
          <Icon name="Plus" size={16} /> Add account
        </button>
      </div>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
