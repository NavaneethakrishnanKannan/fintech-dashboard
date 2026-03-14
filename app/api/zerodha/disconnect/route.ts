import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await prisma.zerodhaConnection.deleteMany({ where: { userId } })
  return NextResponse.json({ success: true })
}
