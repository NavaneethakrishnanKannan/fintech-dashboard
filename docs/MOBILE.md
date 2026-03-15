# Mobile: PWA and native app (APK / iOS)

Wealth SaaS supports:

1. **PWA** – Install from the browser (“Add to Home Screen”) on any device.
2. **Native-style app** – Build an APK (Android) or IPA (iOS) using Capacitor that loads your deployed site in a WebView.

## PWA (already in the project)

- **Manifest**: `app/manifest.ts` – name, icons, theme, `standalone` display.
- **Service worker**: `public/sw.js` – registered for installability; network-first (no offline cache).
- **Icons**: Place `icon-192x192.png` and `icon-512x512.png` in `public/` (e.g. from [RealFaviconGenerator](https://realfavicongenerator.net/) or any PWA icon generator). Placeholder 1×1 icons are there so the manifest works; replace for production.

Deploy the Next.js app over **HTTPS**. Users can then install it from the browser (Chrome “Install app”, Safari “Add to Home Screen”, etc.).

## Native app (APK / iOS)

The **Capacitor** app lives in `mobile-app/`. It does not bundle the Next.js app; it opens your **deployed** URL in a WebView.

- **Setup and build**: See [mobile-app/README.md](../mobile-app/README.md).
- **Steps in short**: set `server.url` in `mobile-app/capacitor.config.ts` to your deployed URL → `npm install` → `npx cap add android` (and optionally `ios`) → `npm run sync` → open in Android Studio / Xcode and build.

Same codebase (your web app) powers both PWA and the native shell; the native app is just a thin wrapper.

## Building in the cloud (GitHub Actions)

Workflows run on push to `main` (when `mobile-app/` or the workflow file changes) or manually via **Actions** tab → **Run workflow**.

### Android (APK)

- **Workflow**: [.github/workflows/build-android.yml](../.github/workflows/build-android.yml)
- **Result**: A debug APK is uploaded as an artifact **wealth-saas-android-debug**. Download from the run summary → **Artifacts**.
- **Optional**: Set repository variable **CAPACITOR_SERVER_URL** (Settings → Secrets and variables → Actions → Variables) to your deployed app URL so the WebView loads the correct site.

### iOS (Simulator build)

- **Workflow**: [.github/workflows/build-ios.yml](../.github/workflows/build-ios.yml)
- **Result**: An **App.app** for the iOS Simulator is uploaded as **wealth-saas-ios-simulator**. Use it in Xcode’s simulator on a Mac or in other macOS tooling.
- **Note**: This builds for the simulator only (no code signing). To produce an **IPA** for TestFlight/App Store you need Apple signing (certificate + provisioning profile) and an extra job that runs `xcodebuild archive` and `-exportArchive`; you can add that using repository secrets (e.g. `APPLE_DEVELOPER_TEAM_ID`, signing cert, profile).
