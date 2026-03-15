# Step-by-step: Create your app in Apple (Developer + App Store Connect)

Follow these steps to register your app with Apple so you can build for TestFlight and the App Store. Your app’s Bundle ID in this project is **`com.wealthsaas.app`** (from `mobile-app/capacitor.config.ts`).

---

## Step 1: Enroll in the Apple Developer Program (if you haven’t)

1. Go to **[developer.apple.com](https://developer.apple.com)** and sign in with your Apple ID.
2. Click **Account** (or **Membership** in the sidebar).
3. If you see **Join the Apple Developer Program** (or **Enroll**), click it.
4. Complete enrollment:
   - Choose **Organization** or **Individual**.
   - Pay the **$99 USD/year** fee.
   - Wait for approval (often same day for individuals; organizations may take a few days).
5. When approved, your **Team** appears under **Membership**. Note your **Team ID** (10 characters) — you’ll use it for signing and in GitHub secrets.

---

## Step 2: Create an App ID (Bundle ID) in the Developer portal

1. Go to **[developer.apple.com/account](https://developer.apple.com/account)** → **Certificates, Identifiers & Profiles** (or **Identifiers** in the sidebar).
2. Click **Identifiers**.
3. Click the **+** button to add a new identifier.
4. Select **App IDs** → **Continue**.
5. Choose **App** → **Continue**.
6. Fill in:
   - **Description**: e.g. `Wealth SaaS`
   - **Bundle ID**: choose **Explicit** and enter: **`com.wealthsaas.app`** (must match your Capacitor `appId`).
   - **Capabilities**: leave default or add any you need (e.g. Push Notifications later). For a basic WebView app you can leave as-is.
7. Click **Continue** → **Register**.

You now have an App ID that Xcode and App Store Connect will use.

---

## Step 3: Create the app in App Store Connect

App Store Connect is where you manage TestFlight and App Store listing. You must create an app record here before you can upload builds.

1. Go to **[appstoreconnect.apple.com](https://appstoreconnect.apple.com)** and sign in with the same Apple ID (or one that has access to your team).
2. Click **My Apps** (or **Apps** in the top bar).
3. Click the **+** button → **New App**.
4. Fill in:
   - **Platforms**: check **iOS**.
   - **Name**: e.g. **Wealth SaaS** (this is the name under the icon; 30 characters max).
   - **Primary Language**: e.g. English (U.S.).
   - **Bundle ID**: choose the one you created in Step 2 — **`com.wealthsaas.app`**.
   - **SKU**: any unique string (e.g. `wealth-saas-001`). Only you see this; it can’t be changed later.
   - **User Access**: **Full Access** (or **Limited** if you use a role that can’t see financial data).
5. Click **Create**.

Your app now appears in **My Apps**. You can add a description, screenshots, and privacy details later; for TestFlight you only need this app record and the Bundle ID.

---

## Step 4: What to do next

- **TestFlight**: Upload a signed IPA (e.g. via the [Build iOS for TestFlight](.github/workflows/build-ios-testflight.yml) workflow). See **[docs/TESTFLIGHT.md](TESTFLIGHT.md)** for signing and GitHub secrets.
- **App Store**: When you’re ready to release, fill in the store listing (description, screenshots, etc.) in App Store Connect and submit the build for review.

---

## Quick reference

| Item        | Value (for this project)   |
|------------|----------------------------|
| Bundle ID  | `com.wealthsaas.app`       |
| Where set  | `mobile-app/capacitor.config.ts` → `appId` |
| App ID     | Created in Developer → Identifiers |
| App record | Created in App Store Connect → My Apps → New App |

If you change the Bundle ID in `capacitor.config.ts`, create a **new** App ID and a **new** app in App Store Connect with that same Bundle ID.
