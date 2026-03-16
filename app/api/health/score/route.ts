import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

function currentInvValue(inv: { quantity: number; buyPrice: number; profit: number; currentPrice: number | null }) {
  return inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.buyPrice + inv.profit
}

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [investments, expenses, incomes, loans] = await Promise.all([
    prisma.investment.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
  ])

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalEmi = loans.reduce((s, l) => s + Number(l.emi), 0)
  const monthlyExpenses = totalExpenses + totalEmi
  const savingsRate = totalIncome > 0 ? (totalIncome - monthlyExpenses) / totalIncome : 0
  const debtToIncome = totalIncome > 0 ? totalEmi / totalIncome : 0
  const portfolioValue = investments.reduce((s, inv) => s + currentInvValue(inv), 0)
  const emergencyMonths = monthlyExpenses > 0 ? (portfolioValue * 0.3) / monthlyExpenses : 0
  const sectors = new Set(investments.map((i) => i.sector ?? 'Unknown').filter(Boolean))
  const diversification = investments.length <= 1 ? 0 : Math.min(1, sectors.size / 5)
  const totalInvested = investments.reduce((s, inv) => s + inv.quantity * inv.buyPrice, 0)
  const portfolioGrowth = totalInvested > 0 ? (portfolioValue - totalInvested) / totalInvested : 0

  const components = [
    { name: 'Savings rate', value: Math.min(1, Math.max(0, savingsRate)), weight: 0.25, ideal: 0.3 },
    { name: 'Debt-to-income', value: Math.max(0, 1 - debtToIncome), weight: 0.2, ideal: 0.4 },
    { name: 'Emergency fund', value: Math.min(1, emergencyMonths / 6), weight: 0.2, ideal: 6 },
    { name: 'Diversification', value: diversification, weight: 0.15, ideal: 1 },
    { name: 'Portfolio growth', value: Math.min(1, Math.max(0, (portfolioGrowth + 0.2) / 0.5)), weight: 0.2, ideal: 1 },
  ]

  let score = 0
  const breakdown: { name: string; score: number; suggestion?: string }[] = []
  for (const c of components) {
    const compScore = Math.round(c.value * 100)
    score += c.value * c.weight * 100
    breakdown.push({
      name: c.name,
      score: compScore,
      suggestion:
        c.value < 0.5
          ? c.name === 'Savings rate'
            ? 'Aim for at least 30% savings rate.'
            : c.name === 'Debt-to-income'
              ? 'Keep EMI below 40% of income.'
              : c.name === 'Emergency fund'
                ? 'Build 6 months of expenses as emergency fund.'
                : c.name === 'Diversification'
                  ? 'Diversify across sectors/asset classes.'
                  : 'Review investment returns and risk.'
          : undefined,
    })
  }
  score = Math.round(Math.min(100, Math.max(0, score)))

  const suggestions = breakdown.filter((b) => b.suggestion).map((b) => b.suggestion!)

  // Generate alerts for poor metrics (only if no unread alert of same type recently)
  const alertRules: { type: string; title: string; message: string; severity: string }[] = []
  if (savingsRate < 0.3) alertRules.push({ type: 'low_savings', title: 'Low savings rate', message: `Your savings rate is ${(savingsRate * 100).toFixed(0)}%. Aim for at least 30%.`, severity: 'warning' })
  if (debtToIncome > 0.4) alertRules.push({ type: 'high_loan_ratio', title: 'High EMI to income', message: `Your EMI is ${(debtToIncome * 100).toFixed(0)}% of income. Consider keeping it under 40%.`, severity: 'warning' })
  if (emergencyMonths < 3) alertRules.push({ type: 'low_emergency_fund', title: 'Low emergency fund', message: 'Build at least 3–6 months of expenses as emergency fund.', severity: 'warning' })
  if (investments.length >= 3 && diversification < 0.4) alertRules.push({ type: 'concentrated_portfolio', title: 'Concentrated portfolio', message: 'Consider diversifying across sectors and asset classes.', severity: 'info' })

  // Only create an alert if no alert of this type exists in the last 48 hours (read or unread)
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const recent = await prisma.alert.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { type: true },
  })
  const recentTypes = new Set(recent.map((a) => a.type))
  for (const rule of alertRules) {
    if (recentTypes.has(rule.type)) continue
    await prisma.alert.create({
      data: { userId, type: rule.type, title: rule.title, message: rule.message, severity: rule.severity },
    }).catch(() => {})
    recentTypes.add(rule.type)
  }

  return NextResponse.json({
    score,
    breakdown,
    suggestions,
    metrics: {
      savingsRate: savingsRate * 100,
      debtToIncomeRatio: debtToIncome * 100,
      emergencyFundMonths: Math.round(emergencyMonths * 10) / 10,
      diversificationScore: diversification * 100,
      portfolioGrowthPercent: portfolioGrowth * 100,
    },
  })
}
