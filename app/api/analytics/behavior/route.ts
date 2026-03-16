import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

/** Spending vs last month, by category comparison, savings rate trend. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const thisYear = now.getFullYear()
  const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1
  const lastYear = thisMonth === 1 ? thisYear - 1 : thisYear

  const [incomes, expThis, expLast] = await Promise.all([
    prisma.income.findMany({ where: { userId } }),
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
  const totalThis = expThis.reduce((s, e) => s + Number(e.amount), 0)
  const totalLast = expLast.reduce((s, e) => s + Number(e.amount), 0)

  const byCategory = (list: { category: string; amount: number }[]) => {
    const m: Record<string, number> = {}
    list.forEach((e) => { m[e.category] = (m[e.category] || 0) + Number(e.amount) })
    return m
  }
  const catThis = byCategory(expThis)
  const catLast = byCategory(expLast)
  const categories = Array.from(new Set([...Object.keys(catThis), ...Object.keys(catLast)]))
  const categoryTrends = categories.map((cat) => {
    const a = catThis[cat] || 0
    const b = catLast[cat] || 0
    const change = b > 0 ? ((a - b) / b) * 100 : (a > 0 ? 100 : 0)
    return { category: cat, thisMonth: a, lastMonth: b, changePercent: Math.round(change * 10) / 10 }
  }).filter((t) => t.thisMonth > 0 || t.lastMonth > 0).sort((a, b) => b.thisMonth - a.thisMonth)

  const spendingChangePercent = totalLast > 0 ? ((totalThis - totalLast) / totalLast) * 100 : (totalThis > 0 ? 100 : 0)
  const savingsRateThis = totalIncome > 0 ? ((totalIncome - totalThis) / totalIncome) * 100 : 0
  const savingsRateLast = totalIncome > 0 && totalLast > 0 ? ((totalIncome - totalLast) / totalIncome) * 100 : 0
  const savingsRateTrend = savingsRateLast !== 0 ? savingsRateThis - savingsRateLast : 0

  return NextResponse.json({
    totalExpenseThisMonth: totalThis,
    totalExpenseLastMonth: totalLast,
    spendingChangePercent: Math.round(spendingChangePercent * 10) / 10,
    savingsRateThisMonth: Math.round(savingsRateThis * 10) / 10,
    savingsRateLastMonth: Math.round(savingsRateLast * 10) / 10,
    savingsRateTrend: Math.round(savingsRateTrend * 10) / 10,
    categoryTrends,
    monthlyIncome: totalIncome,
  })
}
