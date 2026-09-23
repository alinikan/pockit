# Pockit authentication emails

These four HTML templates use Pockit's dark green and lime palette. They need no paid design service, remote images, or custom web domain. The subject lines are entered separately in Supabase.

The account deletion receipt and owner signup alert are separate code-based templates in [`server/email.ts`](../server/email.ts). Their exact setup is in [`ACCOUNT_EMAILS.md`](../ACCOUNT_EMAILS.md); they are sent from Vercel and are **not** pasted into Supabase's auth template editor.

| Supabase template    | Subject                          | HTML file                              |
| -------------------- | -------------------------------- | -------------------------------------- |
| Confirm signup       | Your Pockit is almost ready      | [confirmation.html](confirmation.html) |
| Reset password       | A fresh password for your Pockit | [recovery.html](recovery.html)         |
| Invite user          | You have a place in Pockit       | [invite.html](invite.html)             |
| Change email address | Confirm your new Pockit email    | [email-change.html](email-change.html) |

## Set them up

1. Configure and test a custom SMTP sender in **Supabase → Authentication → SMTP Settings**. On a new Supabase Free project, the default mailer does not permit customized auth templates; custom SMTP restores template editing. Brevo or a dedicated Gmail sender can work without owning a domain. See the main [README](../README.md#3-configure-email-delivery).
2. Set **Authentication → URL Configuration → Site URL** to the exact production `.vercel.app` URL and add it to the redirect allow list. Pockit passes its current website origin when requesting confirmation and reset emails.
3. Open **Authentication → Email Templates** (the dashboard may show **Emails → Templates**). Choose **Confirm signup**. Replace its subject with the subject above. Open `confirmation.html` in a text editor, copy the **entire** file, paste it into the HTML/body editor, and save.
4. Repeat for **Reset password**. The **Invite user** and **Change email address** templates are ready if you enable those flows later.
5. Make a fresh test account using an address other than the sender. Inspect the email on a phone and a desktop email client, click the button, and confirm Pockit opens. Test **Forgot password?** and finish changing the password. The reset form is part of the app.

Keep every `{{ .ConfirmationURL }}` expression intact. Supabase replaces it with a unique link when sending each message. Do not hard-code a Vercel URL in the button, remove the braces, or turn on link tracking in the SMTP provider: tracking may rewrite auth links. If a test account already has an unconfirmed registration from a failed email setup, use another test address or remove that test user in Supabase **Authentication → Users** before repeating signup.

The same HTML can be pasted into a hosted Supabase project's template editor. The files are committed for version history and easier updates. No SMTP password or API key belongs in these files.
