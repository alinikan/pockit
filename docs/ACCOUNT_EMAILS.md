# Account deletion and owner signup alerts

Pockit sends two new emails:

- **Account deleted:** a branded receipt to the former user's email after their sign-in and budget row are deleted.
- **New confirmed signup:** a branded alert to the owner after someone confirms their email address. It contains only the new account's email and confirmation time. It contains no name, income, debts, transactions, goals, or budget data.

The HTML and plain-text templates are in `server/email.ts`. These two templates are sent by Pockit's Vercel functions. **Do not paste them into Supabase Authentication → Email Templates**; that page controls confirmation, recovery, invitation, and email-change messages only.

Pockit uses a private Supabase outbox, an immediate database webhook, a confirmed-user fallback, and a daily retry. The fallback runs when a confirmed user opens Pockit, even if the database webhook could not be installed. A network failure can delay an email. Neither Vercel nor an email provider can guarantee delivery to every inbox; check the outbox and provider logs if a message does not arrive.

## Before you begin

You need a deployed Pockit project on Vercel with the two existing public variables, a Supabase project where `supabase/schema.sql` has been run, and an active transactional Brevo account. The `.vercel.app` address is enough; you do **not** need to buy a domain. If you already use Brevo SMTP for Supabase confirmation and recovery messages, keep it. The new function also needs a **Brevo API key**, which is different from the SMTP key. If you currently use Gmail SMTP for Supabase, you can leave that in place and use Brevo only for these two new emails.

## 1. Create the private notification outbox in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard), select the **same project** used by Pockit, and open **SQL Editor**.
2. Click **New query**. On your computer, open `supabase/notifications.sql` in a text editor. Copy its _entire_ contents into the SQL Editor and click **Run**.
3. Confirm the query succeeds. In **Table Editor**, you should now see `pockit_notifications` and `pockit_notification_receipts`. Both have RLS enabled and no browser-user policy. The outbox may already contain pending messages if you ran an earlier version. A receipt contains only a user ID and delivery time; it prevents repeat alerts on later sign-ins.
4. Keep the notification table. Do not add a public RLS policy or browser access to it. The deletion and signup triggers are part of this SQL file; you do not create separate Authentication hooks.

The signup trigger runs when an email is confirmed. If Supabase's **Confirm Email** setting is off, it runs at signup. Existing confirmed users can trigger the fallback by signing in again after deployment. Running the SQL file again is safe and upgrades an earlier installation of the notification system.

## 2. Prepare Brevo to send Pockit's new emails

