import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

/** Use in App Router API routes to get current user id. Returns null if not signed in. */
export async function getUserId(req: NextRequest): Promise<string | null> {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })
  return (token?.id as string) ?? (token?.sub as string) ?? null
}
