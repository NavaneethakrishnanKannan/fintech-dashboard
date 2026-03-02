import { Providers } from './providers'

export const metadata = {
  title: 'Wealth SaaS',
  description: 'AI-powered wealth dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
