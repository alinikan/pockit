# Pockit release checks

Use this checklist when changing the app, its Supabase schema, or deployment settings. It separates repeatable sample-data checks from the few live-service checks that need a maintainer account.

## 1. Verify the code

From the repository root, use Node.js 22 or newer:

```bash
npm ci
npm run format:check
npm test
npm run build
npm run build:storybook
npx playwright install chromium
POCKIT_PREVIEW=1 npm run test:ui
```

On Windows PowerShell, set `$env:POCKIT_PREVIEW='1'` before `npm run test:ui`, then remove it with `Remove-Item Env:POCKIT_PREVIEW`. The same checks run automatically in GitHub Actions on pushes to `main` and pull requests. The Playwright suite uses Preview Pockit and synthetic data; it does not read real accounts. It checks phone layouts, keyboard and screen-reader semantics, backup restoration, and opening every tab from the installed app's cache while origin requests fail.

## 2. Check a real account and cloud saving

1. Apply the current [`supabase/schema.sql`](../supabase/schema.sql) to the intended Supabase project **before** deploying app code that depends on it. Keep a private copy of existing data first if this is a long-lived project.
2. Deploy the app and open its exact production URL. Confirm Supabase **Authentication → URL Configuration** uses that URL as the Site URL and permits its callback URL.
3. With a dedicated test account, sign in on the website and on the iPhone Home Screen app. Add a small, clearly named test expense on one device. Wait until Pockit says **Saved**, then reopen the other device online. Confirm the entry, category total, Home summary, Calendar, and Compare all update. Delete the test entry after checking.
4. Put one device offline, edit a separate test category, reconnect, and confirm the pending edit is saved. On the other device, make an overlapping edit and verify Pockit asks which copy to keep instead of silently overwriting it. Export a backup before resolving any conflict involving real data.
5. Sign into a second test account. Confirm it cannot see the first account's budget. Sign out and back in, and confirm its own data returns. This is a practical check of authentication and RLS configuration; the local browser suite cannot exercise the live database.

## 3. Practice recovery

1. In **More → Imports & data**, download a JSON backup from the test account. Keep the file private; it contains the budget.
2. Add a temporary test transaction. Choose the downloaded JSON file under **Restore a backup** and review the counts before continuing.
3. Choose **Download current copy and restore**. Confirm the browser downloads the pre-restore copy, the temporary transaction disappears, and the older totals return in Home, Activity, Budget, and Compare.
4. Try a malformed JSON file and a file marked with a non-CAD currency in a test account. Pockit should reject both without replacing the budget. Never use a real user's only copy for this drill.

## 4. Check the installed iPhone experience

1. Open the production URL in Safari and refresh it while online. Launch Pockit from its Home Screen icon. Compare the current release in both places; Safari and the installed app may have separate first sign-ins.
2. Inspect the header and bottom navigation on the iPhone Air, iPhone 17 Pro, or closest available simulator/device. Tap through all seven tabs, add and edit a transaction, open a category's eye view, drag a Home section, and explore a goal graph. Check both dark and light modes, long names, and the on-screen keyboard.
3. After the app loads once online, turn off connectivity and relaunch it. Existing locally cached data and each tab should remain usable. Sign-in and cloud saving require connectivity. Reconnect and wait for **Saved** before closing.
4. Test VoiceOver or another screen reader on the welcome screen, Activity filters, a transaction dialog, and a chart. Use large text and reduced motion settings as a manual check. Automated accessibility scans detect many structural issues, but they do not replace this device check.

## 5. Check optional services

- **Account mail:** Sign up a test user outside the Supabase project team. Confirm the branded confirmation message arrives, the link opens the right URL, and password reset works. Check the owner alert and account deletion email using the [account email guide](ACCOUNT_EMAILS.md).
- **Push:** If enabled, create a test bill due soon, allow notifications in the installed iPhone app, and inspect the Vercel cron/function logs and subscription state if no reminder arrives.
- **Performance:** If Speed Insights is enabled, visit the production app and check the Vercel project's Speed Insights page after data has had time to arrive. Verify no query string or account-specific path appears.
- **Errors:** If Sentry is enabled, deliberately trigger only a controlled test error in a non-production test deployment. Confirm the report has error type and bundle location, with no payee, amount, email address, chat text, URL parameters, or breadcrumbs.

If a check fails, keep the old deployment available, save a JSON backup before manipulating live data, and fix the failing layer before inviting users to the new version.
