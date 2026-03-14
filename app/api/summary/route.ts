import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

/** Remaining principal after k EMI payments (standard amortization). */
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

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const [investments, expenses, incomes, loansRaw] = await Promise.all([
      prisma.investment.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId } }),
      prisma.income.findMany({ where: { userId } }),
      prisma.loan.findMany({ where: { userId } }),
    ])

    const totalInvested = investments.reduce(
      (sum, inv) => sum + (Number(inv.quantity) || 0) * (Number(inv.buyPrice) || 0),
      0,
    )
    const totalCurrent = investments.reduce((sum, inv) => {
      const qty = Number(inv.quantity) || 0
      const buyPrice = Number(inv.buyPrice) || 0
      const profit = Number(inv.profit) || 0
      const currentPrice = inv.currentPrice != null ? Number(inv.currentPrice) : null
      const cv = currentPrice != null ? qty * currentPrice : buyPrice + profit
      return sum + cv
    }, 0)

    const totalIncome = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0)
    const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const totalLoanEmi = loansRaw.reduce((s, l) => s + (Number(l.emi) || 0), 0)
    const totalExpensesIncludingEmi = totalExpenses + totalLoanEmi
    const monthlySavings = totalIncome - totalExpensesIncludingEmi
    const totalMonthlySip = investments.reduce((s, inv) => s + (Number(inv.monthlySip) || 0), 0)
    const surplusAfterInvestments = monthlySavings - totalMonthlySip

    const loans = loansRaw.map((l) => {
      const monthsPaid =
        l.totalTenureMonths != null ? l.totalTenureMonths - l.tenure : 0
      const remainingPrincipal =
        monthsPaid > 0 && l.totalTenureMonths != null
          ? remainingPrincipalAfterPayments(
              Number(l.principal),
              Number(l.interest),
              Number(l.emi),
              monthsPaid,
            )
          : Number(l.principal) || 0
      return {
        ...l,
        remainingPrincipal,
      }
    })

    const totalLoanPrincipal = loans.reduce(
      (s, l) => s + (l.remainingPrincipal ?? Number(l.principal) ?? 0),
      0,
    )

    const homeLoans = loans.filter((l) =>
      (l.name ?? '').toLowerCase().includes('home'),
    )
    const totalHomeAssetValue = homeLoans.reduce(
      (s, l) => s + (Number(l.principal) || 0),
      0,
    )

    const netWorth =
      totalCurrent +
      monthlySavings * 12 -
      totalLoanPrincipal +
      totalHomeAssetValue

    return NextResponse.json({
      investments,
      expenses,
      incomes,
      loans,
      KPIs: {
        totalInvested,
        totalCurrent,
        totalIncome,
        totalExpenses,
        totalLoanEmi,
        totalExpensesIncludingEmi,
        monthlySavings,
        totalMonthlySip,
        surplusAfterInvestments,
        totalLoanPrincipal,
        totalHomeAssetValue,
        netWorth,
      },
    })
  } catch (err) {
    console.error('[api/summary]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Summary failed', details: message },
      { status: 500 },
    )
  }
}

