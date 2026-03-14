import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'
import {
  fetchKiteHoldings,
  fetchKiteMfHoldings,
  fetchKiteMfSips,
  zerodhaSummaryFromHoldings,
  zerodhaSummaryFromMfHoldings,
} from '@/lib/zerodha'

const KITE_API_KEY = process.env.KITE_API_KEY

/** Fetch Zerodha equity + MF holdings and MF SIPs. Returns 401 if not connected or token invalid. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!KITE_API_KEY) return NextResponse.json({ error: 'Zerodha not configured' }, { status: 503 })

  const conn = await prisma.zerodhaConnection.findUnique({ where: { userId } })
  if (!conn) return NextResponse.json({ error: 'Zerodha not connected' }, { status: 401 })

  try {
    const [equityRes, mfRes, sipsRes] = await Promise.all([
      fetchKiteHoldings(KITE_API_KEY, conn.accessToken).catch(() => ({ data: [] })),
      fetchKiteMfHoldings(KITE_API_KEY, conn.accessToken).catch(() => ({ data: [] })),
      fetchKiteMfSips(KITE_API_KEY, conn.accessToken).catch(() => ({ data: [] })),
    ])

    const equityHoldings = equityRes.data ?? []
    const mfHoldings = mfRes.data ?? []
    const sips = Array.isArray(sipsRes.data) ? sipsRes.data : []

    const equitySummary = zerodhaSummaryFromHoldings(equityHoldings)
    const mfSummary = zerodhaSummaryFromMfHoldings(mfHoldings)
    const totalValue = equitySummary.totalValue + mfSummary.totalValue
    const totalSipMonthly =
      sips
        .filter((s) => s.status === 'ACTIVE')
        .reduce((sum, s) => {
          if (s.frequency === 'monthly') return sum + (s.instalment_amount || 0)
          if (s.frequency === 'weekly') return sum + (s.instalment_amount || 0) * 4.33
          if (s.frequency === 'quarterly') return sum + (s.instalment_amount || 0) / 3
          return sum
        }, 0) || 0

    return NextResponse.json({
      totalValue,
      equityValue: equitySummary.totalValue,
      mfValue: mfSummary.totalValue,
      totalSipMonthly,
      bySymbol: equitySummary.bySymbol,
      mfByFund: mfSummary.byFund,
      holdings: equityHoldings.map((h) => ({
        tradingsymbol: h.tradingsymbol,
        exchange: h.exchange,
        quantity: h.quantity,
        average_price: h.average_price,
        last_price: h.last_price,
        pnl: h.pnl,
        value: h.quantity * (h.last_price || h.average_price),
      })),
      mfHoldings: mfHoldings.map((h) => ({
        fund: h.fund,
        tradingsymbol: h.tradingsymbol,
        quantity: h.quantity,
        average_price: h.average_price,
        last_price: h.last_price,
        pnl: h.pnl,
        value: h.quantity * (h.last_price || h.average_price),
      })),
      sips: sips.filter((s) => s.status === 'ACTIVE').map((s) => ({
        fund: s.fund,
        instalment_amount: s.instalment_amount,
        frequency: s.frequency,
        next_instalment: s.next_instalment,
        tag: s.tag,
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch holdings'
    if (msg.includes('Token expired') || msg.includes('401')) {
      return NextResponse.json({ error: 'Session expired. Please reconnect Zerodha.', code: 'TOKEN_EXPIRED' }, { status: 401 })
    }
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
