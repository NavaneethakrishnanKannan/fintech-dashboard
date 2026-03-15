import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'
import { fetchKiteHoldings, fetchKiteMfHoldings } from '@/lib/zerodha'

const KITE_API_KEY = process.env.KITE_API_KEY
const MANUAL_ONLY_TYPES = ['CHIT_FUND', 'ETF', 'CRYPTO', 'OTHER'] as const

function currentValue(inv: { quantity: number; buyPrice: number; profit: number; currentPrice: number | null }) {
  if (inv.currentPrice != null) return inv.quantity * inv.currentPrice
  return inv.buyPrice + inv.profit
}

function investedValue(inv: { quantity: number; buyPrice: number }) {
  return inv.quantity * inv.buyPrice
}

/** Combined portfolio: Zerodha (when connected) + manual. Chit fund and other manual-only types always from DB. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const investments = await prisma.investment.findMany({
    where: { userId },
    include: { goal: { select: { id: true, title: true } } },
  })
  const zerodhaConn = await prisma.zerodhaConnection.findUnique({ where: { userId } })

  let zerodhaConnected = false
  let zerodhaError: string | null = null
  let equityZerodha: { symbol: string; quantity: number; invested: number; value: number; pnl: number }[] = []
  let mfZerodha: { fund: string; quantity: number; invested: number; value: number; pnl: number }[] = []

  if (KITE_API_KEY && zerodhaConn) {
    try {
      const [eqRes, mfRes] = await Promise.all([
        fetchKiteHoldings(KITE_API_KEY, zerodhaConn.accessToken),
        fetchKiteMfHoldings(KITE_API_KEY, zerodhaConn.accessToken),
      ])
      zerodhaConnected = true
      const eqData = eqRes.data ?? []
      const mfData = mfRes.data ?? []
      equityZerodha = eqData.map((h) => {
        const inv = h.quantity * h.average_price
        const val = h.quantity * (h.last_price || h.average_price)
        return {
          symbol: h.tradingsymbol,
          quantity: h.quantity,
          invested: inv,
          value: val,
          pnl: h.pnl ?? val - inv,
        }
      })
      mfZerodha = mfData.map((h) => {
        const inv = h.quantity * h.average_price
        const val = h.quantity * (h.last_price || h.average_price)
        return {
          fund: h.fund,
          quantity: h.quantity,
          invested: inv,
          value: val,
          pnl: h.pnl ?? val - inv,
        }
      })
    } catch (e) {
      zerodhaError = e instanceof Error ? e.message : 'Zerodha fetch failed'
    }
  }

  const useZerodhaForEquityMf = zerodhaConnected && zerodhaError == null
  const manualOnlyInvestments = investments.filter((inv) =>
    MANUAL_ONLY_TYPES.includes(inv.type as (typeof MANUAL_ONLY_TYPES)[number])
  )
  const manualEquityMf = useZerodhaForEquityMf
    ? []
    : investments.filter((inv) => inv.type === 'STOCK' || inv.type === 'MUTUAL_FUND')

  let totalInvested = 0
  let totalCurrentValue = 0
  const byType: Record<string, number> = {}
  const bySector: Record<string, number> = {}
  const byCategory: Record<string, number> = {}

  if (useZerodhaForEquityMf) {
    equityZerodha.forEach((h) => {
      totalInvested += h.invested
      totalCurrentValue += h.value
      byType['STOCK'] = (byType['STOCK'] ?? 0) + h.value
      bySector['Zerodha Equity'] = (bySector['Zerodha Equity'] ?? 0) + h.value
      byCategory['equity'] = (byCategory['equity'] ?? 0) + h.value
    })
    mfZerodha.forEach((h) => {
      totalInvested += h.invested
      totalCurrentValue += h.value
      byType['MUTUAL_FUND'] = (byType['MUTUAL_FUND'] ?? 0) + h.value
      bySector['Zerodha MF (Coin)'] = (bySector['Zerodha MF (Coin)'] ?? 0) + h.value
      byCategory['mutual_fund'] = (byCategory['mutual_fund'] ?? 0) + h.value
    })
  }

  ;[...manualEquityMf, ...manualOnlyInvestments].forEach((inv) => {
    const invVal = investedValue(inv)
    const val = currentValue(inv)
    totalInvested += invVal
    totalCurrentValue += val
    byType[inv.type] = (byType[inv.type] ?? 0) + val
    const sector = inv.sector ?? 'Unknown'
    bySector[sector] = (bySector[sector] ?? 0) + val
    const cat = inv.category ?? 'Other'
    byCategory[cat] = (byCategory[cat] ?? 0) + val
  })

  const totalPnl = totalCurrentValue - totalInvested
  const pnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const allocationByAsset = Object.entries(byType).map(([name, value]) => ({ name, value }))
  const allocationBySector = Object.entries(bySector).map(([name, value]) => ({ name, value }))
  const allocationByCategory = Object.entries(byCategory).map(([name, value]) => ({ name, value }))

  type HoldingRow = {
    source: 'zerodha' | 'manual'
    id?: string
    name: string
    type: string
    quantity: number
    invested: number
    value: number
    pnl: number
    monthlySip?: number | null
    buyDate?: string
    goalId?: string | null
    goalTitle?: string | null
  }

  const holdings: HoldingRow[] = []

  if (useZerodhaForEquityMf) {
    equityZerodha.forEach((h) => {
      holdings.push({
        source: 'zerodha',
        name: h.symbol,
        type: 'STOCK',
        quantity: h.quantity,
        invested: h.invested,
        value: h.value,
        pnl: h.pnl,
      })
    })
    mfZerodha.forEach((h) => {
      holdings.push({
        source: 'zerodha',
        name: h.fund,
        type: 'MUTUAL_FUND',
        quantity: h.quantity,
        invested: h.invested,
        value: h.value,
        pnl: h.pnl,
      })
    })
  }

  manualOnlyInvestments.forEach((inv) => {
    const invVal = investedValue(inv)
    const val = currentValue(inv)
    holdings.push({
      source: 'manual',
      id: inv.id,
      name: inv.name,
      type: inv.type,
      quantity: inv.quantity,
      invested: invVal,
      value: val,
      pnl: val - invVal,
      monthlySip: inv.monthlySip,
      buyDate: inv.buyDate.toISOString().slice(0, 10),
      goalId: inv.goalId ?? undefined,
      goalTitle: inv.goal?.title ?? undefined,
    })
  })

  manualEquityMf.forEach((inv) => {
    const invVal = investedValue(inv)
    const val = currentValue(inv)
    holdings.push({
      source: 'manual',
      id: inv.id,
      name: inv.name,
      type: inv.type,
      quantity: inv.quantity,
      invested: invVal,
      value: val,
      pnl: val - invVal,
      monthlySip: inv.monthlySip,
      buyDate: inv.buyDate.toISOString().slice(0, 10),
      goalId: inv.goalId ?? undefined,
      goalTitle: inv.goal?.title ?? undefined,
    })
  })

  return NextResponse.json({
    zerodhaConnected,
    zerodhaError,
    summary: {
      totalInvested,
      totalCurrentValue,
      totalPnl,
      pnlPercent,
      cagr: null,
      allocationByAsset,
      allocationBySector,
      allocationByCategory,
    },
    holdings,
    manualInvestments: investments,
  })
}
