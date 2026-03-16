import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/** Last month's financial report: net worth change, expenses breakdown, savings rate, top categories. */
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth()
  const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const start = new Date(lastYear, lastMonth, 1)
  const end = new Date(lastYear, lastMonth + 1, 0, 23, 59, 59)

  const [expenses, incomes, investments, loans, historyStart, historyEnd] = await Promise.all([
    prisma.expense.findMany({ where: { userId, date: { gte: start, lte: end } } }),
    prisma.income.findMany({ where: { userId, date: { gte: start, lte: end } } }),
    prisma.investment.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.netWorthHistory.findFirst({ where: { userId, date: { lte: start } }, orderBy: { date: 'desc' } }),
    prisma.netWorthHistory.findFirst({ where: { userId, date: { lte: end } }, orderBy: { date: 'desc' } }),
  ])

  const totalExpense = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalEmi = loans.reduce((s, l) => s + Number(l.emi), 0)
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense - totalEmi) / totalIncome) * 100 : 0
  const byCategory: Record<string, number> = {}
  expenses.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount) })
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([category, amount]) => ({ category, amount }))

  const nwStart = historyStart?.netWorth ?? 0
  const nwEnd = historyEnd?.netWorth ?? 0
  const netWorthChange = nwEnd - nwStart
  const invValue = investments.reduce((s, inv) => {
    const v = inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.buyPrice + inv.profit
    return s + v
  }, 0)

  const report = {
    month: lastMonth + 1,
    year: lastYear,
    totalExpense,
    totalIncome,
    totalEmi,
    savingsRate: Math.round(savingsRate * 10) / 10,
    netWorthStart: nwStart,
    netWorthEnd: nwEnd,
    netWorthChange,
    topCategories,
    investmentValue: invValue,
  }

  const format = req.nextUrl.searchParams.get('format')
  if (format === 'pdf') {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const margin = 14
    let y = 18
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(`Monthly financial report – ${lastYear}-${String(lastMonth + 1).padStart(2, '0')}`, margin, y)
    y += 10
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Net worth: ₹${nwStart.toLocaleString('en-IN')} → ₹${nwEnd.toLocaleString('en-IN')} (${netWorthChange >= 0 ? '+' : ''}₹${netWorthChange.toLocaleString('en-IN')})`, margin, y)
    y += 7
    doc.text(`Expenses: ₹${totalExpense.toLocaleString('en-IN')}  |  Income: ₹${totalIncome.toLocaleString('en-IN')}  |  Savings rate: ${savingsRate.toFixed(1)}%`, margin, y)
    y += 10
    doc.setFont('helvetica', 'bold')
    doc.text('Top spending categories', margin, y)
    y += 6
    autoTable(doc, {
      startY: y,
      margin: { left: margin },
      head: [['Category', 'Amount (₹)']],
      body: topCategories.map((c) => [c.category, c.amount.toLocaleString('en-IN')]),
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [66, 139, 202], fontStyle: 'bold' as const },
    })
    const buf = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="monthly-report-${lastYear}-${String(lastMonth + 1).padStart(2, '0')}.pdf"`,
      },
    })
  }

  return NextResponse.json(report)
}
