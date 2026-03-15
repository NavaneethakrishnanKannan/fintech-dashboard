'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { PWAProvider } from '@/components/PWAProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <PWAProvider>{children}</PWAProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
