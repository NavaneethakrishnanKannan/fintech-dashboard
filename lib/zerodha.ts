import { createHash } from 'crypto'

const KITE_API_BASE = 'https://api.kite.trade'
const KITE_LOGIN_URL = 'https://kite.zerodha.com/connect/login'

/** Redirect URL must be set in Kite developer console to: NEXTAUTH_URL/api/zerodha/callback */
export function getKiteLoginUrl(): string {
  const apiKey = process.env.KITE_API_KEY
  if (!apiKey) throw new Error('KITE_API_KEY is not set')
  const params = new URLSearchParams({ v: '3', api_key: apiKey })
  return `${KITE_LOGIN_URL}?${params.toString()}`
}

export function exchangeRequestToken(requestToken: string): { apiKey: string; secret: string } {
  const apiKey = process.env.KITE_API_KEY
  const secret = process.env.KITE_API_SECRET
  if (!apiKey || !secret) throw new Error('KITE_API_KEY or KITE_API_SECRET is not set')
  return { apiKey, secret }
}

export function checksum(apiKey: string, requestToken: string, apiSecret: string): string {
  return createHash('sha256').update(apiKey + requestToken + apiSecret).digest('hex')
}

export type KiteHolding = {
  tradingsymbol: string
  exchange: string
  quantity: number
  average_price: number
  last_price: number
  pnl: number
  product: string
}

export type KiteHoldingsResponse = { status: string; data?: KiteHolding[] }

export async function fetchKiteHoldings(apiKey: string, accessToken: string): Promise<KiteHoldingsResponse> {
  const res = await fetch(`${KITE_API_BASE}/portfolio/holdings`, {
    headers: {
      'X-Kite-Version': '3',
      Authorization: `token ${apiKey}:${accessToken}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 401 || res.status === 403 || /TokenException|access_token|api_key|Incorrect/.test(text)) {
      throw new Error('Session expired')
    }
    throw new Error(`Kite API error (${res.status})`)
  }
  return res.json() as Promise<KiteHoldingsResponse>
}

export function zerodhaSummaryFromHoldings(holdings: KiteHolding[]): { totalValue: number; bySymbol: { symbol: string; value: number; pnl: number }[] } {
  const bySymbol = holdings.map((h) => {
    const value = h.quantity * (h.last_price || h.average_price)
    return { symbol: h.tradingsymbol, value, pnl: h.pnl || 0 }
  })
  const totalValue = bySymbol.reduce((s, x) => s + x.value, 0)
  return { totalValue, bySymbol }
}

// --- Mutual funds (Coin) ---

export type KiteMfHolding = {
  folio: string | null
  fund: string
  tradingsymbol: string
  average_price: number
  last_price: number
  quantity: number
  pnl: number
  last_price_date?: string
}

export type KiteMfHoldingsResponse = { status: string; data?: KiteMfHolding[] }

export async function fetchKiteMfHoldings(apiKey: string, accessToken: string): Promise<KiteMfHoldingsResponse> {
  const res = await fetch(`${KITE_API_BASE}/mf/holdings`, {
    headers: {
      'X-Kite-Version': '3',
      Authorization: `token ${apiKey}:${accessToken}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 401 || res.status === 403 || /TokenException|access_token|api_key|Incorrect/.test(text)) {
      throw new Error('Session expired')
    }
    throw new Error(`Kite MF API error (${res.status})`)
  }
  return res.json() as Promise<KiteMfHoldingsResponse>
}

export type KiteMfSip = {
  sip_id: string
  fund: string
  tradingsymbol: string
  status: string
  frequency: string
  instalment_amount: number
  next_instalment: string
  instalments: number
  pending_instalments: number
  tag?: string
}

export type KiteMfSipsResponse = { status?: string; data?: KiteMfSip[] }

export async function fetchKiteMfSips(apiKey: string, accessToken: string): Promise<KiteMfSipsResponse> {
  const res = await fetch(`${KITE_API_BASE}/mf/sips`, {
    headers: {
      'X-Kite-Version': '3',
      Authorization: `token ${apiKey}:${accessToken}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 401 || res.status === 403 || /TokenException|access_token|api_key|Incorrect/.test(text)) {
      throw new Error('Session expired')
    }
    throw new Error(`Kite MF SIP API error (${res.status})`)
  }
  return res.json() as Promise<KiteMfSipsResponse>
}

export function zerodhaSummaryFromMfHoldings(holdings: KiteMfHolding[]): { totalValue: number; byFund: { fund: string; value: number; pnl: number }[] } {
  const byFund = holdings.map((h) => {
    const value = h.quantity * (h.last_price || h.average_price)
    return { fund: h.fund, value, pnl: h.pnl || 0 }
  })
  const totalValue = byFund.reduce((s, x) => s + x.value, 0)
  return { totalValue, byFund }
}
