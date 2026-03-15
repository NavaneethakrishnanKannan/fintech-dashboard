import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.wealthsaas.app',
  appName: 'Wealth SaaS',
  webDir: 'www',
  server: {
    // Set to your deployed app URL (e.g. https://your-app.vercel.app)
    url: process.env.CAPACITOR_SERVER_URL || 'https://your-wealth-saas-url.com',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
