import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'

const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const
const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Education', 'Other']
const INCOME_CATEGORIES = ['Salary', 'Bonus', 'Freelance', 'Investment', 'Other']

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const list = await prisma.recurringTemplate.findMany({
    where: { userId },
    orderBy: { nextRun: 'asc' },
  })
  return NextResponse.json(list)
}

function addFrequency(date: Date, frequency: string): Date {
  const d = new Date(date)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const type = (body.type === 'income' ? 'income' : 'expense') as 'expense' | 'income'
  const amount = Number(body.amount)
  const category = String(body.category ?? (type === 'expense' ? 'Other' : 'Salary')).trim()
  const frequency = FREQUENCIES.includes(body.frequency as (typeof FREQUENCIES)[number]) ? body.frequency : 'monthly'
  const startDate = body.startDate ? new Date(body.startDate) : new Date()
  const description = type === 'expense' ? (body.description ?? null) : null

  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  if (type === 'expense' && !EXPENSE_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}` }, { status: 400 })
  }
  if (type === 'income' && !INCOME_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${INCOME_CATEGORIES.join(', ')}` }, { status: 400 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const nextRun = startDate <= today ? new Date(today) : new Date(startDate)

  const template = await prisma.recurringTemplate.create({
    data: { userId, type, amount, category, description, frequency, startDate, nextRun },
  })
  return NextResponse.json(template)
}