1. Open [Brevo](https://app.brevo.com/). If you need an account, choose the free plan. [Brevo currently lists 300 email sends per day](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan), subject to account approval and future plan changes.
2. If you have not added a sender, open your profile menu → **Settings → Senders, Domains, IPs → Senders → Add a sender**. Enter **From name** `Pockit` and an email address you own and can open, such as a dedicated Gmail address. Save, then enter the code Brevo sends to verify that mailbox. You do not need to own a domain; Brevo may rewrite the displayed From address for free-mailbox senders.
3. Open your profile menu → **Settings → SMTP & API → API Keys & MCP**. Click **Generate a new API key**. Name it `Pockit Vercel notifications`. Copy the full key now and save it in your password manager. Brevo will not show the whole key later. This is the value for `BREVO_API_KEY`. It is **not** the SMTP key used in Supabase's SMTP settings.
4. Check that transactional sending is active. If Brevo is still reviewing or has not enabled it, the app will queue emails and retry, but messages will not leave until Brevo enables sending. A verified sender and an API key alone do not prove delivery.

## 3. Find the Supabase values

In the same Supabase project, open **Settings → API Keys** (or the **Connect** panel, depending on the dashboard version):

- **Project URL**: `https://PROJECT_REF.supabase.co`. This is the value for `SUPABASE_URL` and should match your existing `VITE_SUPABASE_URL`.
- **Publishable key**: starts with `sb_publishable_`. This is your existing `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Secret key**: starts with `sb_secret_`. Copy this for `SUPABASE_SECRET_KEY`. It can administer users and read the private outbox. **Never put it in `.env.example`, GitHub, a `VITE_` variable, or the browser.** If your older project has no `sb_secret_` key, use its legacy `service_role` key as the server-only value.

## 4. Add Vercel environment variables

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your **Pockit project** → **Settings → Environment Variables**.
2. Keep the existing public variables. Add each missing required variable below, selecting **Production**. `POCKIT_WEBHOOK_SECRET` is needed only if you choose the optional webhook in step 5. Enter names exactly as shown, with no quotes or spaces around values. Use **Add** or **Save** after each entry. If Vercel offers **Sensitive** for the secret variables, turn it on.

   | Name                            | Value                                                                   | Visibility                        |
   | ------------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
   | `VITE_SUPABASE_URL`             | Your Supabase Project URL                                               | Public; included in browser build |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Your `sb_publishable_...` key                                           | Public; included in browser build |
   | `SUPABASE_URL`                  | The **same** Supabase Project URL                                       | Server-side                       |
   | `SUPABASE_SECRET_KEY`           | Your `sb_secret_...` or legacy `service_role` key                       | **Secret; server-side only**      |
   | `BREVO_API_KEY`                 | The new Brevo **API key** from step 2                                   | **Secret; server-side only**      |
   | `POCKIT_SENDER_EMAIL`           | The email address you verified as a Brevo sender                        | Server-side setting               |
   | `POCKIT_ADMIN_EMAIL`            | **Your** mailbox for signup alerts and replies                          | Server-side private setting       |
   | `POCKIT_WEBHOOK_SECRET`         | A unique random string of at least 32 characters; optional webhook only | **Secret; server-side only**      |
   | `CRON_SECRET`                   | A second, different random string of at least 32 characters             | **Secret; server-side only**      |

3. On a Mac, generate `CRON_SECRET` in Terminal with `openssl rand -hex 32`. Run it a second time for a **different** `POCKIT_WEBHOOK_SECRET` only if you use the webhook. Copy secrets into your password manager and the matching Vercel fields; do not commit them to GitHub. On Windows with Node installed, use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` once or twice as needed.
4. Select **Production** for the Brevo and Supabase secret variables, `CRON_SECRET`, and any optional webhook secret. Do not enable these for publicly shared Preview deployments unless you intentionally want preview signups to send live emails. The two `VITE_` variables may also be enabled for Preview if you test there.
5. You do **not** need **Import .env**. Add these in the Vercel dashboard. Importing a local file can accidentally upload values to the wrong environment. Save, then open **Deployments → latest production deployment → ⋯ → Redeploy**. Choose the current code revision; wait for **Ready**. New environment values apply only to new deployments.
6. Check **Settings → Cron Jobs** after deployment. `vercel.json` should create `/api/retry-notifications` at `08:00 UTC` daily; if you enabled bill push, it also creates `/api/bill-reminders` at `17:00 UTC` daily. Vercel Hobby may run each job any time during its scheduled hour. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to both jobs.

## 5. Create the immediate Supabase webhook

This step is **optional**. The confirmed-user fallback and daily retry work without the webhook. A webhook makes new signup and deletion emails faster when the user is not currently in Pockit. Do this **after** the Vercel redeployment so its receiver is ready.

1. First open **Integrations → Database Webhooks → Overview** in Supabase and click **Install integration**. Supabase has also called this **Enable Database Webhooks** or, in older dashboard layouts, **Database → Webhooks → Enable webhooks**. Complete any installation prompt, wait for it to finish, then refresh the page. This provisions the `supabase_functions` schema and its `http_request()` function. Merely enabling the `pg_net` extension does not do that.
2. Open **Database → Webhooks** (or the Webhooks integration's hooks page) and click **Create a new hook**. Name it `pockit-notifications`.
3. Select schema **public** and table **pockit_notifications**. Select **INSERT** only. Leave UPDATE and DELETE unchecked.
4. Choose an **HTTP Request** webhook, method **POST**. Set the URL to your exact production address plus `/api/notify`, for example `https://YOUR-PROJECT.vercel.app/api/notify`. Use the stable production domain, not a preview deployment URL.
5. Add HTTP headers:

   ```text
   Content-Type: application/json
   x-pockit-webhook-secret: THE_EXACT_VALUE_OF_POCKIT_WEBHOOK_SECRET
   ```

   Copy the secret from your password manager or Vercel's saved value. It must match exactly. **Do not add the Supabase secret key as a webhook header.**

6. Save the webhook. If the dashboard exposes a timeout, use 10,000 ms. The webhook payload contains the minimal outbox row, not the whole `auth.users` record.

If saving says `schema "supabase_functions" does not exist`, return to the **Install integration** step above. You can check provisioning in **SQL Editor** with this read-only query:

```sql
select to_regnamespace('supabase_functions') as webhook_schema,
       to_regprocedure('supabase_functions.http_request()') as webhook_function;
```

Both results should have values after enabling. If either remains `NULL` even though the integration says enabled, contact Supabase support with the error and project reference. Do **not** create an empty `supabase_functions` schema yourself; the required function and permissions would still be missing. You can leave the webhook uninstalled: confirmed users opening Pockit will attempt delivery, and the daily cron retries pending rows.

## 6. Test with a real throwaway account

1. At your production `.vercel.app` URL, sign up with a **new email address you can access**, different from the Brevo sender. Confirm it using the Pockit email link. You should receive the owner alert at `POCKIT_ADMIN_EMAIL`. If confirmation is enabled, the alert happens **after** the email is confirmed.
2. Complete onboarding. Add one test transaction. Open **More → Your data → Export** if you want to see the optional backup flow.
3. Open **More → Delete account**. Click **Delete my account**, enter the current password, type `DELETE`, and click **Permanently delete account**. Pockit should return to sign-in, and the former account mailbox should receive the branded deletion receipt. Signing in with the old credentials should fail.
4. In Supabase **Authentication → Users**, verify the test account is gone. In **Table Editor → pockit_data**, verify its budget row is gone. In **Table Editor → pockit_notifications**, a successfully sent alert/receipt should no longer be there. A remaining row means delivery is pending or failed.
5. If a message is missing, check the recipient's spam folder, **Brevo → Transactional → Logs**, **Vercel → Logs** for `/api/notify`, `/api/ensure-signup-alert`, or `/api/retry-notifications`, and the `last_error` column in `pockit_notifications`. Verify the sender is active, the API key is an API key rather than an SMTP key, and the webhook secret matches. The daily cron retries pending rows. Do not put credentials in support screenshots.

### If an earlier friend's signup did not alert you

1. Run the **entire current** `supabase/notifications.sql` file in your Pockit Supabase project's SQL Editor. This adds the receipt table needed for safe fallback delivery. Verify both notification tables appear in Table Editor.
2. In Vercel → Pockit → Settings → Environment Variables, verify `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `BREVO_API_KEY`, `POCKIT_SENDER_EMAIL`, and `POCKIT_ADMIN_EMAIL` are set for **Production**. Also verify `CRON_SECRET` for daily retry. Keep the secret values private. Redeploy the production project after any changes.
3. Ask your friend to open the **production** Pockit URL and sign in once with their confirmed email. The app will ask its server to queue and attempt the owner alert for that verified account. It reads the email from Supabase, never from the browser request body. It will not include their budget. A successful alert creates one receipt, so repeat sign-ins do not send duplicates.
   - If some older non-owner accounts already generated an alert before this receipt table existed, their first sign-in after this upgrade can send one repeat alert. Later sign-ins will not. Your own account is skipped when its email matches `POCKIT_ADMIN_EMAIL`.
4. If the email still does not arrive, use Supabase SQL Editor to run:

   ```sql
   select kind, count(*) as pending, max(created_at) as newest,
          max(last_error) as latest_error
   from public.pockit_notifications
   group by kind;

   select kind, count(*) as delivered
   from public.pockit_notification_receipts
   group by kind;
   ```

   A pending signup with a `last_error` means the delivery call failed; check that error alongside Vercel and Brevo logs. A pending row without an error may be waiting for the webhook or daily retry. A receipt means Brevo accepted the message; check the recipient mailbox and Brevo delivery log. If both are empty after your friend signs in, inspect Vercel logs for `/api/ensure-signup-alert` and confirm your newest deployment is live.

## Local development

The ordinary `npm run dev` command runs Vite's browser app. Vite does **not** run the Vercel `/api` functions, so account deletion should be tested on the deployed site. Your existing `.env.local` needs only the two `VITE_` Supabase values for normal local UI work. To exercise server functions locally, use Vercel CLI `vercel dev` after adding the server variables in Vercel's **Development** environment; keep any downloaded `.env.local` file out of Git. Never put server secrets behind a `VITE_` prefix.

## How retries and privacy work

The database creates one outbox row for each confirmed signup and one for each account deletion. The webhook attempts delivery immediately. If the email service or webhook fails, the daily Vercel cron retries rows. On success the row is deleted. The outbox therefore temporarily stores account email addresses; protect Supabase dashboard access. Delivery can still be delayed by account pauses, outages, provider suppression, invalid recipients, or an expired API key. Brevo may expire an inactive API key, so check its account notices and rotate the Vercel variable if it does.
