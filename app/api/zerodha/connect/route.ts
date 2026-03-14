import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { getKiteLoginUrl } from '@/lib/zerodha'

const COOKIE_NAME = 'zerodha_connect'
const COOKIE_MAX_AGE = 600 // 10 min

/** Redirect user to Zerodha Kite login. Redirect URL must be set in Kite console to NEXTAUTH_URL/api/zerodha/callback */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const loginUrl = getKiteLoginUrl()
  const res = NextResponse.redirect(loginUrl, 302)
  res.cookies.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  return res
}
