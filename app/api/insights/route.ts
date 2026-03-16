import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'
import { generateInsights } from '@/lib/services/insightsEngine'

function currentInvValue(inv: { quantity: number; buyPrice: number; profit: number; currentPrice: number | null }) {
  return inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.buyPrice + inv.profit
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const thisYear = now.getFullYear()
  const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1
  const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear

  const [investments, incomes, expenses, loans, expThisMonth, expLastMonth] = await Promise.all([
    prisma.investment.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.expense.findMany({
      where: {
        userId,
        date: { gte: new Date(thisYear, thisMonth - 1, 1), lt: new Date(thisYear, thisMonth, 1) },
      },
    }),
    prisma.expense.findMany({
      where: {
        userId,
        date: { gte: new Date(lastYear, lastMonth - 1, 1), lt: new Date(lastYear, lastMonth, 1) },
      },
    }),
  ])

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalEmi = loans.reduce((s, l) => s + Number(l.emi), 0)
  const monthlyBurn = totalExpenses + totalEmi
  const monthlySavings = totalIncome - monthlyBurn
  const savingsRatePercent = totalIncome > 0 ? (monthlySavings / totalIncome) * 100 : 0

  const portfolioValue = investments.reduce((s, inv) => s + currentInvValue(inv), 0)
  const equityValue = investments.filter(
    (inv) => ['STOCK', 'MUTUAL_FUND', 'ETF'].includes(inv.type) || inv.category === 'equity'
  ).reduce((s, inv) => s + currentInvValue(inv), 0)
  const debtValue = portfolioValue - equityValue
  const monthlyExpensesForEmergency = totalExpenses || 1
  const emergencyFundMonths = monthlyBurn > 0 ? (portfolioValue * 0.3) / monthlyBurn : 0

  const byCategory = (list: { category: string; amount: number }[]) => {
    const m: Record<string, number> = {}
    list.forEach((e) => { m[e.category] = (m[e.category] || 0) + Number(e.amount) })
    return Object.entries(m).map(([category, amount]) => ({ category, amount }))
  }
  const totalThisMonth = expThisMonth.reduce((s, e) => s + Number(e.amount), 0)
  const totalLastMonth = expLastMonth.reduce((s, e) => s + Number(e.amount), 0)
  const savingsRatePrev = totalIncome > 0 && totalLastMonth + totalEmi > 0
    ? ((totalIncome - totalLastMonth - totalEmi) / totalIncome) * 100
    : undefined

  const insights = generateInsights({
    monthlyIncome: totalIncome,
    monthlyExpenses: totalExpenses,
    monthlySavings,
    totalEmi,
    portfolioValue,
    equityValue,
    debtValue,
    emergencyFundMonths,
    savingsRatePercent,
    savingsRatePrevMonthPercent: savingsRatePrev,
    totalExpenseThisMonth: totalThisMonth,
    totalExpenseLastMonth: totalLastMonth,
    byCategoryThisMonth: byCategory(expThisMonth),
    byCategoryLastMonth: byCategory(expLastMonth),
    currentAge: 30,
    monthlySip: investments.reduce((s, inv) => s + (Number(inv.monthlySip) || 0), 0),
    expectedReturn: 10,
    netWorth: portfolioValue,
  })

  return NextResponse.json({ insights })
}
