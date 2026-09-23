# Passkeys for Pockit

Pockit supports optional passkey sign-in through Supabase Auth. An iPhone can use Face ID, Touch ID, or its device passcode to approve a passkey. Other devices may use a PIN, fingerprint reader, password manager, or security key. Neither Pockit nor Supabase receives a face or fingerprint scan. Email and password remain available as a backup.

Supabase currently labels passkeys experimental. Its API and dashboard may change.

## 1. Check the permanent website address

The screenshot shows `https://pockit-budget.vercel.app`. Open that exact URL in Safari and confirm it is the live Pockit website. If your permanent Vercel address is different, use the actual address in every field below. Avoid a Vercel Preview URL, which can change between deployments.

Passkeys are bound to the **Relying Party ID**. Changing it later means users must create new passkeys. The free `.vercel.app` address is sufficient; no purchased domain is required.

## 2. Save the Supabase passkey settings

1. Open [Supabase Dashboard](https://supabase.com/dashboard), select the Pockit project, and choose **Authentication → Passkeys**.
2. Turn on **Enable Passkey authentication**. In the screenshot it is already green, but changes are not active until **Save changes** is clicked.
3. Set **Relying Party Display Name** to `Pockit`.
4. Set **Relying Party ID** to `pockit-budget.vercel.app`. Enter the hostname only: no `https://`, slash, path, or port.
5. Set **Relying Party Origins** to `https://pockit-budget.vercel.app`. Include `https://`; do not add a trailing slash.
6. Click **Save changes** and wait for the success message. Reopen the page and verify the toggle and values were saved.

Do not add `http://localhost:5173` or a Vercel Preview URL to this RP ID's origins: their hostnames do not match `pockit-budget.vercel.app`. Test passkeys on the production address.

## 3. Deploy the updated code

The Supabase switch alone does not add a passkey button to the website. Deploy this updated source through the existing GitHub → Vercel workflow. `package.json` now requires `@supabase/supabase-js` 2.105.0 or newer. Keep the existing Vercel `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. No new environment variable, SQL table, email service, or paid service is needed for passkeys.

Commit and push the new code if Vercel deploys from GitHub. Wait for the production deployment to say **Ready**, then reload the production website in Safari. If the installed Home Screen app looks old, refresh the website in Safari and relaunch the Home Screen app.

## 4. Add a passkey on an iPhone

1. Open `https://pockit-budget.vercel.app` in Safari.
2. Sign up with an email and password and confirm the email, or sign in to an existing account.
3. Complete onboarding if needed. Tap **More** in the bottom bar.
4. Scroll to **Passkeys** and tap **Add a passkey**. Follow the iPhone prompt to save a passkey for Pockit; approve with Face ID, Touch ID, or the device passcode.
5. Confirm a passkey appears in the list. Keep the password as a fallback while Supabase's passkey feature is experimental.

## 5. Test sign-in

1. Tap **More → Sign out**. An existing session otherwise opens the app without another passkey prompt.
2. On the welcome screen, tap **Already have an account? Sign in**.
3. Tap **Sign in with a passkey** and approve the device prompt.
4. Confirm Pockit opens the **same account** with its budget intact. Password sign-in and **Forgot password?** remain available.

If the passkey button is missing, confirm the new deployment is live over HTTPS in an updated browser. If you see an RP ID or origin mismatch, compare the Safari address bar with the two Supabase fields exactly. If Supabase says `passkey_disabled`, confirm **Save changes** was clicked. Email confirmation must be complete before passkey registration.

In **More → Passkeys**, users can remove a passkey with **Remove → Confirm remove**. If a device is lost, sign in with the password on another device and remove its passkey.

Passkeys handle **sign-in**. They do not lock Pockit every time its Home Screen icon is opened; the normal Supabase session persists until sign-out or expiry.

## References

- [Supabase passkey guide](https://supabase.com/docs/guides/auth/passkeys)
- [Supabase JavaScript passkey sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpasskey)
- [Apple passkeys overview](https://developer.apple.com/passkeys/)
