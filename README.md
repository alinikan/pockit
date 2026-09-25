# Pockit

<img src="public/icon-192.png" alt="Pockit app icon" width="72" />

**A quieter way to see where your money goes and decide what comes next.** Pockit is a budget planner built for an iPhone Home Screen, with a responsive desktop view for Mac and Windows. It combines day-to-day spending, monthly plans, bills, savings, and debt in one place.

[Open Pockit](https://pockit-budget.vercel.app)

## A look inside

These screenshots use Pockit's preview mode and sample data.

<img src="docs/media/pockit-home-phone.png" alt="Pockit Home on an iPhone-sized screen" width="300" />

![Pockit Home on a desktop screen](docs/media/pockit-home-desktop.png)

## The experience

Pockit starts with a short setup about pay, housing, spending, savings, and debt. Its first plan uses clearly marked 2026 Vancouver examples where local figures are available; the user can enter actual housing costs and change every category. Pockit shows when the draft costs more than expected pay instead of silently reducing bills. [How starter amounts are chosen](docs/STARTER_BUDGET.md). If someone leaves during setup, their progress is saved to their account.

| Area         | What it helps you do                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Home**     | See your monthly plan, a next-paycheque estimate, bills, and categories needing attention. Reorder or hide sections.   |
| **Activity** | Add and split transactions, record refunds, search by tags, and review CSV imports and suspected duplicates.           |
| **Budget**   | Set allocations, cover an overage, prepare for irregular bills, and choose fresh or rollover categories.               |
| **Calendar** | Set a real payday, see exactly which months have extra cheques, and fill in missing regular bill dates.                |
| **Goals**    | Follow savings and debts, record contributions or withdrawals, choose a payoff order, and test What-if scenarios.      |
| **Compare**  | Compare months and categories side by side, inspect merchants behind a change, and check incomplete months.            |
| **More**     | Change appearance, edit merchant category rules, manage accounts and passkeys, import a Waypoint ZIP, and export data. |

Pockit Insights answers a small set of guided questions using the numbers you enter. It explains when a question is outside that scope. It does not send financial data to a language model or require a paid AI service.

## Details that matter

- **Built for a phone:** an installable web app with customizable bottom tabs, four colour palettes in dark and light modes, a circular appearance switch on supported browsers, large touch targets, reduced-motion support, and charts that can be explored by touch.
- **Quick to navigate:** a search control opens pages and common actions. On a Mac or Windows keyboard, press ⌘K or Ctrl+K.
- **Clear about estimates:** paycheque, savings, and debt projections show what the current plan implies. They are not a bank balance or a promise of a payoff date.
- **Pay dates that add up:** a weekly or biweekly anchor counts the actual dates in each month; twice-monthly and monthly schedules respect month ends. Until a date is set, Pockit labels the monthly figure as an average.
- **Safer edits across devices:** saves show their cloud status. Independent edits to different records or settings can be combined after a conflict. Overlapping edits require a choice, with a download available first.
- **Connected actions:** recording a goal contribution or bill payment can create the matching Activity entry, so progress and spending tell the same story. Starter savings and debt categories follow goal payment amounts until a user chooses their own category amount.
- **Carryover without duplicate entries:** categories set to carry forward calculate each month's available amount from earlier plans and recorded transactions. Editing an earlier item updates later balances.
- **Move an existing budget:** import a full Waypoint ZIP with a review step, duplicate checks, and a downloaded Pockit backup. Budget dates remain distinct from confirmed bills. See the [Waypoint import guide](docs/WAYPOINT_IMPORT.md).
- **CAD first:** the app plans and displays money in Canadian dollars. There is no currency conversion or automatic bank feed.
- **Help on demand:** optional guides and contextual explanations describe what each view means, with examples.
- **Private accounts:** email/password sign-in, optional passkeys, and per-user access rules in Supabase. The browser and installed app persist a signed-in session across ordinary closes; a signed-in device can keep a pending copy while offline and sync it later.

## How it was built

Pockit uses **React, TypeScript, and Vite** for the app; custom CSS, SVG, and Lucide for the interface; **Supabase Auth and Postgres** for accounts and saved budgets; and **Vercel Functions** for account emails and optional bill reminders. Receipt text recognition runs on the device with Tesseract.js. The project has calculation and interaction tests in **Vitest** and browser layout tests in **Playwright**.

The repository is organized by responsibility: `src/screens` contains the main views, `src/components` holds shared UI, `src/lib` contains finance and storage logic, `server` and `api` contain server-side features, and `supabase` contains database setup. The app's design and code are original; Waypoint Budget Planner was one source of product inspiration, and Pockit is not affiliated with Waypoint Budget Inc.

## Current scope

Pockit supports manual entry, reviewed CSV imports, and a Waypoint ZIP import. **It does not connect directly to a bank yet.** It also does not combine multiple people's finances into one shared budget or convert currencies. The installed app needs a connection for sign-in and cloud sync; a saved device copy can be available offline, but browser storage can be cleared. JSON export provides an additional backup.

This is an independent project under active development. For local development, deployment, and service configuration, see the [maintainer guide](docs/MAINTAINER_GUIDE.md).
