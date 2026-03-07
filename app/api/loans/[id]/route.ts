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
    name?: string
    principal?: number
    interest?: number
    tenure?: number
    totalTenureMonths?: number | null
    emi?: number
    startDate?: Date
  } = {}
  if (body.name != null) data.name = body.name
  if (body.principal != null) data.principal = body.principal
  if (body.interest != null) data.interest = body.interest
  if (body.tenure != null) data.tenure = body.tenure
  if (body.totalTenureMonths !== undefined) data.totalTenureMonths = body.totalTenureMonths != null ? body.totalTenureMonths : null
  if (body.emi != null) data.emi = body.emi
  if (body.startDate != null) data.startDate = new Date(body.startDate)

  const loan = await prisma.loan.updateMany({
    where: { id, userId },
    data,
  })

  if (loan.count === 0) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }

  const updated = await prisma.loan.findUnique({
    where: { id },
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
  const result = await prisma.loan.deleteMany({
    where: { id, userId },
  })
  if (result.count === 0) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
