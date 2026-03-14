import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const alerts = await prisma.alert.findMany({
    where: { userId },
    orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  })
  return NextResponse.json(alerts)
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = body.id as string | undefined
  const read = body.read as boolean | undefined

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const result = await prisma.alert.updateMany({
    where: { id, userId },
    data: read !== undefined ? { read } : {},
  })
  if (result.count === 0) return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
  const updated = await prisma.alert.findUnique({ where: { id } })
  return NextResponse.json(updated)
}
