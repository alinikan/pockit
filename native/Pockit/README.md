# Pockit for iPhone — optional native companion

This Xcode project opens the deployed Pockit app in a persistent WebKit view and adds an iPhone Home Screen widget and App Shortcuts. The website remains the main application, so Mac and Windows users continue using the same deployed app.

## Included

- iPhone app shell with persistent website storage.
- Small and medium WidgetKit widgets showing recorded monthly spending, an optional next-bill summary, and quick-entry links.
- App Intents for **Add expense** and **Open calendar**, available to Shortcuts and the iPhone Action button.
- A `pockit://` URL scheme. `pockit://add` opens the website's expense entry form and records nothing automatically.
- An optional, origin-checked bridge for a small widget summary. It accepts messages only from the main frame at `https://pockit-budget.vercel.app`. It does not read cookies, passwords, Supabase tokens, transactions, or account balances.
- Foundation model tests and a reproducible project generator using Python's standard library.

The widget refreshes when the native app receives an updated summary. It does not run a background bank feed. Its timestamp describes when Pockit supplied the summary, not when a bank balance was checked. The snapshot is stored locally in the signed App Group and follows Pockit's amount privacy setting.

## Requirements

- A Mac with Xcode 16 or newer and an iOS 18+ SDK. The project has been compiled with the installed Xcode simulator SDK.
- An Apple development team and provisioning suitable for your chosen App Group and distribution method. Widget/App Group capabilities and longer-term distribution may require Apple Developer Program membership; check Xcode's signing requirements for your account.
- The Pockit website deployed at the host configured in `App/WebContainer.swift`.

A Windows computer can use the web app and edit source, but Xcode building and Apple signing require a Mac. No Apple signing credentials are included in this repository.

## First try: simulator build

1. Open `native/Pockit/Pockit.xcodeproj` in Xcode.
2. Select the **Pockit** scheme.
3. Choose an iPhone simulator, such as an available iPhone Air or iPhone Pro simulator.
4. Press **Run**. If Xcode requires signing, complete the signing steps below or use the unsigned command-line build to verify compilation.
5. Sign in within the app. Safari, the PWA, and this WebKit container keep separate first sign-ins. When they use the same Pockit account, existing cloud synchronization supplies the same budget.

To compile without provisioning or installing on a phone:

```sh
xcodebuild -project native/Pockit/Pockit.xcodeproj \
  -scheme Pockit -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/pockit-native-build CODE_SIGNING_ALLOWED=NO build
```

This checks the app and widget build. It does not validate real-device provisioning, passkeys, Siri, widget refresh timing, or App Store approval.

## Sign and run on your iPhone

1. In **Xcode → Settings → Accounts**, sign in to your own Apple developer account. Enter credentials yourself.
2. In the project navigator, select the blue **Pockit** project, then the **Pockit** app target.
3. Open **Signing & Capabilities**, choose your team, and use a bundle identifier registered to that team. The checked-in example is `com.alinikan.pockit`.
4. Select **PockitWidget**, choose the same team, and set its identifier under the app identifier, such as `com.alinikan.pockit.widget`.
5. Under **Build Settings**, search for `POCKIT_APP_GROUP` and change it to an App Group registered to your team. The example is `group.com.alinikan.pockit`.
6. Confirm that **App Groups** is enabled for both targets and that both entitlements use that same group. The app and widget Info.plist files read the group from this build setting.
7. Connect your iPhone, select it as the destination, and follow Xcode's Developer Mode and provisioning prompts yourself.
8. Press **Run**. If Xcode reports missing capability or provisioning access, resolve it in your Apple developer account; changing website environment variables cannot fix Apple signing.

## Add the widget

1. Sign in to Pockit inside the native app.
2. Open **More → Preferences**.
3. Turn on **Share a small summary with the iPhone companion**. The default is off.
4. Use Pockit's eye/privacy control if you want widget amounts masked. If you disable summary sharing or sign out in the app, the native store clears its summary on the next bridge update.
5. On the iPhone Home Screen, enter edit mode, choose **Add Widget**, search for **Pockit**, and choose a size.
6. The small widget opens Add expense. The medium widget also offers Calendar. Saving an entry still requires your explicit action in the app.

The first simulator widget installation can require relaunching the app or refreshing the simulator's widget gallery. Real device testing is required after signing. Removing website data outside the companion does not remotely erase an already cached widget; open the app to refresh or clear it.

## Shortcuts and the Action button

1. Run the signed app once.
2. Open Apple's **Shortcuts** app and create a shortcut.
3. Add Pockit's **Add expense** or **Open calendar** action.
4. Run it and confirm that Pockit opens the intended screen.
5. To use the iPhone Action button, open **Settings → Action Button → Shortcut** and select your shortcut. Available system labels can vary by iOS version.

## Passkeys in the native container

Email/password login uses the existing website flow. Native-container passkeys need additional Apple website association configuration; do not assume the PWA's existing passkey setup covers a newly signed iOS app.

1. Confirm the final Apple Team ID and application bundle ID.
2. Enable the app's Associated Domains capability with `webcredentials:pockit-budget.vercel.app` for the current host.
3. Serve an `apple-app-site-association` file from that same website's `/.well-known/` path, containing the final `TEAMID.bundle.identifier` in `webcredentials.apps`.
4. Deploy and verify the association file and the signed app together, then test passkey creation and sign-in on a real device.

No guessed Team ID or public association file has been deployed. Continue using email/password in the native container until this is configured. Existing Safari/PWA passkeys retain their own configuration. Consult Apple's current Associated Domains and passkey documentation when configuring your actual Apple team.

## Local model tests

```sh
swift test --package-path native/Pockit --scratch-path /tmp/pockit-swift-tests
```

To regenerate the Xcode project and plist files:

```sh
python3 native/Pockit/generate_project.py
```

The icon is rendered from the same vector mark as the website, with an opaque background for Apple's icon requirements. To regenerate it from the repository root:

```sh
swift native/Pockit/render_icon.swift
```

The project generator uses only Python's standard library. It recreates the example identifiers and configuration, so preserve intentional team/signing changes before regenerating.

## Publishing

The source is ready for signing and further device validation. It has not been submitted to TestFlight or the App Store. Distribution requires your Apple account, certificates, provisioning, product metadata, and Apple's review. Vercel deploying the web app does not install this native app or its widget on an iPhone.
