import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()

  const data: {
    amount?: number
    category?: string
    description?: string | null
    date?: Date
  } = {}
  if (body.amount != null) data.amount = body.amount
  if (body.category != null) data.category = body.category
  if (body.description !== undefined) data.description = body.description || null
  if (body.date != null) data.date = new Date(body.date)

  const result = await prisma.expense.updateMany({
    where: { id, userId },
    data,
  })
  if (result.count === 0) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }
  const updated = await prisma.expense.findUnique({ where: { id } })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(_req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const result = await prisma.expense.deleteMany({
    where: { id, userId },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
