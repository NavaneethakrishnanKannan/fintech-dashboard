import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'

const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const

function addFrequency(date: Date, frequency: string): Date {
  const d = new Date(date)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const data: { amount?: number; category?: string; description?: string | null; frequency?: string; nextRun?: Date } = {}
  if (body.amount != null && Number(body.amount) > 0) data.amount = Number(body.amount)
  if (body.category != null) data.category = String(body.category)
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null
  if (body.frequency != null && FREQUENCIES.includes(body.frequency)) data.frequency = body.frequency
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const template = await prisma.recurringTemplate.findFirst({ where: { id, userId } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.recurringTemplate.update({
    where: { id },
    data,
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const result = await prisma.recurringTemplate.deleteMany({ where: { id, userId } })
  if (result.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
