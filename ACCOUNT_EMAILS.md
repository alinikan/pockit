# Account deletion and owner signup alerts

Pockit sends two new emails:

- **Account deleted:** a branded receipt to the former user's email after their sign-in and budget row are deleted.
- **New confirmed signup:** a branded alert to the owner after someone confirms their email address. It contains only the new account's email and confirmation time. It contains no name, income, debts, transactions, goals, or budget data.

The HTML and plain-text templates are in `server/email.ts`. These two templates are sent by Pockit's Vercel functions. **Do not paste them into Supabase Authentication → Email Templates**; that page controls confirmation, recovery, invitation, and email-change messages only.

Pockit uses a private Supabase outbox, an immediate database webhook, and a daily retry. A network failure can delay an email. Neither Vercel nor an email provider can guarantee delivery to every inbox; check the outbox and provider logs if a message does not arrive.

## Before you begin

You need a deployed Pockit project on Vercel with the two existing public variables, a Supabase project where `supabase/schema.sql` has been run, and an active transactional Brevo account. The `.vercel.app` address is enough; you do **not** need to buy a domain. If you already use Brevo SMTP for Supabase confirmation and recovery messages, keep it. The new function also needs a **Brevo API key**, which is different from the SMTP key. If you currently use Gmail SMTP for Supabase, you can leave that in place and use Brevo only for these two new emails.

## 1. Create the private notification outbox in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard), select the **same project** used by Pockit, and open **SQL Editor**.
2. Click **New query**. On your computer, open `supabase/notifications.sql` in a text editor. Copy its _entire_ contents into the SQL Editor and click **Run**.
3. Confirm the query succeeds. In **Table Editor**, you should now see `pockit_notifications`. It should be empty. The table has RLS enabled and no browser-user policy. Its rows are accessible to Pockit's server using the secret key, and the database triggers can insert them.
4. Keep the notification table. Do not add a public RLS policy or browser access to it. The deletion and signup triggers are part of this SQL file; you do not create separate Authentication hooks.

The signup trigger runs when an email is confirmed. If Supabase's **Confirm Email** setting is off, it runs at signup. It does not send alerts for existing users retroactively.

## 2. Prepare Brevo to send Pockit's new emails

1. Open [Brevo](https://app.brevo.com/). If you need an account, choose the free plan. It currently allows up to 300 emails per day, subject to Brevo account approval and future plan changes.
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
2. Keep the existing public variables. Add each missing variable below, selecting **Production**. Enter names exactly as shown, with no quotes or spaces around values. Use **Add** or **Save** after each entry. If Vercel offers **Sensitive** for the secret variables, turn it on.

   | Name                            | Value                                                       | Visibility                        |
   | ------------------------------- | ----------------------------------------------------------- | --------------------------------- |
   | `VITE_SUPABASE_URL`             | Your Supabase Project URL                                   | Public; included in browser build |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Your `sb_publishable_...` key                               | Public; included in browser build |
   | `SUPABASE_URL`                  | The **same** Supabase Project URL                           | Server-side                       |
   | `SUPABASE_SECRET_KEY`           | Your `sb_secret_...` or legacy `service_role` key           | **Secret; server-side only**      |
   | `BREVO_API_KEY`                 | The new Brevo **API key** from step 2                       | **Secret; server-side only**      |
   | `POCKIT_SENDER_EMAIL`           | The email address you verified as a Brevo sender            | Server-side setting               |
   | `POCKIT_ADMIN_EMAIL`            | **Your** mailbox for signup alerts and replies              | Server-side private setting       |
   | `POCKIT_WEBHOOK_SECRET`         | A unique random string of at least 32 characters            | **Secret; server-side only**      |
   | `CRON_SECRET`                   | A second, different random string of at least 32 characters | **Secret; server-side only**      |

3. On a Mac, generate each random string in Terminal with `openssl rand -hex 32`; run it **twice** and copy the two distinct results into your password manager and the matching Vercel fields. Do not commit either to GitHub. On Windows with Node installed, use `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` twice.
4. Select **Production** for the webhook, Brevo, and Supabase secret variables. Do not enable these for publicly shared Preview deployments unless you intentionally want preview signups to send live emails. The two `VITE_` variables may also be enabled for Preview if you test there.
5. You do **not** need **Import .env**. Add these in the Vercel dashboard. Importing a local file can accidentally upload values to the wrong environment. Save, then open **Deployments → latest production deployment → ⋯ → Redeploy**. Choose the current code revision; wait for **Ready**. New environment values apply only to new deployments.
6. Check **Settings → Cron Jobs** after deployment. `vercel.json` should create `/api/retry-notifications` at `08:00 UTC` daily; if you enabled bill push, it also creates `/api/bill-reminders` at `17:00 UTC` daily. Vercel Hobby may run each job any time during its scheduled hour. Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` to both jobs.

## 5. Create the immediate Supabase webhook

Do this **after** the Vercel redeployment so its receiver is ready.

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

Both results should have values after enabling. If either remains `NULL` even though the integration says enabled, this is a Supabase provisioning issue: contact Supabase support with the error and project reference. Do **not** create an empty `supabase_functions` schema yourself; the required function and permissions would still be missing. Pockit's daily retry job can send pending signup alerts while the immediate webhook is unavailable.

## 6. Test with a real throwaway account

1. At your production `.vercel.app` URL, sign up with a **new email address you can access**, different from the Brevo sender. Confirm it using the Pockit email link. You should receive the owner alert at `POCKIT_ADMIN_EMAIL`. If confirmation is enabled, the alert happens **after** the email is confirmed.
2. Complete onboarding. Add one test transaction. Open **More → Your data → Export** if you want to see the optional backup flow.
3. Open **More → Delete account**. Click **Delete my account**, enter the current password, type `DELETE`, and click **Permanently delete account**. Pockit should return to sign-in, and the former account mailbox should receive the branded deletion receipt. Signing in with the old credentials should fail.
4. In Supabase **Authentication → Users**, verify the test account is gone. In **Table Editor → pockit_data**, verify its budget row is gone. In **Table Editor → pockit_notifications**, a successfully sent alert/receipt should no longer be there. A remaining row means delivery is pending or failed.
5. If a message is missing, check the recipient's spam folder, **Brevo → Transactional → Logs**, **Vercel → Logs** for `/api/notify` or `/api/delete-account`, and the `last_error` column in `pockit_notifications`. Verify the sender is active, the API key is an API key rather than an SMTP key, and the webhook secret matches. The daily cron retries pending rows. Do not put credentials in support screenshots.

## Local development

The ordinary `npm run dev` command runs Vite's browser app. Vite does **not** run the Vercel `/api` functions, so account deletion should be tested on the deployed site. Your existing `.env.local` needs only the two `VITE_` Supabase values for normal local UI work. To exercise server functions locally, use Vercel CLI `vercel dev` after adding the server variables in Vercel's **Development** environment; keep any downloaded `.env.local` file out of Git. Never put server secrets behind a `VITE_` prefix.

## How retries and privacy work

The database creates one outbox row for each confirmed signup and one for each account deletion. The webhook attempts delivery immediately. If the email service or webhook fails, the daily Vercel cron retries rows. On success the row is deleted. The outbox therefore temporarily stores account email addresses; protect Supabase dashboard access. Delivery can still be delayed by account pauses, outages, provider suppression, invalid recipients, or an expired API key. Brevo may expire an inactive API key, so check its account notices and rotate the Vercel variable if it does.
