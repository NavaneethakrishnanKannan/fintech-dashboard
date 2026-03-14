import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Dashboard auth is enforced in app/dashboard/layout.tsx (useSession) and in API
 * routes (getUserId). We do NOT protect /dashboard here because on Vercel the Edge
 * middleware often fails to read the session cookie after login (getToken returns null),
 * causing redirects back to login. Letting the request through allows the Node.js
 * runtime (session API + layout) to see the cookie correctly.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
