import { useMemo, useState } from 'react'
import type { MonthKey, PockitData } from '../types'
import { currentMonth, money, monthLabel, todayISO } from '../lib/finance'
import { downloadJSON } from '../lib/storage'
import {
  importWaypoint,
  parseWaypointZip,
  type WaypointArchive,
  type WaypointOptions,
} from '../lib/waypoint'
import { Icon, SectionHead } from './UI'

export function WaypointImport({
  data,
  update,
}: {
  data: PockitData
  update: (recipe: (value: PockitData) => PockitData) => void
}) {
  const [archive, setArchive] = useState<WaypointArchive | null>(null)
  const [filename, setFilename] = useState('')
  const [message, setMessage] = useState('')
  const [options, setOptions] = useState<WaypointOptions>({
    startMonth: currentMonth(),
    cadConfirmed: false,
    existing: 'waypoint',
    includePossibleDuplicates: false,
    creditPositiveMeansOwed: undefined,
    accountAsOfDate: '',
  })
  const preview = useMemo(() => {
    if (!archive || !options.cadConfirmed) return null
    try {
      return { result: importWaypoint(archive, data, options), error: '' }
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : 'Could not read the export.',
      }
    }
  }, [archive, data, options])
  const setOption = (patch: Partial<WaypointOptions>) =>
    setOptions((previous) => ({ ...previous, ...patch }))
  async function readFile(file: File) {
    setArchive(null)
    setFilename('')
    setMessage('')
    try {
      if (file.size > 10_000_000) throw new Error('Choose a Waypoint ZIP smaller than 10 MB.')
      const parsed = parseWaypointZip(new Uint8Array(await file.arrayBuffer()))
      setArchive(parsed)
      setFilename(file.name)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not open this ZIP.')
    }
  }
  const positiveCredit = archive?.accounts.some(
    (row) => /credit|card|loan/i.test(row.Type) && Number(row.Balance.replace(/[$,]/g, '')) > 0,
  )
  const missingAccountDate = archive?.accounts.some((row) => !row['Last Updated'])
  const transactionMonths = [
    ...new Set((archive?.transactions || []).map((row) => row.Date.slice(0, 7))),
  ].sort()
  return (
    <section className="panel settings-panel waypoint-import" id="waypoint-import">
      <SectionHead
        title="Move from Waypoint"
        help="Import the complete five-file Waypoint ZIP. Pockit reads it on this device and saves the resulting budget to your account. A backup of your current Pockit data downloads before any change."
      />
      <p className="panel-subtitle">
        Bring over categories, current budget amounts, goals, account snapshots, and transactions
        together. Review every choice before saving.
      </p>
      <label className="secondary-button compact restore-button">
        <Icon name="FileUp" size={16} /> Choose Waypoint ZIP
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          aria-label="Choose Waypoint ZIP"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void readFile(file)
            event.target.value = ''
          }}
        />
      </label>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      {archive && (
        <div className="waypoint-review" role="group" aria-label="Waypoint import preview">
          <div className="waypoint-review-heading">
            <Icon name="Layers3" size={20} />
            <div>
              <strong>{filename}</strong>
              <small>
                Read locally · {archive.transactions.length} transactions · {archive.budgets.length}{' '}
                budget rows · {archive.categories.length} categories · {archive.goals.length} goals
                · {archive.accounts.length} accounts
              </small>
            </div>
          </div>
          <p className="soft-note">
            This export has no currency field or month-by-month budget history. Confirm the currency
            and choose the month when its current budget should start in Pockit. Earlier Pockit
            months remain as they are.
          </p>
          <label className="check-line">
            <input
              type="checkbox"
              checked={options.cadConfirmed}
              onChange={(event) => setOption({ cadConfirmed: event.target.checked })}
            />{' '}
            I confirm the amounts in this Waypoint export are CAD.
          </label>
          <div className="form-grid">
            <label className="field">
              <span>Start this budget in</span>
              <input
                type="month"
                value={options.startMonth}
                onChange={(event) => setOption({ startMonth: event.target.value as MonthKey })}
              />
            </label>
            <label className="field">
              <span>When a name already exists</span>
              <select
                value={options.existing}
                onChange={(event) =>
                  setOption({ existing: event.target.value as WaypointOptions['existing'] })
                }
              >
                <option value="waypoint">Use Waypoint values from start month</option>
                <option value="keep">Keep existing Pockit values</option>
              </select>
            </label>
          </div>
          <p className="soft-note">
            Existing categories and goals keep their Pockit IDs, so transactions and charts stay
            connected. “Use Waypoint” updates matching goal balances and category plans; Pockit
            downloads a backup first.
          </p>
          {!!positiveCredit && (
            <label className="field">
              <span>How does Waypoint show positive credit balances?</span>
              <select
                value={
                  options.creditPositiveMeansOwed === undefined
                    ? ''
                    : options.creditPositiveMeansOwed
                      ? 'owed'
                      : 'credit'
                }
                onChange={(event) =>
                  setOption({
                    creditPositiveMeansOwed:
                      event.target.value === 'owed'
                        ? true
                        : event.target.value === 'credit'
                          ? false
                          : undefined,
                  })
                }
              >
                <option value="">Choose after checking Waypoint</option>
                <option value="owed">A positive number is money owed</option>
                <option value="credit">A positive number is a credit balance</option>
              </select>
            </label>
          )}
          {!!missingAccountDate && (
            <label className="field">
              <span>Balance date for accounts without “Last Updated”</span>
              <input
                type="date"
                value={options.accountAsOfDate}
                onChange={(event) => setOption({ accountAsOfDate: event.target.value })}
              />
              <small>
                Check this against the export. Pockit cannot know an omitted snapshot date.
              </small>
            </label>
          )}
          {archive.transactions.length > 0 && (
            <label className="check-line">
              <input
                type="checkbox"
                checked={options.includePossibleDuplicates}
                onChange={(event) => setOption({ includePossibleDuplicates: event.target.checked })}
              />{' '}
              Include transactions that look identical to existing Pockit entries
            </label>
          )}
          {!options.cadConfirmed && (
            <p className="soft-note">Confirm CAD to see the mapped preview.</p>
          )}
          {preview?.error && (
            <p className="form-message" role="alert">
              {preview.error} Nothing has been imported.
            </p>
          )}
          {preview?.result && (
            <>
              <div className="waypoint-counts" role="group" aria-label="Import counts">
                <div>
                  <strong>{preview.result.counts.categories}</strong>
                  <span>new categories</span>
                </div>
                <div>
                  <strong>{preview.result.counts.goals}</strong>
                  <span>new goals</span>
                </div>
                <div>
                  <strong>{preview.result.counts.accounts}</strong>
                  <span>new accounts</span>
                </div>
                <div>
                  <strong>{preview.result.counts.transactions}</strong>
                  <span>new transactions</span>
                </div>
              </div>
              <p className="waypoint-meta">
                {preview.result.counts.matched} existing records matched ·{' '}
                {preview.result.counts.duplicates} duplicate or possible duplicate transactions
                skipped
              </p>
              {transactionMonths.length > 0 && (
                <p className="soft-note" role="status">
                  Transaction history in this ZIP: {monthLabel(transactionMonths[0] as MonthKey)}
                  {transactionMonths.length > 1
                    ? ` through ${monthLabel(transactionMonths.at(-1)! as MonthKey)}`
                    : ''}{' '}
                  · {transactionMonths.length} month{transactionMonths.length === 1 ? '' : 's'}.
                  Only months present in the ZIP can be imported.
                </p>
              )}
              {archive.budgets.find((row) => row.Category === 'Monthly Income') && (
                <p className="waypoint-meta">
                  Waypoint monthly income plan:{' '}
                  {money(
                    Number(
                      archive.budgets
                        .find((row) => row.Category === 'Monthly Income')
                        ?.['Budget Amount']?.replace(/[$,]/g, '') || 0,
                    ),
                  )}
                  . This does not set a payday or invent paycheques.
                </p>
              )}
              {preview.result.changes.length > 0 && (
                <details className="waypoint-detail" open>
                  <summary>
                    Review {preview.result.changes.length} changes to existing values
                  </summary>
                  <ul>
                    {preview.result.changes.slice(0, 30).map((change, index) => (
                      <li key={`${index}-${change}`}>{change}</li>
                    ))}
                  </ul>
                  {preview.result.changes.length > 30 && (
                    <small>Showing the first 30 changes.</small>
                  )}
                </details>
              )}
              {preview.result.newRecords.length > 0 && (
                <details className="waypoint-detail">
                  <summary>
                    Review {preview.result.newRecords.length} new categories, goals, and accounts
                  </summary>
                  <ul>
                    {preview.result.newRecords.slice(0, 30).map((item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                  {preview.result.newRecords.length > 30 && (
                    <small>Showing the first 30 records.</small>
                  )}
                </details>
              )}
              {preview.result.skippedTransactions.length > 0 && (
                <details className="waypoint-detail">
                  <summary>
                    Review {preview.result.skippedTransactions.length} skipped transactions
                  </summary>
                  <ul>
                    {preview.result.skippedTransactions.slice(0, 30).map((item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                  {preview.result.skippedTransactions.length > 30 && (
                    <small>Showing the first 30 skipped transactions.</small>
                  )}
                </details>
              )}
              {!!preview.result.notes.length && (
                <ul className="waypoint-notes">
                  {preview.result.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
              <button
                className="primary-button compact"
                onClick={() => {
                  try {
                    // Recheck against the latest state before saving, then keep a rollback copy.
                    importWaypoint(archive, data, options)
                    downloadJSON(data, `pockit-before-waypoint-${todayISO()}.json`)
                    update((current) => importWaypoint(archive, current, options).data)
                    setMessage(
                      'Waypoint data imported. Your previous Pockit budget was downloaded as a backup. Open Budget, Goals, Activity, and Compare to review it.',
                    )
                    setArchive(null)
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : 'Import failed. No changes were saved.',
                    )
                  }
                }}
              >
                <Icon name="Check" size={17} /> Download backup and import
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
