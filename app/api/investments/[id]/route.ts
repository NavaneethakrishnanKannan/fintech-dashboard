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
    buyPrice?: number
    profit?: number
    buyDate?: Date
    monthlySip?: number | null
  } = {}
  if (body.type != null) data.type = body.type
  if (body.symbol !== undefined) data.symbol = body.symbol || null
  if (body.name != null) data.name = body.name
  if (body.buyPrice != null) data.buyPrice = body.buyPrice
  if (body.profit != null) data.profit = body.profit
  if (body.buyDate != null) data.buyDate = new Date(body.buyDate)
  if (body.monthlySip !== undefined) data.monthlySip = body.monthlySip != null ? body.monthlySip : null

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
