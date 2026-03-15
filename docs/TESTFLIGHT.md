# Distributing the iOS app via TestFlight

TestFlight lets you install the app on real iPhones for beta testing. You need an **Apple Developer account** ($99/year) and to upload a **signed IPA** to App Store Connect.

---

## 1. Prerequisites

- **Apple Developer account**: [developer.apple.com](https://developer.apple.com) → enroll if needed.
- **App in App Store Connect**: Create an app with the same **Bundle ID** as in your Capacitor config (`com.wealthsaas.app` in `mobile-app/capacitor.config.ts`). If you change the bundle ID, create the app in App Store Connect to match.
  - **Step-by-step**: See **[docs/APPLE_APP_SETUP.md](APPLE_APP_SETUP.md)** for creating the app in Apple (enrollment → App ID → App Store Connect).
- **Signing assets**: A **distribution certificate** (`.p12`) and **provisioning profile** for that app (e.g. “App Store” or “Ad Hoc” for TestFlight you use App Store distribution).

---

## 2. Create signing assets (one-time)

### Option A: Xcode (simplest)

1. On a **Mac**, open the iOS project: `cd mobile-app && npx cap open ios`.
2. In Xcode: select the **App** project → **Signing & Capabilities**.
3. Check **Automatically manage signing**, choose your **Team** (Apple Developer account).
4. Build an **Archive**: **Product → Archive**.
5. In the Organizer, **Distribute App** → **App Store Connect** → **Upload**.
6. After that, you can use the same team and “Automatically manage signing” in CI if you provide the right credentials (see below).

### Option B: Manual certificate + profile (for CI)

1. In [Apple Developer](https://developer.apple.com/account): **Certificates** → create an **Apple Distribution** certificate; download and add it to Keychain, then **File → Export** as `.p12` (set a password).
2. In **Profiles** → create an **App Store** provisioning profile for your app’s Bundle ID; download the `.mobileprovision`.
3. You’ll use these in GitHub Actions (see below).

---

## 3. GitHub Actions workflow for TestFlight

The workflow **build-ios-testflight.yml** builds a signed IPA and uploads it to TestFlight. It only runs when you run it manually (**Actions → Build iOS for TestFlight → Run workflow**), so it won’t run on every push unless you want it to.

### Required GitHub secrets

Add these under **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Description |
|--------|-------------|
| `APPLE_ID` | Your Apple ID email (e.g. you@example.com). |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords. Used to upload the IPA. |
| `APPLE_TEAM_ID` | 10-character Team ID from [developer.apple.com/account](https://developer.apple.com/account) → Membership. |
| `IOS_DISTRIBUTION_P12_BASE64` | Contents of your `.p12` file, base64-encoded: `base64 -i YourCert.p12 | pbcopy` (Mac) or equivalent, then paste into the secret. |
| `IOS_DISTRIBUTION_P12_PASSWORD` | Password you set when exporting the `.p12`. |
| `IOS_PROVISIONING_PROFILE_BASE64` | Contents of your `.mobileprovision` file, base64-encoded. |

### Optional variable

- **CAPACITOR_SERVER_URL** (Variables): Your deployed app URL so the WebView loads the correct site.

---

## 4. After the workflow runs

1. In [App Store Connect](https://appstoreconnect.apple.com) → your app → **TestFlight**.
2. Wait a few minutes for the build to finish processing (you’ll get an email when it’s ready).
3. **Internal testing**: Add users in **App Store Connect → Users and Access → Internal Testing** (they get the build automatically).
4. **External testing**: In TestFlight, create an **External Group**, add the build, submit for **Beta App Review** (first time). Once approved, add testers by email; they install **TestFlight** from the App Store and open your invite link to install your app.

---

## 5. Summary

1. Enroll in Apple Developer and create the app in App Store Connect (Bundle ID = `com.wealthsaas.app` or whatever you use).
2. Create distribution certificate + provisioning profile (Xcode automatic signing or manual .p12 + .mobileprovision).
3. Add the GitHub secrets listed above.
4. Run **Actions → Build iOS for TestFlight → Run workflow**.
5. In App Store Connect → TestFlight, use the new build for internal or external testers.

If you don’t add the secrets, the TestFlight workflow will fail at the signing or upload step; the existing **Build iOS** (simulator) workflow is unchanged and does not need these.
