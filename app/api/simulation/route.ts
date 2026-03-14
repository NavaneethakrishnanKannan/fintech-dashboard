import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'
import { simulateScenario } from '@/lib/simulation'

function currentInvValue(inv: { quantity: number; buyPrice: number; profit: number; currentPrice: number | null }) {
  return inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.buyPrice + inv.profit
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

  if (!salary || !expenses) {
    const [incomes, expensesRows, loans, investments] = await Promise.all([
      prisma.income.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId } }),
      prisma.loan.findMany({ where: { userId } }),
      prisma.investment.findMany({ where: { userId } }),
    ])
    if (salary === 0) salary = incomes.reduce((s, i) => s + Number(i.amount), 0) || 1
    if (expenses === 0) expenses = expensesRows.reduce((s, e) => s + Number(e.amount), 0)
    if (emi === 0) emi = loans.reduce((s, l) => s + Number(l.emi), 0)
    const pv = investments.reduce((s, inv) => s + currentInvValue(inv), 0)
    if (sip === 0 && pv > 0) sip = pv / 120
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
