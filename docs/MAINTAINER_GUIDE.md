# Pockit maintainer guide

This guide covers local development, service setup, deployment, testing, and troubleshooting. Run terminal commands from the repository root unless a step says otherwise. The [project overview](../README.md) is written for people exploring Pockit.

Related guides: [account emails and alerts](ACCOUNT_EMAILS.md), [passkeys](PASSKEYS.md), [future bank connection](BANK_CONNECTION.md), and [authentication email templates](../emails/README.md).

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

3. Replace the Supabase placeholders in `.env.local` with your project URL and publishable key. Add `VITE_VAPID_PUBLIC_KEY` only if enabling browser reminders. For a no-account preview, leave the placeholders and use **Preview Pockit**. This file is for local development; Vercel needs browser values entered in its own project environment-variable settings. `npm run dev` serves only the browser UI; Vercel's `/api` functions run after deployment or under `vercel dev`. See [account email setup](ACCOUNT_EMAILS.md) for the additional **server-only** Vercel variables. No AI, SMTP, VAPID private, or Supabase secret key belongs in `.env.local`.
4. Run `npm run dev`. Open the local URL Vite prints, normally `http://localhost:5173`.

### Run locally on Windows

1. Install Node.js 22+ from [nodejs.org](https://nodejs.org/) and Git for Windows.
2. Open PowerShell in this repository and run:

   ```powershell
   npm ci
   Copy-Item .env.example .env.local
   ```

3. Fill in `.env.local`, then run `npm run dev` and open the printed URL.

On either system, run `npm test` for the unit and interaction tests and `npm run build` to type-check and make the production `dist/` folder. For the browser layout suite, run `npx playwright install chromium` once, then `npm run test:ui`. The browser suite starts its own local server, uses Preview mode, and needs no Supabase account. `npm run preview` serves the built version locally. Use `npm run format` before committing code changes; `npm run format:check` verifies formatting without changing files.

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
2. Wait until the project is ready. Open **SQL Editor** → **New query**. Paste the full contents of [`supabase/schema.sql`](../supabase/schema.sql) and click **Run**. It creates `public.pockit_data`, enables RLS, and installs the `pockit_save` function for revision-checked saves. **If Pockit is already deployed, rerun this updated file before deploying this version.** Then run [`supabase/notifications.sql`](../supabase/notifications.sql) in a second query for account emails. If you want push reminders, run [`supabase/push.sql`](../supabase/push.sql) in a third query.
3. Open the project's **Connect** panel or **Settings → API Keys**. Copy the **Project URL** and the **publishable key** (`sb_publishable_...`). Do **not** use the secret key.
4. Create `.env.local` in the repository root:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

5. Open **Authentication → Providers → Email** and keep email/password sign-up enabled. Keep email confirmation enabled for normal use. The SMTP step below is needed before people outside the Supabase project team can receive those emails.
6. In **Authentication → URL Configuration**, set **Site URL** to the final Vercel production URL, such as `https://pockit-example.vercel.app`. Add redirect URLs for that exact URL and local development, for example `http://localhost:5173/**` and `http://127.0.0.1:5173/**`. Add a preview URL pattern only if you will test sign-up on Vercel preview deployments.

The single JSONB row is deliberate for a tiny personal project. Revision checks prevent silent overwrites. The client keeps a common base snapshot and can offer a three-way merge when different records changed on different devices. Overlapping edits still need a person to choose a copy. For larger use, consider relational tables and server-side record revisions.

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

After SMTP works, replace Supabase's default auth emails with the four ready-to-paste [Pockit email templates](../emails/README.md). On new Supabase Free projects, custom SMTP is required for template customization.

For a short private test with no outgoing email, you can temporarily turn **Confirm Email** off in **Authentication → Providers → Email**, let the intended users create their accounts, then turn **Confirm Email** back on and turn **Allow new users to sign up** off in **Authentication → General Configuration**. This bypasses ownership checks for those initial email addresses and leaves password-reset email unavailable, so use it only with people you know and switch to SMTP before relying on the app. The public sign-up button will still be visible even after new sign-ups are disabled; it will reject new registrations.

### 4. Deploy on Vercel

1. In [Vercel](https://vercel.com/), choose **Add New → Project** and import the GitHub repository.
2. Select **Vite** as the framework preset. If the repository root is this folder, leave Root Directory as `./`. The build command is `npm run build`; output directory is `dist`.
3. Before clicking Deploy, add these **Environment Variables** for Production (and Preview if needed):

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

   If enabling push reminders, also add `VITE_VAPID_PUBLIC_KEY` using the public key from step 4b below. Vercel's **Import .env** is optional; manual entry makes it easier to check each name. Never import a file containing secret server keys as `VITE_` values. Put server keys in separate Vercel environment variables as described in the account email and push setup sections.

4. Deploy. Open the generated `https://...vercel.app` URL. Put that **exact** URL into Supabase's **Site URL** and redirect allow-list if you did not know it earlier. Redeploy if you added or changed Vercel environment variables after the first build.
5. Sign up with one email, confirm it, finish onboarding, add a test transaction, sign out, sign in, and confirm the transaction remains. Test a second account to confirm it sees its own empty setup rather than the first account's budget.

### 4a. Enable deletion receipts and owner alerts

Follow the exact [account email setup guide](ACCOUNT_EMAILS.md) to add the private Supabase key and Brevo API key to Vercel, configure the immediate database webhook, and test signup and deletion. The new `/api/delete-account` route will refuse to delete an account until the private notification outbox is installed. The owner receives only an email address and confirmation time, never budget contents.

### 4b. Enable optional bill push reminders

1. Run [`supabase/push.sql`](../supabase/push.sql) in **Supabase → SQL Editor → New query**. It creates a private per-device subscription table. Confirm the query succeeds.
2. In this repository after `npm ci`, run `npx web-push generate-vapid-keys --json` in Terminal or PowerShell. Copy the `publicKey` and `privateKey` into a password manager. Use one stable key pair; changing it requires users to turn reminders off and on again.
3. In **Vercel → Pockit project → Settings → Environment Variables**, add the following for **Production**:

   | Name                    | Value                                | Visibility                     |
   | ----------------------- | ------------------------------------ | ------------------------------ |
   | `VITE_VAPID_PUBLIC_KEY` | Generated `publicKey`                | Public browser value           |
   | `VAPID_PUBLIC_KEY`      | The same `publicKey`                 | Server value, safe to disclose |
   | `VAPID_PRIVATE_KEY`     | Generated `privateKey`               | **Secret; server only**        |
   | `VAPID_SUBJECT`         | `mailto:your-real-email@example.com` | Server contact address         |

   The daily function also uses `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `CRON_SECRET` from [account email setup](ACCOUNT_EMAILS.md). Add them if they are not already present. Do not prefix private keys with `VITE_` and do not commit them.

4. Redeploy in **Vercel → Deployments → latest deployment → Redeploy** so the browser receives the public key and the scheduled function receives the server values. In **Settings → Cron Jobs**, confirm `/api/bill-reminders` appears. Vercel Hobby runs this check once daily, approximately within the scheduled UTC hour.
5. On an iPhone, open the deployed site in Safari, **Share → Add to Home Screen**, then launch Pockit from the new icon. Sign in, open **More → Bill reminders → Turn on**, and allow notifications in the iOS prompt. Add a bill due today in Calendar. On another device, enable reminders separately if desired. A private, generic message is sent when an unpaid bill is due, and tapping it opens Calendar. Check Vercel function logs if it does not arrive; delivery also depends on iPhone notification and Focus settings.

The public and private VAPID keys are not Supabase API keys. `.env.local` may contain the public VAPID value, but the local Vite app does not register push; use the deployed app to test reminders. Notifications contain no bill name, amount, or budget figures.

Vercel Hobby is free for **personal, non-commercial** use. Check its terms and upgrade if the project becomes commercial. Supabase Free currently includes two active projects and may pause a project after one week of inactivity; a paused project must be restored in Supabase before sign-in works. Free-tier limits can change.

### 5. Install on an iPhone

1. Open the production `https://...vercel.app` URL in **Safari**.
2. Tap the **Share** icon and choose **Add to Home Screen**.
3. Name it **Pockit** and tap **Add**. Launch it from the Home Screen, then sign in.

On MacBook or Windows, use the same Vercel URL in a current browser. Pockit's responsive navigation changes for larger screens. iPhone Web Push works from the Home Screen app; on desktop, browser support and permission rules vary.

This is a progressive web app (PWA), not an App Store binary. No Apple Developer account is needed for Home Screen installation. Publishing to the App Store later would require a separate native wrapper and Apple's review process.

## How the calculations work

- **Monthly income:** planned take-home pay is weekly pay × 52/12, every-two-weeks pay × 26/12, twice-monthly pay × 2, or monthly pay × 1. Recorded income appears separately and never replaces the plan.
- **Spent:** only expense transactions count. Transfers are excluded.
- **Remaining:** monthly income minus spent.
- **Allocated:** the sum of category amounts for the selected month. Weekly and biweekly category amounts are converted to monthly estimates in the same way as pay.
- **Fresh category:** planned amount minus expenses for that month.
- **Rollover category:** contributions minus expenses, accumulated from the category start month. Manual funding counts linked income or transfer transactions; automatic funding uses the planned contribution.
- **Debt and savings dates:** simulated month by month with the entered annual rate divided by 12. A debt whose payment does not cover interest has no payoff date. Projections stop at 600 months rather than displaying a misleading date.
- **Debt plan:** minimum payments are applied first; remaining monthly capacity goes to debts in the chosen order. Freed payments move to the next debt. This is an estimate, not a lender statement.
- **Compare:** months are independent columns, so you can compare any months or years. The first column is the baseline and the last is the endpoint for findings. Your chosen months and view stay in place while switching tabs during a visit. Spending includes expense transactions only; deleted or missing categories appear under Uncategorized so category totals still match overall spending. Income is labelled expected when no income transaction was entered. In Plan vs actual, a rollover category is flagged only when its accumulated balance is negative. Current and future months are marked as incomplete. A blank month means no expenses were entered, not necessarily that none happened.
- **Paycheque view:** uses the payday pattern you set and an optional manually entered starting amount. It adds later recorded income, subtracts later recorded expenses and unpaid bills before the next payday, then divides the remainder by days. It is an estimate, not a live bank balance.
- **What-if Lab:** previews a missed paycheque, one-time expense, rate rise, and recurring plan changes. Only a reviewed recurring change can be applied; extra debt and savings commitments create visible budget categories. No bank money moves. The unallocated amount is planned income minus allocations and hypothetical changes, not a bank balance.
- **Cross-device saving:** each successful write increases a database revision. A device with an older revision cannot silently replace a newer cloud copy. When a common base exists, non-overlapping edits can be combined; edits to the same record require choosing a copy. Pending edits live in that device's browser storage; the Saved indicator means the cloud write finished.
- **Manual accounts:** an account starts from a balance entered or reconciled by the user. Purchases lower account balance; income raises it; transfers move between accounts. Credit accounts store an amount owed as a negative balance. No bank balance is fetched automatically.
- **Irregular bill reserve:** quarterly and yearly reminders show an estimated monthly amount to set aside until next due. Users can link or create a budget category for that bill.

## Repository layout

```text
public/              PWA manifest, service worker, icons
src/components/      Reusable UI, authentication, onboarding
src/lib/             Finance calculations, defaults, Supabase storage, tests
src/screens/         Home, Activity, Budget, Calendar, Goals, Compare, More, Coach
src/types.ts         Shared data types
src/styles.css       Dark and light design system, responsive layout
src/screens/Compare.css  Compare layout and compact seven-tab navigation
e2e/                 Playwright phone, tablet, and desktop UI tests
playwright.config.ts Local test server and browser configuration
supabase/schema.sql  Private database table and RLS policies
supabase/push.sql    Private browser push subscriptions and RLS
supabase/notifications.sql  Private email outbox and account triggers
server/              Branded email templates and delivery/retry logic
api/                 Vercel account deletion, webhook, and retry endpoints
vercel.json           Daily email retry and bill reminder schedules
docs/ACCOUNT_EMAILS.md     Detailed setup and testing guide
docs/PASSKEYS.md           Passkey configuration and iPhone walkthrough
docs/BANK_CONNECTION.md    Bank connection design, setup, cost, and testing guide
```

## Testing and troubleshooting

From the repository root, run `npm test`, `npm run test:ui`, and `npm run build` before every deployment. Unit and interaction tests cover month/year boundaries, pay frequencies, payday estimates, category overrides, rollover, debt projections, What-if scenarios, CSV parsing and duplicate detection, linked goal/bill payments, push due dates, and comparison math. Playwright checks all seven tabs, layout at several phone and desktop widths, dialog placement, quick add, undo, CSV review, theme, reduced motion, chart value controls, 44-pixel touch targets, comparison details, and install help. Failed browser tests save screenshots and traces in ignored `test-results/`. For an extra check against the production bundle on Mac or Linux, run `npm run build` followed by `POCKIT_PREVIEW=1 npm run test:ui`.

| Symptom                                                | Check                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up says cloud setup is missing                    | `.env.local` or Vercel variables must contain the project URL and publishable key; restart Vite after editing `.env.local`.                                                                                                                                                                                    |
| Sign-up email never arrives                            | Custom SMTP, verified sender, Supabase email confirmation and redirect settings, sender logs, and spam folder.                                                                                                                                                                                                 |
| “Could not load your budget”                           | Run `supabase/schema.sql` in the correct project; confirm Data API access and the publishable key.                                                                                                                                                                                                             |
| Account deletion says it could not complete            | Run `supabase/notifications.sql`, add all server-side Vercel variables from `docs/ACCOUNT_EMAILS.md`, redeploy, and check Vercel logs.                                                                                                                                                                         |
| Owner or deletion email is missing                     | Check `pockit_notifications` for a pending row, Vercel logs, Brevo transactional logs, sender verification, and the webhook secret. The daily cron retries pending rows.                                                                                                                                       |
| Confirmation opens the wrong URL                       | Set Supabase Site URL and allowed redirect URLs to the real production URL.                                                                                                                                                                                                                                    |
| An installed iPhone app looks old                      | Refresh it while online, then relaunch. The service worker caches the shell and updates from the network.                                                                                                                                                                                                      |
| iPhone header is still under the status bar            | Deploy the current build, open the installed app while online, and relaunch it. If iOS keeps the old installed appearance, remove the Home Screen icon and add it again from the production URL in Safari.                                                                                                     |
| Browser shows setup but installed app opens the budget | Check that both show the same signed-in email. Safari and the Home Screen app keep separate sign-in sessions. With the same account and an internet connection, return to the browser or refresh it to pull the latest setup. If a two-device review appears, save a backup before choosing which copy to use. |
| Receipt scan fails                                     | Use a clear, well-lit image with a printed total; enter details manually if OCR cannot read it.                                                                                                                                                                                                                |
| A Supabase project is paused                           | Restore it in the Supabase dashboard, or move to a paid tier if inactivity pauses are unacceptable.                                                                                                                                                                                                            |
| Saving says “Sync needs attention”                     | Check internet access, press **Retry sync**, and confirm the updated `supabase/schema.sql` ran. Download a JSON backup before clearing browser storage.                                                                                                                                                        |
| Two-device review appears                              | Download the local copy, compare with the other device, then choose **Use cloud copy** or **Use this device’s copy**. The choice replaces the entire budget.                                                                                                                                                   |
| Bill push does not arrive                              | Run `supabase/push.sql`, set all VAPID variables and `CRON_SECRET`, redeploy, enable on the installed iPhone app, and check Vercel Cron/Function logs.                                                                                                                                                         |

## Privacy and cost notes

This app does not request banking credentials. CSV and receipt files are read in the browser and are not uploaded as files. Imported transactions and other account data live in the Supabase project selected by the deployer. Pending and cached budget copies live in each signed-in device's browser storage, which may be accessible to someone using that device profile. Avoid shared browser profiles, sign out when finished, and keep exported JSON files private. Supabase RLS restricts a signed-in user to their own row, and the `anon` role has no table access.

For 2–3 people using this as a personal, non-commercial app, Vercel Hobby + Supabase Free + an eligible free Brevo sender can remain at $0, subject to account activation and service limits. A custom domain for Resend, commercial Vercel use, higher usage, or a paid AI service would change that. The current coach and Smart Features require no AI subscription. Email delivery is best effort: outages and provider restrictions can delay or prevent delivery.

## Official references

- [Supabase React quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs), [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Vercel Git deployments](https://vercel.com/docs/git), [Hobby plan](https://vercel.com/docs/plans/hobby)
- [Resend SMTP](https://resend.com/changelog/smtp-service), [Resend pricing](https://resend.com/pricing)
- [Brevo sender verification](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [Brevo SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks), [deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [Brevo transactional email API](https://developers.brevo.com/reference/send-transac-email), [Vercel cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [WebKit Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Plaid Transactions](https://plaid.com/docs/transactions/), [Plaid pricing and billing](https://plaid.com/docs/account/billing/)
