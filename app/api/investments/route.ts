import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const investments = await prisma.investment.findMany({
    where: { userId },
    orderBy: { buyDate: 'desc' },
  })
  return NextResponse.json(investments)
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const goalId = body.goalId != null && body.goalId !== '' ? body.goalId : null
  const investment = await prisma.investment.create({
    data: {
      type: body.type ?? 'OTHER',
      symbol: body.symbol,
      name: body.name,
      quantity: body.quantity != null ? Number(body.quantity) : 1,
      buyPrice: body.buyPrice ?? body.purchasePrice ?? 0,
      currentPrice: body.currentPrice != null ? Number(body.currentPrice) : null,
      profit: body.profit ?? 0,
      buyDate: new Date(body.buyDate ?? body.purchaseDate ?? Date.now()),
      monthlySip: body.monthlySip != null ? body.monthlySip : null,
      sector: body.sector ?? null,
      category: body.category ?? null,
      goalId,
      userId,
    },
  })
  return NextResponse.json(investment)
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  await prisma.investment.deleteMany({
    where: { id, userId },
  })

  return NextResponse.json({ success: true })
}

