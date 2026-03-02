import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'csv'

  const [incomes, expenses, loans, investments] = await Promise.all([
    prisma.income.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.expense.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.loan.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
    prisma.investment.findMany({ where: { userId }, orderBy: { buyDate: 'desc' } }),
  ])

  if (format === 'pdf') {
    const text = [
      'Wealth Dashboard Export',
      '=== Incomes ===',
      ...incomes.map((i) => `${i.category},${i.amount},${i.date.toISOString().slice(0, 10)}`),
      '=== Expenses ===',
      ...expenses.map((e) => `${e.category},${e.amount},${e.description ?? ''},${e.date.toISOString().slice(0, 10)}`),
      '=== Loans ===',
      ...loans.map((l) => `${l.name},${l.principal},${l.interest},${l.tenure},${l.emi},${l.startDate.toISOString().slice(0, 10)}`),
      '=== Investments ===',
      ...investments.map((inv) => `${inv.type},${inv.name},${inv.buyPrice},${inv.profit},${inv.buyDate.toISOString().slice(0, 10)}`),
    ].join('\n')
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="wealth-export.txt"',
      },
    })
  }

  const rows: string[] = []
  rows.push('Section,Category,Amount,Date,Details')
  incomes.forEach((i) => rows.push(`Income,${escapeCsv(i.category)},${i.amount},${i.date.toISOString().slice(0, 10)},`))
  expenses.forEach((e) => rows.push(`Expense,${escapeCsv(e.category)},${e.amount},${e.date.toISOString().slice(0, 10)},${escapeCsv(e.description ?? '')}`))
  loans.forEach((l) => rows.push(`Loan,${escapeCsv(l.name)},${l.emi},${l.startDate.toISOString().slice(0, 10)},Principal ${l.principal} @ ${l.interest}%`))
  investments.forEach((inv) => rows.push(`Investment,${escapeCsv(inv.name)},${inv.buyPrice + inv.profit},${inv.buyDate.toISOString().slice(0, 10)},Profit ${inv.profit}`))

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="wealth-export.csv"',
    },
  })
}

function escapeCsv(s: string): string {
  if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
