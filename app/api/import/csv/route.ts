import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (inQuotes) {
      cur += c
    } else if (c === ',') {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

function parseDate(s: string): Date | null {
  if (!s || !s.trim()) return null
  const d = new Date(s.trim())
  return isNaN(d.getTime()) ? null : d
}

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Education', 'Other']
const INCOME_CATEGORIES = ['Salary', 'Bonus', 'Freelance', 'Investment', 'Other']

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = (formData.get('type') as string) || 'expenses' // 'expenses' | 'incomes'
  if (!file || !file.size) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (type !== 'expenses' && type !== 'incomes') {
    return NextResponse.json({ error: 'type must be expenses or incomes' }, { status: 400 })
  }
  const text = await file.text()
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 })
  }
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s/g, ''))
  const rows = lines.slice(1).map((l) => parseCsvLine(l))
  const amountIdx = header.findIndex((h) => h === 'amount' || h === 'amount(inr)' || h === 'amount(₹)')
  const categoryIdx = header.findIndex((h) => h === 'category' || h === 'categoryname')
  const dateIdx = header.findIndex((h) => h === 'date' || h === 'transactiondate')
  const descIdx = header.findIndex((h) => h === 'description' || h === 'details' || h === 'note')
  const hasAmount = amountIdx >= 0
  const hasCategory = categoryIdx >= 0
  let createdExpenses = 0
  let createdIncomes = 0
  const errors: string[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const amountStr = hasAmount ? row[amountIdx] : ''
    const amount = parseFloat(amountStr?.replace(/[^0-9.-]/g, '') || '0')
    if (!amount || amount <= 0) continue
    const category = (hasCategory ? row[categoryIdx] : '').trim() || (type === 'expenses' ? 'Other' : 'Salary')
    const dateStr = dateIdx >= 0 ? row[dateIdx] : ''
    const date = parseDate(dateStr) ?? new Date()
    const description = descIdx >= 0 ? (row[descIdx] ?? '').trim() || null : null

    if (type === 'expenses') {
      const cat = EXPENSE_CATEGORIES.includes(category) ? category : 'Other'
      try {
        await prisma.expense.create({
          data: { amount, category: cat, description, date, userId },
        })
        createdExpenses++
      } catch (e) {
        errors.push(`Row ${i + 2}: ${String(e)}`)
      }
    } else {
      const cat = INCOME_CATEGORIES.includes(category) ? category : 'Other'
      try {
        await prisma.income.create({
          data: { amount, category: cat, date, userId },
        })
        createdIncomes++
      } catch (e) {
        errors.push(`Row ${i + 2}: ${String(e)}`)
      }
    }
  }

  return NextResponse.json({ ok: true, createdExpenses, createdIncomes, errors: errors.slice(0, 10) })
}
