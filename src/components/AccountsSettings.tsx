import { useState } from 'react'
import type { Account, PockitData } from '../types'
import { money, todayISO } from '../lib/finance'
import { accountBalance, reconcileAccount } from '../lib/ledger'
import { accountTypeLabel } from '../lib/accounts'
import { Field, Icon, SectionHead } from './UI'

export function AccountsSettings({
  data,
  update,
}: {
  data: PockitData
  update: (recipe: (current: PockitData) => PockitData) => void
}) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Account['kind'] | 'tfsa'>('chequing')
  const [contributionCategory, setContributionCategory] = useState<string | undefined>()
  const [balance, setBalance] = useState('')
  const [reconciling, setReconciling] = useState<string | null>(null)
  const [actual, setActual] = useState('')
  const [message, setMessage] = useState('')
  function addAccount() {
    const amount = Number(balance)
    if (!name.trim() || !balance.trim() || !Number.isFinite(amount)) return
    const now = new Date().toISOString()
    update((current) => ({
      ...current,
      accounts: [
        ...(current.accounts || []),
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          kind: kind === 'tfsa' ? 'investment' : kind,
          subtype: kind === 'tfsa' ? 'TFSA' : undefined,
          contributionCategoryId:
            kind === 'tfsa' || kind === 'investment'
              ? (contributionCategory ??
                data.categories.find(
                  (category) => !category.archived && /invest|tfsa|rrsp/i.test(category.name),
                )?.id)
              : undefined,
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
    setMessage('Balance updated. Pockit now starts its estimate from this amount.')
  }
  return (
    <section className="panel settings-panel" id="accounts">
      <SectionHead
        title="Manual accounts"
        help="Start with the balance shown today in each account. In Activity, record a Transfer with a From account and a To account to move money between them. Example: moving $200 from chequing to a TFSA reduces chequing by $200 and adds $200 to the TFSA. Choose your investment category to track it against your monthly plan. Transfers are not income or spending. Check investment balances as their market value changes; Pockit does not calculate TFSA contribution room."
      />
      <p className="panel-subtitle">
        Track your balances separately. Move money between accounts with a transfer in Activity.
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
          <div className="account-summary">
            <strong>{account.name}</strong>
            <small>
              {accountTypeLabel(account)} {account.bank ? `· ${account.bank}` : ''}{' '}
              {account.lastFour ? `· ••••${account.lastFour}` : ''}
              {account.archived ? ' · Archived' : ''}
            </small>
            <small>
              {account.waypointKey ? 'Waypoint snapshot' : 'starting balance checked'}{' '}
              {account.reconciledAt?.slice(0, 10) || account.asOf}
            </small>
            {account.waypointKey && (
              <small>Manual tracking in Pockit; Waypoint bank sync does not transfer.</small>
            )}
            {account.waypointKey &&
              (account.subtype ||
                account.connection ||
                account.availableBalance !== undefined ||
                account.creditLimit !== undefined) && (
                <small>
                  {[
                    account.subtype,
                    account.connection ? `Waypoint: ${account.connection}` : '',
                    account.availableBalance !== undefined
                      ? `available at export ${money(account.availableBalance)}`
                      : '',
                    account.creditLimit !== undefined ? `limit ${money(account.creditLimit)}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              )}
          </div>
          <div className="account-balance">
            <small>Estimated balance</small>
            <strong>
              {account.kind === 'credit'
                ? accountBalance(account, data.transactions, todayISO()) > 0
                  ? `${money(accountBalance(account, data.transactions, todayISO()))} credit`
                  : `${money(Math.abs(accountBalance(account, data.transactions, todayISO())))} owed`
                : money(accountBalance(account, data.transactions, todayISO()))}
            </strong>
          </div>
          <div className="account-actions">
            <button
              className="secondary-button compact"
              onClick={() => {
                setReconciling(account.id)
                setActual('')
              }}
            >
              Check balance
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
          </div>
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
              onChange={(event) => setKind(event.target.value as Account['kind'] | 'tfsa')}
            >
              <option value="chequing">Chequing</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit card</option>
              <option value="investment">Investment</option>
              <option value="tfsa">TFSA (investment)</option>
              <option value="cash">Cash</option>
            </select>
          </Field>
          {(kind === 'tfsa' || kind === 'investment') && (
            <Field
              label="Contribution category"
              hint="Transfers into this account can count toward this category's monthly plan without becoming expenses."
            >
              <select
                aria-label="Contribution category"
                value={
                  contributionCategory ??
                  data.categories.find(
                    (category) => !category.archived && /invest|tfsa|rrsp/i.test(category.name),
                  )?.id ??
                  ''
                }
                onChange={(event) => setContributionCategory(event.target.value)}
              >
                <option value="">Choose later in Activity</option>
                {data.categories
                  .filter((category) => !category.archived)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
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
