import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

/** Use pooler-compatible URL to avoid "prepared statement does not exist" (Supabase/Neon pooler). */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? ''
  if (!url) return url
  if (url.includes('pgbouncer=true')) return url
  if (url.includes('pooler.supabase.com') || url.includes('pooler.neon.tech')) {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}pgbouncer=true`
  }
  return url
}

const databaseUrl = getDatabaseUrl()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    datasources: { db: { url: databaseUrl } },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

