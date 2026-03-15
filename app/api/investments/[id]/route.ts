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
    type?: string
    symbol?: string | null
    name?: string
    quantity?: number
    buyPrice?: number
    currentPrice?: number | null
    profit?: number
    buyDate?: Date
    monthlySip?: number | null
    sector?: string | null
    category?: string | null
    goalId?: string | null
  } = {}
  if (body.type != null) data.type = body.type
  if (body.symbol !== undefined) data.symbol = body.symbol || null
  if (body.name != null) data.name = body.name
  if (body.quantity != null) data.quantity = Number(body.quantity)
  if (body.buyPrice != null) data.buyPrice = body.buyPrice
  if (body.currentPrice !== undefined) data.currentPrice = body.currentPrice != null ? Number(body.currentPrice) : null
  if (body.profit != null) data.profit = body.profit
  if (body.buyDate != null) data.buyDate = new Date(body.buyDate)
  if (body.monthlySip !== undefined) data.monthlySip = body.monthlySip != null ? body.monthlySip : null
  if (body.sector !== undefined) data.sector = body.sector || null
  if (body.category !== undefined) data.category = body.category || null
  if (body.goalId !== undefined) data.goalId = body.goalId != null && body.goalId !== '' ? body.goalId : null

  const result = await prisma.investment.updateMany({
    where: { id, userId },
    data,
  })

  if (result.count === 0) {
    return NextResponse.json({ error: 'Investment not found' }, { status: 404 })
  }

  const updated = await prisma.investment.findUnique({
    where: { id },
  })
  return NextResponse.json(updated)
}
