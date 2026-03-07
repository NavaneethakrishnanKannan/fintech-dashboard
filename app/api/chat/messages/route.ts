import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/** GET: fetch last N chat messages for the current user. */
export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const limit = Math.min(
    parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT,
  )
  const messages = await prisma.chatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, role: true, content: true, createdAt: true },
  })
  return NextResponse.json(messages.reverse())
}

/** POST: append one or more messages (e.g. user + assistant pair). */
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const items = Array.isArray(body.messages)
    ? body.messages
    : body.role && body.content
      ? [{ role: body.role, content: body.content }]
      : []
  if (items.length === 0) {
    return NextResponse.json({ error: 'messages array or role+content required' }, { status: 400 })
  }
  const created = await prisma.$transaction(
    items.map((m: { role: string; content: string }) =>
      prisma.chatMessage.create({
        data: {
          userId,
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content).slice(0, 32_000),
        },
      }),
    ),
  )
  return NextResponse.json(created)
}
