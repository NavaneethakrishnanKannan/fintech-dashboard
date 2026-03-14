import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

function currentValue(inv: { quantity: number; buyPrice: number; profit: number; currentPrice: number | null }) {
  if (inv.currentPrice != null) return inv.quantity * inv.currentPrice
  return inv.buyPrice + inv.profit
}

function investedValue(inv: { quantity: number; buyPrice: number }) {
  return inv.quantity * inv.buyPrice
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const investments = await prisma.investment.findMany({ where: { userId } })

  const totalInvested = investments.reduce((s, inv) => s + investedValue(inv), 0)
  const totalCurrentValue = investments.reduce((s, inv) => s + currentValue(inv), 0)
  const totalPnl = totalCurrentValue - totalInvested
  const pnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  const searchParams = req.nextUrl.searchParams
  const yearFrom = searchParams.get('yearFrom') ? parseInt(searchParams.get('yearFrom')!, 10) : null
  const yearTo = searchParams.get('yearTo') ? parseInt(searchParams.get('yearTo')!, 10) : null

  let cagr: number | null = null
  if (yearFrom != null && yearTo != null && yearTo > yearFrom && totalInvested > 0) {
    const years = yearTo - yearFrom
    cagr = (Math.pow(totalCurrentValue / totalInvested, 1 / years) - 1) * 100
  }

  const byType: Record<string, number> = {}
  const bySector: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  for (const inv of investments) {
    const val = currentValue(inv)
    byType[inv.type] = (byType[inv.type] ?? 0) + val
    const sector = inv.sector ?? 'Unknown'
    bySector[sector] = (bySector[sector] ?? 0) + val
    const cat = inv.category ?? 'Other'
    byCategory[cat] = (byCategory[cat] ?? 0) + val
  }

  const allocationByAsset = Object.entries(byType).map(([name, value]) => ({ name, value }))
  const allocationBySector = Object.entries(bySector).map(([name, value]) => ({ name, value }))
  const allocationByCategory = Object.entries(byCategory).map(([name, value]) => ({ name, value }))

  return NextResponse.json({
    totalInvested,
    totalCurrentValue,
    totalPnl,
    pnlPercent,
    cagr,
    allocationByAsset,
    allocationBySector,
    allocationByCategory,
  })
}
