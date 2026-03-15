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
