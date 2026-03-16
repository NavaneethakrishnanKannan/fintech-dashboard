import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

const LIMIT_80C = 150_000 // ₹1.5L per financial year

/** India: Section 80C limit (₹1.5L), potential tax saving, ELSS/PPF suggestions. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const investments = await prisma.investment.findMany({
    where: { userId },
    select: { name: true, type: true, category: true },
  })

  const elssLike = investments.filter(
    (inv) =>
      (inv.name && /elss|tax.?sav|80c/i.test(inv.name)) ||
      (inv.category && /elss|equity/i.test(inv.category)) ||
      inv.type === 'MUTUAL_FUND'
  )
  const hasEquityMf = elssLike.length > 0
  const used80C = 0
  const remaining80C = Math.max(0, LIMIT_80C - used80C)
  const potentialSaving30 = Math.round((remaining80C * 0.3))
  const potentialSaving20 = Math.round((remaining80C * 0.2))

  const suggestions: string[] = []
  if (remaining80C > 0) {
    suggestions.push(`Remaining 80C limit: ₹${remaining80C.toLocaleString('en-IN')} this financial year.`)
    suggestions.push(`Potential tax saving (30% slab): up to ₹${potentialSaving30.toLocaleString('en-IN')} if you utilise the full limit.`)
    suggestions.push(`ELSS funds offer equity exposure with 80C deduction and 3-year lock-in.`)
    suggestions.push(`PPF offers tax-free returns and 80C deduction; max ₹1.5L per year.`)
  } else {
    suggestions.push(`You've utilised the 80C limit (₹${LIMIT_80C.toLocaleString('en-IN')}) for this year.`)
  }

  return NextResponse.json({
    limit80C: LIMIT_80C,
    used80C,
    remaining80C,
    potentialTaxSaving30: potentialSaving30,
    potentialTaxSaving20: potentialSaving20,
    suggestions,
    hasEquityMf,
  })
}
