import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const expenses = await prisma.expense.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(expenses)
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const expense = await prisma.expense.create({
    data: {
      amount: body.amount,
      category: body.category,
      description: body.description ?? null,
      date: body.date ? new Date(body.date) : undefined,
      userId,
    },
  })
  return NextResponse.json(expense)
}

