import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const conn = await prisma.zerodhaConnection.findUnique({
      where: { userId },
      select: { kiteUserId: true, userName: true, connectedAt: true },
    })

    return NextResponse.json({
      connected: !!conn,
      kiteUserId: conn?.kiteUserId ?? null,
      userName: conn?.userName ?? null,
      connectedAt: conn?.connectedAt?.toISOString() ?? null,
    })
  } catch (err) {
    console.error('[zerodha/status]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to get Zerodha status', details: message },
      { status: 500 }
    )
  }
}
