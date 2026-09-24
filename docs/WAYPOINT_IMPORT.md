# Import a Waypoint export

Pockit accepts Waypoint's five-file ZIP export in **More → Move from Waypoint**. The ZIP is read in your browser. Pockit does not upload the archive itself; after you apply the import, the mapped records are saved to your Pockit account through the usual private budget sync.

## Steps

1. In Waypoint, export your data as a ZIP. Keep the original ZIP somewhere safe.
2. Open Pockit, sign in, finish Pockit's short initial setup if needed, and open **More**. You can skip the optional goal choices and numbers during setup; the ZIP will supply those. Pockit still asks about your pay schedule because Waypoint only exports a monthly income plan, not a pay frequency.
3. Under **Move from Waypoint**, choose the ZIP. Pockit expects `transactions.csv`, `budgets.csv`, `categories.csv`, `goals.csv`, and `accounts.csv` inside it. Do not extract or edit them first.
4. Review the row counts. Confirm that the export amounts are **CAD**. Waypoint's sample ZIP does not include a currency column, so Pockit cannot verify this automatically.
5. Choose the month from which Waypoint's **current** budget allocations should apply. Waypoint's export does not contain an allocation history for every past month.
6. Choose how matching Pockit categories, goals, and accounts are handled. **Use Waypoint values** applies the exported values; **Keep existing Pockit values** imports only missing records. Existing Pockit IDs stay in place so linked activity keeps working.
7. If credit accounts are in the ZIP and their balances are positive, check how Waypoint presents them and choose whether a positive number means **money owed** or a **credit balance**. If an account has no “Last Updated” value, supply the date of its balance snapshot.
8. Review the import counts and notes. If Pockit reports an unsupported row or column, nothing is imported. Keep the ZIP and resolve the mismatch before retrying.
9. Select **Download backup and import**. Pockit downloads your current JSON backup before it changes your budget. Check Budget, Goals, Activity, Calendar, and Compare afterward.

If you need to reverse the import, open **More → Restore a backup** and choose the `pockit-before-waypoint-YYYY-MM-DD.json` file that was downloaded. Restoring replaces the current Pockit budget, so back up any edits made since the import first.

## What Pockit maps

| Waypoint CSV       | Pockit result                                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `budgets.csv`      | Category amounts, recurrence, payment day, and monthly income **plan**. The paycheque amount and frequency are separate settings and are not guessed from the monthly total.                                          |
| `categories.csv`   | Names, groups, icons, and colours. Icons without a Pockit equivalent display a fallback symbol.                                                                                                                       |
| `goals.csv`        | Savings and debt balances, targets, planned monthly contributions, interest, minimum payments, target dates, and descriptions. Exported contribution totals are kept as snapshot details, not invented dated history. |
| `accounts.csv`     | Account identity, bank name, last four digits, type, balance snapshot, available balance, credit limit, and connection label. This does **not** create a live bank connection in Pockit.                              |
| `transactions.csv` | Date, description, signed amount and type, category, group, account, tags, note, and “Excluded from Budget.” Excluded expenses remain in actual spending and Compare; they do not use a category allocation.          |

The importer identifies categories by group and name. It preserves repeated identical transaction rows within one export, while recognizing those same rows on a later import. Transactions that resemble manually entered Pockit entries are skipped by default; the preview shows how many. You can include those possible duplicates when you know they are distinct transactions.

Editing an imported transaction updates the shared activity data used by Home, Budget, Calendar, and Compare. You can link a transaction to a goal or bill in Activity. For a historical Waypoint transaction already included in an imported goal balance, leave **Already included in the imported goal balance** checked; that adds dated history without counting the amount twice. Later changes to its amount update the goal by the difference.

## Limits to review

- A new or nearly empty Waypoint export may have **zero transactions and zero accounts**. Pockit does not create spending history, bank balances, or a live connection that the export did not contain.
- Waypoint's CSV has no stable transaction or goal IDs. Pockit can recognize identical rows and matching names, but an edited transaction or renamed goal in a later Waypoint export may need manual review. Keep the original ZIP and Pockit backup.
- A category payment day becomes a **budget date** in Calendar and Home, not a confirmed bill or payment. Add a bill in Calendar if you want payment tracking and bill reminders.
- Waypoint's goal snapshot does not identify which transaction rows created the balance. Link historical activity yourself if you want a dated goal history.
- A blank debt interest rate remains **unknown**. Pockit asks you to enter it before showing payoff dates or saving a debt payoff plan.
- For account balances, Pockit treats the snapshot as covering transactions through the end of its stated date. If Waypoint's balance was taken during that day, reconcile the account after importing.
- For an account-linked transfer, Pockit interprets a positive exported amount as incoming and a negative amount as outgoing. Check this convention against your exported activity before relying on account estimates.
- Only supported columns, record types, recurrence values, and valid amounts are accepted. The importer stops rather than silently dropping data from a changed export format.
- If a matching Pockit category uses a different recurrence or a percentage/no-target rollover, **Use Waypoint values** stops. Choose **Keep existing Pockit values**, or adjust that category in Budget before retrying; otherwise its monthly allocation could be wrong.
- Large archives can exceed the current browser backup size. Pockit stops before changing your budget if the combined data would be too large.

The import is designed to preserve what the ZIP actually says. It cannot reconstruct data that Waypoint did not export or verify a currency that is absent from the file.
