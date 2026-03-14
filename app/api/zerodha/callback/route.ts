import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { exchangeRequestToken, checksum } from '@/lib/zerodha'

const KITE_API_BASE = 'https://api.kite.trade'
const COOKIE_NAME = 'zerodha_connect'

function redirect(path: string, req: NextRequest) {
  const origin = req.nextUrl.origin || process.env.NEXTAUTH_URL || 'http://localhost:3000'
  return NextResponse.redirect(`${origin}${path}`, 302)
}

/** Kite redirects here with request_token. Exchange for access_token and store. */
export async function GET(req: NextRequest) {
  try {
    const requestToken = req.nextUrl.searchParams.get('request_token')
    if (!requestToken) {
      return redirect('/dashboard/integrations?zerodha=error&reason=no_token', req)
    }

    const session = await getServerSession(authOptions)
    let userId: string | null = (session?.user as { id?: string } | undefined)?.id ?? null
    if (!userId) {
      const cookieStore = await cookies()
      const connectCookie = cookieStore.get(COOKIE_NAME)?.value
      if (connectCookie) {
        const user = await prisma.user.findUnique({ where: { id: connectCookie }, select: { id: true } })
        if (user) userId = user.id
      }
    }
    if (!userId) {
      return redirect('/dashboard/integrations?zerodha=signin', req)
    }

    const { apiKey, secret } = exchangeRequestToken(requestToken)
    const checksumVal = checksum(apiKey, requestToken, secret)

    const form = new URLSearchParams()
    form.set('api_key', apiKey)
    form.set('request_token', requestToken)
    form.set('checksum', checksumVal)

    const tokenRes = await fetch(`${KITE_API_BASE}/session/token`, {
      method: 'POST',
      headers: { 'X-Kite-Version': '3', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })

    const text = await tokenRes.text()
    if (!tokenRes.ok) {
      console.error('[zerodha/callback] token exchange failed', tokenRes.status, text)
      return redirect('/dashboard/integrations?zerodha=error&reason=exchange_failed', req)
    }

    let json: { status?: string; data?: { access_token: string; user_id?: string; user_name?: string } }
    try {
      json = JSON.parse(text) as typeof json
    } catch {
      console.error('[zerodha/callback] invalid JSON', text)
      return redirect('/dashboard/integrations?zerodha=error&reason=invalid_response', req)
    }

    const data = json.data
    if (!data?.access_token) {
      return redirect('/dashboard/integrations?zerodha=error&reason=no_access_token', req)
    }

    await prisma.zerodhaConnection.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: data.access_token,
        kiteUserId: data.user_id ?? null,
        userName: data.user_name ?? null,
      },
      update: {
        accessToken: data.access_token,
        kiteUserId: data.user_id ?? null,
        userName: data.user_name ?? null,
      },
    })

    const res = redirect('/dashboard/integrations?zerodha=connected', req)
    res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return res
  } catch (err) {
    console.error('[zerodha/callback]', err)
    return redirect('/dashboard/integrations?zerodha=error&reason=exception', req)
  }
}
