# Pockit's planning tools

These tools use the entries and balances saved in Pockit. They do not connect to a bank, move money, approve a payment, or use a paid AI service.

## Record purchases with fewer steps

In **Activity → Add transaction**, enter the amount, description, date, category, and account. **More details** contains goal and bill links, repeat schedules, tags, notes, projects, and receipt scanning.

- **Quick text entry** accepts formats such as `Coffee 6.50 yesterday`, `Groceries 42.10`, and `Ferry 80 2026-10-17`. It opens a reviewable transaction; it never saves automatically. Unsupported or ambiguous formats need manual correction.
- **Pin as quick entry**, inside More details, saves a merchant/category/account template. The amount is blank unless **Keep this amount in the template** is checked. Unpin templates in **More → Preferences → Pinned quick entries**.
- **Save & add another** records the current entry and starts a fresh one.
- An unfinished new entry is kept on that device. **Resume saved draft** restores it after leaving the tab or reopening Pockit. Drafts are scoped to the signed-in account, stay on that device, and are cleared when saved or explicitly signed out. If device storage fails, the form warns you to save before leaving.

## Look ahead by account

Open **Home → Next 60 days**. Choose an account and a 30-, 60-, or 90-day range.

The forecast starts with the account's checked balance, then applies entered future transactions, unpaid scheduled bills, explicitly recorded repeat schedules, subscriptions, and optionally expected pay. Transfers affect their two selected accounts without becoming expenses. The existing explicit bill link prevents its own scheduled bill appearing twice; this tool does not guess matches or link an expected payment to an actual one.

**Include expected pay** uses the existing payday pattern and primary spending account. If you have entered another income schedule for the same pay, switch this assumption off. **Optional everyday spending** spreads unused monthly allocations across remaining days in the primary spending account. It is off by default and may overlap other schedules, so use it only when appropriate. Investment accounts assume no market change.

The dashed graph shows daily end-of-day estimates. It does not know the order in which banks post payments, and a same-day paycheque might arrive after a debit. Hold and drag the graph to inspect a day; releasing your finger resets the inspection. Keyboard users can use the arrow keys and Escape.

**View scheduled items and try a change** lets you test a different date or amount. These changes only affect the preview; reset them to return to the saved schedules. They do not reschedule a payment at a bank or change the real bill.

Warnings identify missing paying accounts, stale checked balances, unreviewed imported entries, and possibly overlapping income assumptions. An event with no assigned account remains visible in the list but cannot affect a particular account balance.

## Check a purchase

Open **Home → Can I afford this?** and choose its amount, date, category, and the asset account that will cover it. This checks both category room and the lowest projected account amount after existing goal reservations. It does not simulate credit-card payment readiness.

The result says whether the purchase fits the entered plan. Use **Include expected pay** to see the result with or without future pay; the optional everyday spending assumption is available here too. Forecast-only date and amount experiments stay out of the purchase check. It is an estimate, particularly when future income or missing entries are involved. A category shortfall can be reviewed and moved from an eligible unspent category for that month. This changes allocations only; no purchase or transfer is created.

## Assign existing money to goals

Open **Goals → Assign existing money** (or **Manage** on an assigned goal).

One account can hold money for several goals. For example, a $1,000 savings account could have $600 assigned to emergencies, $300 to travel, and $100 still unassigned. Pockit prevents assigning the same current account money twice.

Saving assignments sets the goal's recorded balance to their total and records any adjustment in goal history. It does not create Activity entries or increase account balances. The review shows the old and new goal balance before saving. Linked contributions and purchases update their related assignments when an account is known. Check assignments after market changes, independent account transfers, or goal-only balance corrections; a warning identifies a mismatch instead of fabricating money.

The existing **Save money** and **Spend saved money** actions still record movements that already happened. Use **Assign existing money** for earmarking money already present, rather than recording a second transfer.

## Understand totals and comparisons

**Home → Explain my numbers** explains expected income, recorded income, expenses, allocations, and unallocated plan money. Its expandable list shows the month's entries. Account amounts include their checked date and goal reservations.

Compare's **What changed behind the totals?** shows purchase count, average purchase size, refund changes, and a large purchase to inspect. Its count and size effects are an arithmetic decomposition of the recorded net change, not a claim about why the user spent money. Empty, unconfirmed months are labelled as missing evidence rather than successful spending reductions.

## Keep a useful weekly review

Pockit Pulse keeps four checklist steps while you move between tabs: activity, account balances, upcoming dates, and the plan. Checking a step is your confirmation; Pockit does not secretly mark transactions or bills checked. Finish when all four are checked, or return later. **Review again** opens the checklist before the next weekly reminder.

Under **Confirm a complete month**, mark a past month complete only after checking that all purchases, refunds, and income have been entered. You can remove the label later. These confirmations enable **Budget → Suggestions from your spending** after at least three complete months.

Suggestions use the median category spending from the last 3–6 confirmed months, excluding project expenses. They appear only when the proposed monthly amount differs from the current limit by at least $10. Review each suggestion; it changes no budget automatically and is not a benchmark for what living costs should be.

## Trips and projects

Create a project in **More → Trips & projects**, set its overall spending budget and dates, and optionally link a savings goal. Select the project in a transaction's More details.

Recorded spending includes linked expenses minus refunds. Transfers and money saved toward the goal are shown separately. Upcoming cost estimates reduce the separate forward-looking figure. Once a cost is included in recorded Activity, check its **Already included** box so its estimate is no longer reserved a second time. Checking this box does not create or match a transaction.

Removing a project keeps its historical transactions. Change history can restore the project while its related records have not subsequently changed.

## Subscriptions and trials

Use **More → Subscriptions & trials** to enter the billing period, price, renewal, trial ending, and cancellation deadline. Editing the price retains the previous price for comparison. Costs are annualized at the entered prices.

Choose an existing bill if its schedule already represents that subscription. Otherwise, the subscription renewal can appear in the forecast using its selected account. Calendar shows renewal and decision dates. If existing push reminders are configured and enabled, they can notify you of these dates using a generic message containing no name or amount.

Pockit does not cancel a subscription or match its expected renewal with an Activity entry. After cancelling outside Pockit, remove the subscription here; the removal can be reviewed in Change history.

## Review an edit or restore it

Editing an older Activity entry shows its effects on accounts, linked goals, category availability, carryover, and bill status before saving. Related charts use the same saved records.

**More → Change history** retains up to 150 recent record changes with a 500 KB history budget. An edit can restore its affected records together only while those records still match its saved after-state. Unrelated newer edits remain intact. Restoring creates another history entry.

Large batches keep a summary instead of duplicating an entire import. Use the downloaded pre-import backup for that recovery. Older edits made before this feature was installed have no reconstructed history. History belongs to the same private budget and is included in JSON exports and cloud conflict handling.

## iPhone companion

The PWA still works on iPhone, Mac, and Windows. The optional native companion adds WidgetKit and App Intents; it requires its own Xcode signing and App Group setup. See [the iPhone companion guide](../native/Pockit/README.md).

There are no new environment variables or database migrations for these planning tools. New fields are optional additions inside the existing private budget document. Deploy the updated frontend and Vercel reminder function together.
