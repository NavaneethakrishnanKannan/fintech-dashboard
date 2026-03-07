import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/** Use in App Router API routes to get current user id. Returns null if not signed in. */
export async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const id = (session?.user as { id?: string } | undefined)?.id
  return id ?? null
}
