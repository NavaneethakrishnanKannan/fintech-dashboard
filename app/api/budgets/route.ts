import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Education', 'Other']

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const budgets = await prisma.budget.findMany({
    where: { userId },
    orderBy: { category: 'asc' },
  })
  return NextResponse.json(budgets)
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const category = typeof body.category === 'string' ? body.category.trim() : ''
  const amount = Number(body.amount)
  if (!category || amount <= 0 || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'category and positive amount required' }, { status: 400 })
  }
  const allowed = ['total', ...EXPENSE_CATEGORIES]
  if (!allowed.includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${allowed.join(', ')}` }, { status: 400 })
  }
  const existing = await prisma.budget.findFirst({
    where: { userId, category },
  })
  if (existing) {
    const updated = await prisma.budget.update({
      where: { id: existing.id },
      data: { amount },
    })
    return NextResponse.json(updated)
  }
  const budget = await prisma.budget.create({
    data: { userId, category, amount },
  })
  return NextResponse.json(budget)
}
