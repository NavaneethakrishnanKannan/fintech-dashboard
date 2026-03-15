import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'
import { getTaxCapitalGains } from '@/lib/taxCapitalGains'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'csv'

  const [incomes, expenses, loans, investments, goals, budgets] = await Promise.all([
    prisma.income.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.expense.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.loan.findMany({ where: { userId }, orderBy: { startDate: 'desc' } }),
    prisma.investment.findMany({ where: { userId }, orderBy: { buyDate: 'desc' } }),
    prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.budget.findMany({ where: { userId }, orderBy: { category: 'asc' } }),
  ])

  if (format === 'xlsx') {
    const taxData = await getTaxCapitalGains(userId)
    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Date', 'Category', 'Amount (₹)'],
        ...incomes.map((i) => [i.date.toISOString().slice(0, 10), i.category, i.amount]),
      ]),
      'Incomes'
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Date', 'Category', 'Amount (₹)', 'Description'],
        ...expenses.map((e) => [e.date.toISOString().slice(0, 10), e.category, e.amount, e.description ?? '']),
      ]),
      'Expenses'
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Name', 'Principal (₹)', 'EMI (₹)', 'Interest %', 'Tenure (months)', 'Start date'],
        ...loans.map((l) => [l.name, l.principal, l.emi, l.interest, l.tenure, l.startDate.toISOString().slice(0, 10)]),
      ]),
      'Loans'
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Type', 'Name', 'Quantity', 'Buy price (₹)', 'Current price (₹)', 'Profit (₹)', 'Buy date', 'Category', 'Goal'],
        ...investments.map((inv) => [
          inv.type,
          inv.name,
          inv.quantity,
          inv.buyPrice,
          inv.currentPrice ?? '',
          inv.profit,
          inv.buyDate.toISOString().slice(0, 10),
          inv.category ?? '',
          inv.goalId ?? '',
        ]),
      ]),
      'Investments'
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Title', 'Target amount (₹)', 'Current amount (₹)', 'Target date', 'Expected return %'],
        ...goals.map((g) => [
          g.title,
          g.targetAmount,
          g.currentAmount,
          g.targetDate?.toISOString().slice(0, 10) ?? '',
          g.expectedReturnRate ?? '',
        ]),
      ]),
      'Goals'
    )
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Category', 'Budget (₹/month)'],
        ...budgets.map((b) => [b.category, b.amount]),
      ]),
      'Budgets'
    )
    const taxRows: (string | number)[][] = [
      ['Name', 'Type', 'Buy date', 'Holding (days)', 'Bucket', 'Cost (₹)', 'Value (₹)', 'Gain (₹)'],
      ...taxData.byHolding.map((h) => [h.name, h.type, h.buyDate, h.holdingDays, h.bucketApprox ? `${h.bucket} (approx)` : h.bucket, h.cost, h.value, h.gain]),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(taxRows), 'Tax (capital gains)')

    const buf = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="wealth-export.xlsx"',
      },
    })
  }

  if (format === 'pdf') {
    const taxData = await getTaxCapitalGains(userId)
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const margin = 14
    const tableOpts = { margin: { left: margin }, styles: { fontSize: 9 }, headStyles: { fillColor: [66, 139, 202], fontStyle: 'bold' } }

    function newPage() {
      doc.addPage()
      return 18
    }

    let y = 18
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Wealth Dashboard Export', margin, y)
    y += 10
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Incomes', margin, y)
    y += 6
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Date', 'Category', 'Amount (₹)']],
      body: incomes.length
        ? incomes.map((i) => [i.date.toISOString().slice(0, 10), i.category, Number(i.amount).toLocaleString('en-IN')])
        : [['—', 'No data', '—']],
      theme: 'grid',
    })

    y = newPage()
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Expenses', margin, y)
    y += 6
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Date', 'Category', 'Amount (₹)', 'Description']],
      body: expenses.length
        ? expenses.map((e) => [e.date.toISOString().slice(0, 10), e.category, Number(e.amount).toLocaleString('en-IN'), (e.description ?? '').slice(0, 40)])
        : [['—', 'No data', '—', '—']],
      theme: 'grid',
      columnStyles: { 3: { cellWidth: 50 } },
    })

    y = newPage()
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Loans', margin, y)
    y += 6
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Name', 'Principal (₹)', 'EMI (₹)', 'Interest %', 'Tenure (months)', 'Start date']],
      body: loans.length
        ? loans.map((l) => [l.name, Number(l.principal).toLocaleString('en-IN'), Number(l.emi).toLocaleString('en-IN'), String(l.interest), String(l.tenure), l.startDate.toISOString().slice(0, 10)])
        : [['—', 'No data', '—', '—', '—', '—']],
      theme: 'grid',
    })

    y = newPage()
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Investments', margin, y)
    y += 6
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Type', 'Name', 'Quantity', 'Buy (₹)', 'Current (₹)', 'Profit (₹)', 'Date']],
      body: investments.length
        ? investments.map((inv) => [
            inv.type,
            inv.name.slice(0, 20),
            inv.quantity,
            Number(inv.buyPrice).toLocaleString('en-IN'),
            inv.currentPrice != null ? Number(inv.currentPrice).toLocaleString('en-IN') : '—',
            Number(inv.profit).toLocaleString('en-IN'),
            inv.buyDate.toISOString().slice(0, 10),
          ])
        : [['—', 'No data', '—', '—', '—', '—', '—']],
      theme: 'grid',
      columnStyles: { 1: { cellWidth: 35 } },
    })

    y = newPage('Goals')
    doc.setFont('helvetica', 'bold')
    doc.text('Goals', margin, y)
    y += 6
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Title', 'Target (₹)', 'Current (₹)', 'Target date', 'Expected return %']],
      body: goals.length
        ? goals.map((g) => [
            g.title.slice(0, 30),
            Number(g.targetAmount).toLocaleString('en-IN'),
            Number(g.currentAmount).toLocaleString('en-IN'),
            g.targetDate?.toISOString().slice(0, 10) ?? '—',
            g.expectedReturnRate != null ? String(g.expectedReturnRate) : '—',
          ])
        : [['—', 'No data', '—', '—', '—']],
      theme: 'grid',
      columnStyles: { 0: { cellWidth: 45 } },
    })

    y = newPage()
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Budgets', margin, y)
    y += 6
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Category', 'Budget (₹/month)']],
      body: budgets.length
        ? budgets.map((b) => [b.category, Number(b.amount).toLocaleString('en-IN')])
        : [['—', 'No data']],
      theme: 'grid',
    })

    y = newPage()
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Tax (capital gains)', margin, y)
    y += 6
    autoTable(doc, {
      ...tableOpts,
      startY: y,
      head: [['Name', 'Type', 'Buy date', 'Days', 'Bucket', 'Cost (₹)', 'Value (₹)', 'Gain (₹)']],
      body: taxData.byHolding.length
        ? taxData.byHolding.map((h) => [
            h.name.slice(0, 18),
            h.type,
            h.buyDate,
            h.holdingDays,
            h.bucketApprox ? `${h.bucket} (approx)` : h.bucket,
            Number(h.cost).toLocaleString('en-IN'),
            Number(h.value).toLocaleString('en-IN'),
            Number(h.gain).toLocaleString('en-IN'),
          ])
        : [['—', 'No data', '—', '—', '—', '—', '—', '—']],
      theme: 'grid',
      columnStyles: { 0: { cellWidth: 32 } },
    })

    const buf = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="wealth-export.pdf"',
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
