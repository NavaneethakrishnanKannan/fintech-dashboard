import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

function remainingPrincipalAfterPayments(
  principal: number,
  annualRatePct: number,
  emi: number,
  monthsPaid: number,
): number {
  if (monthsPaid <= 0) return principal
  const r = annualRatePct / 100 / 12
  if (r <= 0) return Math.max(0, principal - emi * monthsPaid)
  const factor = Math.pow(1 + r, monthsPaid)
  const balance = principal * factor - emi * ((factor - 1) / r)
  return Math.max(0, Math.round(balance * 100) / 100)
}

function currentInvValue(inv: { quantity: number; buyPrice: number; profit: number; currentPrice: number | null }) {
  return inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.buyPrice + inv.profit
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = req.nextUrl.searchParams
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)))

  const history = await prisma.netWorthHistory.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: limit,
  })
  return NextResponse.json(history.reverse())
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [investments, expenses, incomes, loansRaw] = await Promise.all([
    prisma.investment.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
  ])

  const assets = investments.reduce((s, inv) => s + currentInvValue(inv), 0)
  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalEmi = loansRaw.reduce((s, l) => s + Number(l.emi), 0)
  const totalExpensesIncludingEmi = totalExpenses + totalEmi
  const monthlySavings = totalIncome - totalExpensesIncludingEmi

  const loans = loansRaw.map((l) => {
    const monthsPaid = l.totalTenureMonths != null ? l.totalTenureMonths - l.tenure : 0
    const remainingPrincipal =
      monthsPaid > 0 && l.totalTenureMonths != null
        ? remainingPrincipalAfterPayments(Number(l.principal), Number(l.interest), Number(l.emi), monthsPaid)
        : Number(l.principal) || 0
    return { ...l, remainingPrincipal }
  })
  const totalLoanPrincipal = loans.reduce((s, l) => s + (l.remainingPrincipal ?? Number(l.principal) ?? 0), 0)
  const homeLoans = loans.filter((l) => (l.name ?? '').toLowerCase().includes('home'))
  const totalHomeAssetValue = homeLoans.reduce((s, l) => s + (Number(l.principal) || 0), 0)

  // Same formula as /api/summary so card and chart match
  const netWorth = assets + monthlySavings * 12 - totalLoanPrincipal + totalHomeAssetValue
  const liabilities = totalLoanPrincipal
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  const existing = await prisma.netWorthHistory.findFirst({
    where: { userId, date: { gte: date, lt: new Date(date.getTime() + 24 * 60 * 60 * 1000) } },
  })
  if (existing) {
    await prisma.netWorthHistory.update({
      where: { id: existing.id },
      data: { assets, liabilities, netWorth },
    })
    return NextResponse.json({ ...existing, assets, liabilities, netWorth })
  }

  const record = await prisma.netWorthHistory.create({
    data: { userId, date, assets, liabilities, netWorth },
  })
  return NextResponse.json(record)
}
