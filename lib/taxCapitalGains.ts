import { prisma } from '@/lib/prisma'
import {
  fetchKiteHoldings,
  fetchKiteMfHoldings,
  fetchKiteMfSips,
  type KiteHolding,
  type KiteMfHolding,
  type KiteMfSip,
} from '@/lib/zerodha'

const LTCG_DAYS = 365
const EQUITY_TYPES = ['STOCK', 'MUTUAL_FUND', 'ETF']
const MANUAL_ONLY_TYPES = ['CHIT_FUND', 'ETF', 'CRYPTO', 'OTHER'] as const

/** Days per instalment by SIP frequency (for approximate holding period). */
function daysPerInstalment(frequency: string): number {
  const f = (frequency || '').toLowerCase()
  if (f === 'weekly') return 7
  if (f === 'monthly') return 30
  if (f === 'quarterly') return 90
  return 30
}

/** Approximate holding days from SIP: completed instalments × days per instalment (conservative: treat as first instalment date). */
function approxHoldingDaysFromSip(sip: KiteMfSip): number {
  const completed = Math.max(0, (sip.instalments || 0) - (sip.pending_instalments || 0))
  return completed * daysPerInstalment(sip.frequency)
}

export type TaxHolding = {
  name: string
  type: string
  buyDate: string
  holdingDays: number
  bucket: 'LTCG' | 'STCG' | '—'
  /** True when bucket is derived from Zerodha SIP (no purchase date from API). */
  bucketApprox?: boolean
  cost: number
  value: number
  gain: number
  source: 'zerodha' | 'manual'
}

export type TaxCapitalGainsResult = {
  byHolding: TaxHolding[]
  ltcg: number
  stcg: number
  /** Sum of all gains (includes Zerodha when connected); for summary display. */
  totalGain: number
}

