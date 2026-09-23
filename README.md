# Pockit

Pockit is a mobile-first budget planner for people who want to understand their money without living in a spreadsheet. It is an installable web app: open it in Safari on an iPhone, add it to the Home Screen, and use it with an app-like layout. It also works in desktop browsers.

The product was inspired by the clarity of modern budgeting apps, including Waypoint Budget Planner. Pockit has its own interface and implementation and is not affiliated with Waypoint Budget Inc.

## What is here

- **Guided setup:** reason for budgeting, take-home pay and frequency, housing, transport, spending categories, savings goals, debts, goal projections, and Smart Features. Draft answers and the current step save to Supabase so a returning user can resume.
- **Home:** monthly income, spending, remaining money, category breakdown, overspent categories, upcoming bills, and income compared with expenses.
- **Activity:** manual income, expense, and transfer transactions; search, type and category filters; six sort modes; edit and delete; merchant-based category suggestions; on-device receipt text recognition.
- **Budget:** monthly allocations, a colour breakdown, category groups, weekly/biweekly/twice-monthly/monthly amounts, payment day, notes, one-month overrides, fresh or rollover balances, fixed or percentage contributions, and manual funding.
- **Calendar:** transaction and bill markers, daily details, bill reminders, paid status, and the next seven days.
- **Goals:** savings and debt balances, interest-aware dates, progress history, and a debt plan with highest-rate, smallest-balance, or custom order plus extra monthly payments.
- **Money Coach:** local, data-based answers about spending, goals, bills, income, and month comparisons. It does **not** call a paid AI API.
- **Settings:** dark/light theme, Smart Features, profile preferences, CAD/USD display, JSON export, password update, account deletion, and sign-out.
- **Account emails:** branded deletion receipts and owner alerts for confirmed signups, with a private notification outbox and retry job.
- **Private accounts:** Supabase email/password authentication and one JSON budget document per user protected by Postgres row-level security (RLS).
- **Preview mode:** sample data stored only in the current browser, so the interface can be explored before cloud setup.

## What Pockit does not do yet

Pockit does not connect to bank accounts, send push notifications, share a budget between accounts, convert currencies, or use a language model. Transactions and goal payments are entered manually. Recording a goal payment does not automatically create an Activity transaction; add one there if you want it reflected in spending. Bill reminders do not create transactions automatically. Receipt recognition extracts likely merchant and total from an image on the device; review the values before saving. The first scan downloads Tesseract's recognition data. Goal dates and debt plans are estimates based on fixed monthly payments and rates; they do not include fees or future rate changes.

The installed web app needs a connection to sign in and sync cloud data. Its shell can load from cache after the first visit, but it is not an offline-first budgeting system.

## Technology

| Layer                   | Choice                                 | Reason                                                                                     |
| ----------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| UI                      | React 19, TypeScript, Vite             | Small static deployment and fast local development                                         |
| Styling                 | Custom CSS and Lucide icons            | App-like design without a component framework                                              |
| Authentication and data | Supabase Auth + Postgres JSONB         | Managed accounts and private per-user data                                                 |
| Receipt reading         | Tesseract.js                           | On-device OCR, no paid API or receipt upload                                               |
| Charts                  | SVG and CSS                            | Lightweight, responsive visuals                                                            |
| Hosting                 | Vercel static deployment and Functions | GitHub-connected deployment, private account/email endpoints, and a free `.vercel.app` URL |
| Tests                   | Vitest                                 | Budget and date edge-case coverage                                                         |

The browser receives only a **Supabase publishable key**. It is designed to be public. RLS in `supabase/schema.sql` is what protects each user's data. Never put a Supabase secret or service-role key, a Resend key, or an SMTP password in `VITE_` variables or Git.

## Requirements

- Node.js **22 or newer** and npm (Node 22 LTS is a good choice).
- Git for publishing to GitHub.
- A Supabase account for real sign-up and sync.
- A Vercel account for deployment.
- An SMTP sender such as Resend or Brevo for confirmation and password-reset emails to users outside your Supabase team.

### Run locally on macOS

