import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

/** FV = PV*(1+r)^n + SIP*(((1+r)^n - 1)/r) per year; SIP in monthly, so annual SIP = monthlySip*12 */
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const monthlySip = Number(body.monthlySip) || 0
  const expectedAnnualReturn = Number(body.expectedAnnualReturn) || 0
  const years = Math.min(Math.max(1, Math.floor(Number(body.years) || 10)), 50)
  const initialValueOverride = body.initialValue != null ? Number(body.initialValue) : null

  let pv: number
  if (initialValueOverride != null && initialValueOverride >= 0) {
    pv = initialValueOverride
  } else {
    const investments = await prisma.investment.findMany({ where: { userId } })
    pv = investments.reduce((s, inv) => {
      const curr = inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.buyPrice + inv.profit
      return s + curr
    }, 0)
  }

  const r = expectedAnnualReturn / 100
  const annualSip = monthlySip * 12
  const timeline: { year: number; value: number }[] = []
  let value = pv
  for (let y = 1; y <= years; y++) {
    value = value * (1 + r) + annualSip
    timeline.push({ year: y, value: Math.round(value * 100) / 100 })
  }

  return NextResponse.json({ timeline, initialValue: pv })
}
