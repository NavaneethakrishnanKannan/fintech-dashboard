import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const searchParams = req.nextUrl.searchParams
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : null
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : null
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let dateFrom: Date
  let dateTo: Date
  if (month != null && year != null) {
    dateFrom = new Date(year, month - 1, 1)
    dateTo = new Date(year, month, 0, 23, 59, 59, 999)
  } else if (from && to) {
    dateFrom = new Date(from)
    dateTo = new Date(to)
  } else {
    const now = new Date()
    dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    dateTo = new Date()
  }

  const [expenses, incomes] = await Promise.all([
    prisma.expense.findMany({
      where: {
        userId,
        date: { gte: dateFrom, lte: dateTo },
      },
    }),
    prisma.income.findMany({
      where: {
        userId,
        date: { gte: dateFrom, lte: dateTo },
      },
    }),
  ])

  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const incomeInPeriod = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const byCategory: Record<string, number> = {}
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount)
  }
  const savingsRate = incomeInPeriod > 0 ? (incomeInPeriod - totalExpense) / incomeInPeriod : 0

  return NextResponse.json({
    totalExpense,
    incomeInPeriod,
    savingsRate,
    byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
    from: dateFrom.toISOString(),
    to: dateTo.toISOString(),
  })
}
