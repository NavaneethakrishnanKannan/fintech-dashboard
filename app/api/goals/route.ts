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
      title: body.title ?? body.goalName ?? 'Goal',
      targetAmount: Number(body.targetAmount) ?? 0,
      currentAmount: Number(body.currentAmount) ?? body.currentSavings ?? 0,
      targetDate: body.targetDate ? new Date(body.targetDate) : (body.targetYear ? new Date(Number(body.targetYear), 11, 31) : null),
      expectedReturnRate: body.expectedReturnRate != null ? Number(body.expectedReturnRate) : null,
      userId,
    },
  })
  return NextResponse.json(goal)
}
