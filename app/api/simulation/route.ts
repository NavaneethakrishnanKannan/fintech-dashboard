import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'
import { simulateScenario } from '@/lib/simulation'

function currentInvValue(inv: { quantity: number; buyPrice: number; profit: number; currentPrice: number | null }) {
  return inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.buyPrice + inv.profit
}

/** GET: return user's data for scenario inputs (salary, emi, sip, expenses) so the UI can pre-fill "Use my data". */
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const [incomes, loans, investments, expensesThisMonth] = await Promise.all([
    prisma.income.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.investment.findMany({ where: { userId } }),
    prisma.expense.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd } },
    }),
  ])

  const salary = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const emi = loans.reduce((s, l) => s + Number(l.emi), 0)
  const sip = investments.reduce((s, inv) => s + Number(inv.monthlySip || 0), 0)
  const expenses = expensesThisMonth.reduce((s, e) => s + Number(e.amount), 0)

  return NextResponse.json({
    salary: salary || 0,
    emi: emi || 0,
    sip: sip || 0,
    expenses: expenses || 0,
  })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  let salary = Number(body.salary)
  let emi = Number(body.emi)
  let sip = Number(body.sip)
  let expenses = Number(body.expenses)
  const years = Math.min(30, Math.max(1, Math.floor(Number(body.years) || 10)))
  const marketReturn = body.marketReturn != null ? Number(body.marketReturn) : null
  const loanPrepayment = Number(body.loanPrepayment) || 0

  const useDataForSalary = salary === 0
  const useDataForExpenses = expenses === 0
  const useDataForEmi = emi === 0
  const useDataForSip = sip === 0
  if (useDataForSalary || useDataForExpenses || useDataForEmi || useDataForSip) {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const [incomes, expensesThisMonth, loans, investments] = await Promise.all([
      prisma.income.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId, date: { gte: monthStart, lte: monthEnd } } }),
      prisma.loan.findMany({ where: { userId } }),
      prisma.investment.findMany({ where: { userId } }),
    ])
    if (useDataForSalary) salary = incomes.reduce((s, i) => s + Number(i.amount), 0) || 1
    if (useDataForExpenses) expenses = expensesThisMonth.reduce((s, e) => s + Number(e.amount), 0)
    if (useDataForEmi) emi = loans.reduce((s, l) => s + Number(l.emi), 0)
    const totalMonthlySip = investments.reduce((s, inv) => s + Number(inv.monthlySip || 0), 0)
    if (useDataForSip) sip = totalMonthlySip > 0 ? totalMonthlySip : investments.reduce((s, inv) => s + currentInvValue(inv), 0) / 120
  }

  const effectiveEmi = Math.max(0, emi - loanPrepayment)
  const result = simulateScenario(salary, effectiveEmi, sip, expenses, years)

  const r = marketReturn != null ? marketReturn / 100 : 0.08
  const timeline: { year: number; value: number }[] = []
  let value = 0
  for (let y = 1; y <= years; y++) {
    const annualSavings = (salary - effectiveEmi - expenses) * 12
    value = (value + sip * 12 + annualSavings) * (1 + r)
    timeline.push({ year: y, value: Math.round(value * 100) / 100 })
  }

  return NextResponse.json({
    ...result,
    timeline,
  })
}
