import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

/** Yearly wealth projection by age. Optional salary growth increases annual SIP each year. */
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const currentAge = Math.min(60, Math.max(18, parseInt(searchParams.get('currentAge') || '30', 10)))
  const currentNetWorth = parseFloat(searchParams.get('currentNetWorth') || '0') || 0
  const monthlyInvestment = parseFloat(searchParams.get('monthlyInvestment') || '0') || 0
  const expectedReturn = parseFloat(searchParams.get('expectedReturn') || '10') || 0
  const salaryGrowthPercent = parseFloat(searchParams.get('salaryGrowthPercent') || '0') || 0

  const r = expectedReturn / 100
  const salaryGrowth = salaryGrowthPercent / 100
  const maxYears = Math.min(45, 70 - currentAge)
  const projections: { age: number; value: number; year: number }[] = []
  let nw = currentNetWorth
  let annualSip = monthlyInvestment * 12

  for (let y = 0; y <= maxYears; y++) {
    const age = currentAge + y
    if (y > 0) {
      nw = nw * (1 + r) + annualSip
      annualSip = annualSip * (1 + salaryGrowth)
    }
    projections.push({
      age,
      value: Math.round(nw * 100) / 100,
      year: y,
    })
  }

  return NextResponse.json({
    currentAge,
    initialNetWorth: currentNetWorth,
    projections,
  })
}

/** POST with body or use user's data for initial net worth. */
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  let currentNetWorth: number | null = body.currentNetWorth != null ? Number(body.currentNetWorth) : null
  if (currentNetWorth == null && body.useMyData) {
    // Prefer latest net worth from history so timeline projection aligns with past (same source as timeline chart)
    const latestHistory = await prisma.netWorthHistory.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { netWorth: true },
    })
    if (latestHistory != null && Number(latestHistory.netWorth) > 0) {
      currentNetWorth = Number(latestHistory.netWorth)
    } else {
      const [investments, incomes, expenses, loans] = await Promise.all([
        prisma.investment.findMany({ where: { userId } }),
        prisma.income.findMany({ where: { userId } }),
        prisma.expense.findMany({ where: { userId } }),
        prisma.loan.findMany({ where: { userId } }),
      ])
      const invValue = investments.reduce((s, inv) => {
        const v = inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.buyPrice + inv.profit
        return s + v
      }, 0)
      const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
      const totalEmi = loans.reduce((s, l) => s + Number(l.emi), 0)
      const monthlySavings = totalIncome - totalExpenses - totalEmi
      const loanPrincipal = loans.reduce((s, l) => s + Number(l.principal), 0)
      currentNetWorth = invValue + monthlySavings * 6 - loanPrincipal
      currentNetWorth = Math.max(0, currentNetWorth)
    }
  }
  if (currentNetWorth == null) currentNetWorth = 0

  const currentAge = Math.min(60, Math.max(18, Number(body.currentAge) || 30))
  const monthlyInvestment = Number(body.monthlyInvestment) || 0
  const expectedReturn = Number(body.expectedReturn) || 10
  const salaryGrowthPercent = Number(body.salaryGrowthPercent) || 0

  const r = expectedReturn / 100
  const salaryGrowth = salaryGrowthPercent / 100
  const maxYears = Math.min(45, 70 - currentAge)
  const projections: { age: number; value: number; year: number }[] = []
  let nw = currentNetWorth
  let annualSip = monthlyInvestment * 12

  for (let y = 0; y <= maxYears; y++) {
    const age = currentAge + y
    if (y > 0) {
      nw = nw * (1 + r) + annualSip
      annualSip = annualSip * (1 + salaryGrowth)
    }
    projections.push({
      age,
      value: Math.round(nw * 100) / 100,
      year: y,
    })
  }

  return NextResponse.json({
    currentAge,
    initialNetWorth: currentNetWorth,
    projections,
  })
}
