import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'

/** Investments linked to this goal (funded by). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: goalId } = await params
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } })
  if (!goal) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  const investments = await prisma.investment.findMany({
    where: { userId, goalId },
    orderBy: { buyDate: 'desc' },
  })
  return NextResponse.json(investments)
}
