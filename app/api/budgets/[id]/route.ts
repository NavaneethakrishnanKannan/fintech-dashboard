import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }
  const result = await prisma.budget.updateMany({
    where: { id, userId },
    data: { amount },
  })
  if (result.count === 0) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
  const updated = await prisma.budget.findUnique({ where: { id } })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const result = await prisma.budget.deleteMany({ where: { id, userId } })
  if (result.count === 0) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
