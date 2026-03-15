# Wealth SaaS – Mobile app (APK / iOS)

This folder is a **Capacitor** app that wraps the deployed Wealth SaaS web app in a native shell. The app loads your live site in a WebView (no bundled copy of the app).

## Prerequisites

- Node.js 18+
- For **Android**: [Android Studio](https://developer.android.com/studio) and Android SDK
- For **iOS** (Mac only): Xcode

## 1. Set your app URL

Edit `capacitor.config.ts` and set `server.url` to your deployed Wealth SaaS URL, for example:

- `https://your-app.vercel.app`
- `https://wealth-saas.example.com`

Or set the env var when syncing:

```bash
CAPACITOR_SERVER_URL=https://your-app.vercel.app npm run sync
```

## 2. Install and add platforms

```bash
cd mobile-app
npm install
npx cap add android
# Optional, Mac only:
npx cap add ios
```

## 3. Sync and open in IDE

```bash
npm run sync
npm run android   # opens Android Studio
# Or: npx cap open ios
```

## 4. Build APK / AAB (Android)

In Android Studio:

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)** for a debug/installable APK.
2. For release (Play Store), use **Build → Generate Signed Bundle / APK** and follow the wizard.

You can also build from the command line with Gradle (see Android Studio’s “Open” path):

```bash
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## 5. Build for iOS (Mac only)

1. Open the project in Xcode: `npx cap open ios`
2. Select your team and device/simulator.
3. **Product → Archive** for release, or run on simulator/device.

## Notes

- The app is a **WebView** pointing at your deployed URL. Deploy updates to the web app; no need to republish the app for content changes (unless you change native config or plugins).
- Replace `com.wealthsaas.app` in `capacitor.config.ts` if you need a different Android package name / iOS bundle ID.
