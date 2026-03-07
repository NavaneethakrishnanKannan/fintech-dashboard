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

  const totalInvested = investments.reduce((sum, inv) => sum + inv.buyPrice, 0)
  const totalCurrent = investments.reduce(
    (sum, inv) => sum + (inv.buyPrice + inv.profit),
    0,
  )

  const totalIncome = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const totalLoanEmi = loansRaw.reduce((s, l) => s + (Number(l.emi) || 0), 0)
  const totalExpensesIncludingEmi = totalExpenses + totalLoanEmi
  const monthlySavings = totalIncome - totalExpensesIncludingEmi

  const loans = loansRaw.map((l) => {
    const monthsPaid =
      l.totalTenureMonths != null ? l.totalTenureMonths - l.tenure : 0
    const remainingPrincipal =
      monthsPaid > 0 && l.totalTenureMonths != null
        ? remainingPrincipalAfterPayments(
            l.principal,
            l.interest,
            l.emi,
            monthsPaid,
          )
        : l.principal
    return {
      ...l,
      remainingPrincipal,
    }
  })

  const totalLoanPrincipal = loans.reduce(
    (s, l) => s + (l.remainingPrincipal ?? l.principal),
    0,
  )

  const homeLoans = loans.filter((l) =>
    l.name.toLowerCase().includes('home'),
  )
  const totalHomeAssetValue = homeLoans.reduce((s, l) => s + l.principal, 0)

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
      totalLoanPrincipal,
      totalHomeAssetValue,
      netWorth,
    },
  })
}