1. Install Node.js 22+ from [nodejs.org](https://nodejs.org/) or a package manager.
2. Open Terminal, change into this repository, and run:

   ```bash
   npm ci
   cp .env.example .env.local
   ```

3. Replace the two placeholders in `.env.local` with your Supabase project URL and publishable key. For a no-account preview, leave the placeholders and use **Preview Pockit**. This file is for local development; Vercel needs the same two values entered in its own project environment-variable settings. `npm run dev` serves only the browser UI; Vercel's `/api` functions run after deployment or under `vercel dev`. See [account email setup](ACCOUNT_EMAILS.md) for the additional **server-only** Vercel variables. No AI or SMTP password is needed in `.env.local`.
4. Run `npm run dev`. Open the local URL Vite prints, normally `http://localhost:5173`.

### Run locally on Windows

1. Install Node.js 22+ from [nodejs.org](https://nodejs.org/) and Git for Windows.
2. Open PowerShell in this repository and run:

   ```powershell
   npm ci
   Copy-Item .env.example .env.local
   ```

3. Fill in `.env.local`, then run `npm run dev` and open the printed URL.

On either system, run `npm test` for the unit tests and `npm run build` to type-check and make the production `dist/` folder. `npm run preview` serves the built version locally. Use `npm run format` before committing code changes; `npm run format:check` verifies formatting without changing files.

## Cloud setup, in order

### 1. Create the GitHub repository

Create an empty GitHub repository, for example `pockit`. Do not add a generated README or `.gitignore` in GitHub because this project includes both. From this folder:

```bash
git init
git add .
git commit -m "Build Pockit budget planner"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/pockit.git
git push -u origin main
```

Replace `YOUR_USERNAME`. The `.gitignore` excludes `.env.local`, `node_modules/`, and `dist/`. Check `git status` before pushing and never commit credentials.

### 2. Create the Supabase project and database

1. In [Supabase](https://supabase.com/dashboard), create a **Free** project. Save its database password in a password manager. Choose a nearby region.
2. Wait until the project is ready. Open **SQL Editor** → **New query**. Paste the full contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It creates `public.pockit_data`, enables RLS, and limits each user to their own row.
   Then run [`supabase/notifications.sql`](supabase/notifications.sql) in a second new query to enable account deletion receipts and owner signup alerts.
3. Open the project's **Connect** panel or **Settings → API Keys**. Copy the **Project URL** and the **publishable key** (`sb_publishable_...`). Do **not** use the secret key.
4. Create `.env.local` in the repository root:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

5. Open **Authentication → Providers → Email** and keep email/password sign-up enabled. Keep email confirmation enabled for normal use. The SMTP step below is needed before people outside the Supabase project team can receive those emails.
6. In **Authentication → URL Configuration**, set **Site URL** to the final Vercel production URL, such as `https://pockit-example.vercel.app`. Add redirect URLs for that exact URL and local development, for example `http://localhost:5173/**` and `http://127.0.0.1:5173/**`. Add a preview URL pattern only if you will test sign-up on Vercel preview deployments.

The single JSONB row is deliberate for a tiny personal project. If Pockit grows to many users or needs cross-device conflict resolution, migrate transactions, goals, and categories into separate relational tables.

### 3. Configure email delivery

Supabase's default mailer currently sends only to approved Supabase project-team addresses and is limited to about two messages per hour. It is for testing, not normal user sign-up. Pockit needs custom SMTP for email confirmations and password resets.

**Resend when you own a domain:** Resend's free email allowance is currently 3,000 emails/month and 100/day, which easily covers a few users. The sending domain is separate from the free `.vercel.app` web address; you must own and verify a domain for general delivery. Domain registration may cost money.

1. Create a [Resend](https://resend.com/) account. In **Domains**, add a domain or sending subdomain you own, such as `auth.example.com`.
2. At the domain registrar or DNS host, add the DNS records Resend shows (typically SPF and DKIM; add DMARC as recommended). Wait for **Verified** in Resend.
3. In Resend, create an API key with sending permission. Copy it once and store it securely.
4. In Supabase, open **Authentication → SMTP Settings** (the dashboard label may be **Custom SMTP**). Enable custom SMTP and enter:

   | Field        | Value                                                  |
   | ------------ | ------------------------------------------------------ |
   | Sender email | `no-reply@auth.example.com` using your verified domain |
   | Sender name  | `Pockit`                                               |
   | Host         | `smtp.resend.com`                                      |
   | Port         | `465`                                                  |
   | Username     | `resend`                                               |
   | Password     | Your Resend API key                                    |

5. Save, then create one test account in Pockit and confirm the email arrives. Check the spam folder and Resend logs if it does not. Keep the Resend key **only in Supabase**, never in `.env.local` or Vercel.

**No domain and strict $0 budget — Brevo:** [Brevo's free plan](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) currently includes 300 sends/day. You can verify an individual sender email, including a free mailbox address. Brevo may replace a free sender's From address with a Brevo address to meet mailbox-provider rules. Transactional SMTP may need account activation, so test this before sharing Pockit.

1. Create a free Brevo account. A dedicated mailbox such as `your-pockit-mailbox@gmail.com` is easier to manage than a personal inbox. You do not need to buy a domain for this option.
2. In Brevo, open **Settings → Senders, Domains, IPs → Senders → Add a sender**. Enter **From name: Pockit** and **From email:** your real mailbox address. Save, then enter the verification code Brevo sends to that mailbox.
3. Open **Settings → SMTP & API → SMTP**. Create an **SMTP key** named `Pockit Supabase`. Copy it into a password manager now; Brevo does not show the whole key again. Also copy the **SMTP login** shown on this page. It might differ from the email used to sign into Brevo.
4. In Supabase, open **Authentication → SMTP Settings** (sometimes **Custom SMTP**) and enable it. Enter:

   | Field        | Value                                                          |
   | ------------ | -------------------------------------------------------------- |
   | Sender email | The verified From email from step 2                            |
   | Sender name  | `Pockit`                                                       |
   | Host         | `smtp-relay.brevo.com`                                         |
   | Port         | `587`                                                          |
   | Username     | The exact SMTP login Brevo shows                               |
   | Password     | The **SMTP key**, not a Brevo API key or your account password |

5. Save in Supabase. Keep **Authentication → Providers → Email → Confirm Email** enabled. Sign up for Pockit with a test mailbox other than your sender mailbox. Open the confirmation message and check that its link returns to the deployed app. Then try **Forgot password?** from Pockit's sign-in screen and complete the password change.
6. If Supabase reports `Email address not authorized`, custom SMTP was not enabled or saved successfully. If Brevo reports `450 Your SMTP account is not yet activated`, [request transactional activation from Brevo support](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP). Check **Brevo → Transactional → Logs** and the recipient's spam folder for delivery problems.

**Alternative with an ordinary Gmail address:** You can use a dedicated Gmail account as Supabase's SMTP sender for a very small private app. Turn on Google 2-Step Verification, create a Google App Password for Pockit, and enter `smtp.gmail.com`, port `587`, your full Gmail address as both the Supabase sender address and SMTP username, and the 16-character App Password as the SMTP password. Keep that password only in Supabase. Google may reject automated mail or disable app passwords for some account types, so test both signup and password reset before inviting others. See [Google App Passwords](https://support.google.com/accounts/answer/185833) and [Supabase's Google SMTP notes](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y).

Neither of these options requires a custom web domain. Your free `.vercel.app` address remains Pockit's Site URL. Do not add the SMTP password to `.env.local` or Vercel environment variables.

After SMTP works, replace Supabase's default auth emails with the four ready-to-paste [Pockit email templates](emails/README.md). On new Supabase Free projects, custom SMTP is required for template customization.

For a short private test with no outgoing email, you can temporarily turn **Confirm Email** off in **Authentication → Providers → Email**, let the intended users create their accounts, then turn **Confirm Email** back on and turn **Allow new users to sign up** off in **Authentication → General Configuration**. This bypasses ownership checks for those initial email addresses and leaves password-reset email unavailable, so use it only with people you know and switch to SMTP before relying on the app. The public sign-up button will still be visible even after new sign-ups are disabled; it will reject new registrations.

### 4. Deploy on Vercel

1. In [Vercel](https://vercel.com/), choose **Add New → Project** and import the GitHub repository.
2. Select **Vite** as the framework preset. If the repository root is this folder, leave Root Directory as `./`. The build command is `npm run build`; output directory is `dist`.
3. Before clicking Deploy, add these **Environment Variables** for Production (and Preview if needed):

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

4. Deploy. Open the generated `https://...vercel.app` URL. Put that **exact** URL into Supabase's **Site URL** and redirect allow-list if you did not know it earlier. Redeploy if you added or changed Vercel environment variables after the first build.
5. Sign up with one email, confirm it, finish onboarding, add a test transaction, sign out, sign in, and confirm the transaction remains. Test a second account to confirm it sees its own empty setup rather than the first account's budget.

### 4a. Enable deletion receipts and owner alerts

Follow the exact [account email setup guide](ACCOUNT_EMAILS.md) to add the private Supabase key and Brevo API key to Vercel, configure the immediate database webhook, and test signup and deletion. The new `/api/delete-account` route will refuse to delete an account until the private notification outbox is installed. The owner receives only an email address and confirmation time, never budget contents.

Vercel Hobby is free for **personal, non-commercial** use. Check its terms and upgrade if the project becomes commercial. Supabase Free currently includes two active projects and may pause a project after one week of inactivity; a paused project must be restored in Supabase before sign-in works. Free-tier limits can change.

### 5. Install on an iPhone

1. Open the production `https://...vercel.app` URL in **Safari**.
2. Tap the **Share** icon and choose **Add to Home Screen**.
3. Name it **Pockit** and tap **Add**. Launch it from the Home Screen, then sign in.

This is a progressive web app (PWA), not an App Store binary. No Apple Developer account is needed for Home Screen installation. Publishing to the App Store later would require a separate native wrapper and Apple's review process.

## How the calculations work

- **Monthly income:** weekly pay × 52/12, every-two-weeks pay × 26/12, twice-monthly pay × 2, or monthly pay × 1. If the selected month has income transactions, their total replaces the estimate.
- **Spent:** only expense transactions count. Transfers are excluded.
- **Remaining:** monthly income minus spent.
- **Allocated:** the sum of category amounts for the selected month. Weekly and biweekly category amounts are converted to monthly estimates in the same way as pay.
- **Fresh category:** planned amount minus expenses for that month.
- **Rollover category:** contributions minus expenses, accumulated from the category start month. Manual funding counts linked income or transfer transactions; automatic funding uses the planned contribution.
- **Debt and savings dates:** simulated month by month with the entered annual rate divided by 12. A debt whose payment does not cover interest has no payoff date. Projections stop at 600 months rather than displaying a misleading date.
- **Debt plan:** minimum payments are applied first; remaining monthly capacity goes to debts in the chosen order. Freed payments move to the next debt. This is an estimate, not a lender statement.

## Repository layout

```text
public/              PWA manifest, service worker, icons
src/components/      Reusable UI, authentication, onboarding
src/lib/             Finance calculations, defaults, Supabase storage, tests
src/screens/         Home, Activity, Budget, Calendar, Goals, More, Coach
src/types.ts         Shared data types
src/styles.css       Dark and light design system, responsive layout
supabase/schema.sql  Private database table and RLS policies
supabase/notifications.sql  Private email outbox and account triggers
server/              Branded email templates and delivery/retry logic
api/                 Vercel account deletion, webhook, and retry endpoints
vercel.json           Daily retry schedule
ACCOUNT_EMAILS.md     Detailed setup and testing guide
```

## Testing and troubleshooting

Run `npm test` and `npm run build` before every deployment. The finance tests cover month and year boundaries, leap years, pay frequencies, category overrides, rollover, transfers, debt interest, payoff order, recurring charges, and receipt parsing.

| Symptom                                     | Check                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign-up says cloud setup is missing         | `.env.local` or Vercel variables must contain the project URL and publishable key; restart Vite after editing `.env.local`.                                              |
| Sign-up email never arrives                 | Custom SMTP, verified sender, Supabase email confirmation and redirect settings, sender logs, and spam folder.                                                           |
| “Could not load your budget”                | Run `supabase/schema.sql` in the correct project; confirm Data API access and the publishable key.                                                                       |
| Account deletion says it could not complete | Run `supabase/notifications.sql`, add all server-side Vercel variables from `ACCOUNT_EMAILS.md`, redeploy, and check Vercel logs.                                        |
| Owner or deletion email is missing          | Check `pockit_notifications` for a pending row, Vercel logs, Brevo transactional logs, sender verification, and the webhook secret. The daily cron retries pending rows. |
| Confirmation opens the wrong URL            | Set Supabase Site URL and allowed redirect URLs to the real production URL.                                                                                              |
| An installed iPhone app looks old           | Refresh it while online, then relaunch. The service worker caches the shell and updates from the network.                                                                |
| Receipt scan fails                          | Use a clear, well-lit image with a printed total; enter details manually if OCR cannot read it.                                                                          |
| A Supabase project is paused                | Restore it in the Supabase dashboard, or move to a paid tier if inactivity pauses are unacceptable.                                                                      |

## Privacy and cost notes

This app does not request banking credentials. Receipt images are read in the browser and are not stored in Supabase. Account data and budget data live in the Supabase project selected by the deployer. Exported JSON files contain financial information; store them privately. Supabase RLS restricts a signed-in user to their own row, and the `anon` role has no table access.

For 2–3 people using this as a personal, non-commercial app, Vercel Hobby + Supabase Free + an eligible free Brevo sender can remain at $0, subject to account activation and service limits. A custom domain for Resend, commercial Vercel use, higher usage, or a paid AI service would change that. The current coach and Smart Features require no AI subscription. Email delivery is best effort: outages and provider restrictions can delay or prevent delivery.

## Official references

- [Supabase React quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Vercel Git deployments](https://vercel.com/docs/git), [Hobby plan](https://vercel.com/docs/plans/hobby)
- [Resend SMTP](https://resend.com/changelog/smtp-service), [Resend pricing](https://resend.com/pricing)
- [Brevo sender verification](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [Brevo SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks), [deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [Brevo transactional email API](https://developers.brevo.com/reference/send-transac-email), [Vercel cron jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
