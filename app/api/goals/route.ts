import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(goals)
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const goal = await prisma.goal.create({
    data: {
      title: body.title ?? 'Goal',
      targetAmount: Number(body.targetAmount) ?? 0,
      currentAmount: Number(body.currentAmount) ?? 0,
      targetDate: body.targetDate ? new Date(body.targetDate) : null,
      userId,
    },
  })
  return NextResponse.json(goal)
}
