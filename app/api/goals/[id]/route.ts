import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const data: {
    title?: string
    targetAmount?: number
    currentAmount?: number
    targetDate?: Date | null
    expectedReturnRate?: number | null
  } = {}
  if (body.title != null) data.title = body.title
  if (body.targetAmount != null) data.targetAmount = Number(body.targetAmount)
  if (body.currentAmount != null) data.currentAmount = Number(body.currentAmount)
  if (body.targetDate !== undefined) data.targetDate = body.targetDate ? new Date(body.targetDate) : null
  if (body.expectedReturnRate !== undefined) data.expectedReturnRate = body.expectedReturnRate != null ? Number(body.expectedReturnRate) : null
  const result = await prisma.goal.updateMany({
    where: { id, userId },
    data,
  })
  if (result.count === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  const updated = await prisma.goal.findUnique({ where: { id } })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const result = await prisma.goal.deleteMany({ where: { id, userId } })
  if (result.count === 0) return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
