import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.wealthsaas.app',
  appName: 'Wealth SaaS',
  webDir: 'www',
  server: {
    // Override with CAPACITOR_SERVER_URL if building for a different deployment
    url: process.env.CAPACITOR_SERVER_URL || 'https://fintech-dashboard-phi-two.vercel.app',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
