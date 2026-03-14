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

/** Recompute netWorth for all history records so they use the same formula as the summary (includes home asset value). */
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [incomes, expenses, loansRaw] = await Promise.all([
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
  ])

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalEmi = loansRaw.reduce((s, l) => s + Number(l.emi), 0)
  const monthlySavings = totalIncome - totalExpenses - totalEmi

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

  const records = await prisma.netWorthHistory.findMany({ where: { userId } })
  let updated = 0
  for (const rec of records) {
    const newNetWorth =
      rec.assets + monthlySavings * 12 - rec.liabilities + totalHomeAssetValue
    await prisma.netWorthHistory.update({
      where: { id: rec.id },
      data: { netWorth: newNetWorth },
    })
    updated++
  }

  return NextResponse.json({ updated, message: 'Net worth history recalculated.' })
}