/** Uses Zerodha holdings when connected and valid; otherwise uses saved investments. */
export async function getTaxCapitalGains(userId: string): Promise<TaxCapitalGainsResult> {
  const investments = await prisma.investment.findMany({
    where: { userId },
  })
  const zerodhaConn = await prisma.zerodhaConnection.findUnique({ where: { userId } })
  const KITE_API_KEY = process.env.KITE_API_KEY

  let zerodhaOk = false
  let equityHoldings: KiteHolding[] = []
  let mfHoldings: KiteMfHolding[] = []
  let mfSips: KiteMfSip[] = []

  if (KITE_API_KEY && zerodhaConn) {
    try {
      const [eqRes, mfRes, sipsRes] = await Promise.all([
        fetchKiteHoldings(KITE_API_KEY, zerodhaConn.accessToken),
        fetchKiteMfHoldings(KITE_API_KEY, zerodhaConn.accessToken),
        fetchKiteMfSips(KITE_API_KEY, zerodhaConn.accessToken),
      ])
      zerodhaOk = true
      equityHoldings = eqRes.data ?? []
      mfHoldings = mfRes.data ?? []
      mfSips = (sipsRes.data ?? []).filter((s) => (s.status || '').toUpperCase() === 'ACTIVE')
    } catch {
      // use saved data
    }
  }

  /** Normalize fund name for matching: strip common suffixes, lowercase. */
  function normalizeFundName(s: string): string {
    return (s || '')
      .trim()
      .toLowerCase()
      .replace(/\s*-\s*(growth|idcw|dividend|payout|direct|regular|plan)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim()
  }
  const sipByFund = new Map<string, KiteMfSip>()
  for (const sip of mfSips) {
    const key = normalizeFundName(sip.fund || sip.tradingsymbol || '')
    if (key && !sipByFund.has(key)) sipByFund.set(key, sip)
  }
  function findSipForHolding(fund: string): KiteMfSip | undefined {
    const key = normalizeFundName(fund)
    if (!key) return undefined
    if (sipByFund.has(key)) return sipByFund.get(key)
    for (const [sipKey, sip] of Array.from(sipByFund.entries())) {
      if (key.includes(sipKey) || sipKey.includes(key)) return sip
    }
    return undefined
  }

  const now = new Date()
  const byHolding: TaxHolding[] = []
  let ltcg = 0
  let stcg = 0

  if (zerodhaOk) {
    for (const h of equityHoldings) {
      const cost = h.quantity * h.average_price
      const value = h.quantity * (h.last_price || h.average_price)
      const gain = h.pnl ?? value - cost
      stcg += gain
      byHolding.push({
        name: h.tradingsymbol,
        type: 'STOCK',
        buyDate: '—',
        holdingDays: 0,
        bucket: 'STCG',
        bucketApprox: true,
        cost,
        value,
        gain,
        source: 'zerodha',
      })
    }
    for (const h of mfHoldings) {
      const cost = h.quantity * h.average_price
      const value = h.quantity * (h.last_price || h.average_price)
      const gain = h.pnl ?? value - cost
      const sip = findSipForHolding(h.fund)
      let bucket: 'LTCG' | 'STCG' | '—' = '—'
      let holdingDays = 0
      let bucketApprox = false
      if (sip) {
        holdingDays = approxHoldingDaysFromSip(sip)
        bucket = holdingDays >= LTCG_DAYS ? 'LTCG' : 'STCG'
        bucketApprox = true
        if (bucket === 'LTCG') ltcg += gain
        else stcg += gain
      } else {
        bucket = 'STCG'
        bucketApprox = true
        stcg += gain
      }
      byHolding.push({
        name: h.fund,
        type: 'MUTUAL_FUND',
        buyDate: sip ? 'SIP approx' : '—',
        holdingDays,
        bucket,
        bucketApprox: bucketApprox ? true : undefined,
        cost,
        value,
        gain,
        source: 'zerodha',
      })
    }
    const manualOnly = investments.filter((inv) =>
      MANUAL_ONLY_TYPES.includes(inv.type as (typeof MANUAL_ONLY_TYPES)[number])
    )
    for (const inv of manualOnly) {
      const cost = inv.quantity * inv.buyPrice
      const value = inv.currentPrice != null ? inv.quantity * inv.currentPrice : cost + inv.profit
      const gain = value - cost
      const buyDate = new Date(inv.buyDate)
      const holdingDays = Math.floor((now.getTime() - buyDate.getTime()) / (24 * 60 * 60 * 1000))
      const isEquity = EQUITY_TYPES.includes(inv.type) || inv.category === 'equity'
      const bucket = isEquity && holdingDays >= LTCG_DAYS ? 'LTCG' : 'STCG'
      if (gain > 0) {
        if (bucket === 'LTCG') ltcg += gain
        else stcg += gain
      }
      byHolding.push({
        name: inv.name,
        type: inv.type,
        buyDate: inv.buyDate.toISOString().slice(0, 10),
        holdingDays,
        bucket,
        cost,
        value,
        gain,
        source: 'manual',
      })
    }
  } else {
    for (const inv of investments) {
      const cost = inv.quantity * inv.buyPrice
      const value = inv.currentPrice != null ? inv.quantity * inv.currentPrice : cost + inv.profit
      const gain = value - cost
      const buyDate = new Date(inv.buyDate)
      const holdingDays = Math.floor((now.getTime() - buyDate.getTime()) / (24 * 60 * 60 * 1000))
      const isEquity = EQUITY_TYPES.includes(inv.type) || inv.category === 'equity'
      const bucket = isEquity && holdingDays >= LTCG_DAYS ? 'LTCG' : 'STCG'
      if (gain > 0) {
        if (bucket === 'LTCG') ltcg += gain
        else stcg += gain
      }
      byHolding.push({
        name: inv.name,
        type: inv.type,
        buyDate: inv.buyDate.toISOString().slice(0, 10),
        holdingDays,
        bucket,
        cost,
        value,
        gain,
        source: 'manual',
      })
    }
  }

  byHolding.sort((a, b) => b.gain - a.gain)
  const totalGain = byHolding.reduce((s, h) => s + h.gain, 0)
  return {
    byHolding,
    ltcg: Math.round(ltcg * 100) / 100,
    stcg: Math.round(stcg * 100) / 100,
    totalGain: Math.round(totalGain * 100) / 100,
  }
}
