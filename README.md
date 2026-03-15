
# Wealth SaaS Version

## Features
- Multi-user ready
- Supabase PostgreSQL compatible
- NextAuth structure (Google + Email)
- Slider-based what-if simulator
- Monte Carlo simulation
- SaaS-ready architecture

## Setup

1. npm install
2. Add DATABASE_URL (Supabase)
3. Add NEXTAUTH_SECRET
4. Add Google OAuth credentials
5. npx prisma migrate dev
6. npm run dev

Deploy on Vercel + Supabase for full SaaS setup.

## Mobile (PWA & APK)

- **PWA**: The app is installable from the browser (Add to Home Screen). See [docs/MOBILE.md](docs/MOBILE.md).
- **APK / iOS**: Use the Capacitor app in `mobile-app/` to build a native shell that loads your deployed URL. See [mobile-app/README.md](mobile-app/README.md).
