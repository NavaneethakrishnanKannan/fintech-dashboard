import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const incomes = await prisma.income.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(incomes)
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const income = await prisma.income.create({
    data: {
      amount: body.amount,
      category: body.category ?? 'Salary',
      userId,
    },
  })
  return NextResponse.json(income)
}
