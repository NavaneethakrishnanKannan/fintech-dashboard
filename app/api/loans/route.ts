import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const loans = await prisma.loan.findMany({
    where: { userId },
    orderBy: { startDate: 'desc' },
  })
  return NextResponse.json(loans)
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const loan = await prisma.loan.create({
    data: {
      name: body.name,
      principal: body.principal,
      interest: body.interest,
      tenure: body.tenure,
      totalTenureMonths: body.totalTenureMonths != null ? body.totalTenureMonths : null,
      emi: body.emi,
      startDate: new Date(body.startDate),
      userId,
    },
  })
  return NextResponse.json(loan)
}

