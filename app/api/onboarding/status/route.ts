import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const completion = await prisma.onboardingCompletion.findUnique({
    where: { userId },
    select: { completedAt: true },
  })

  return NextResponse.json({
    completed: !!completion,
    completedAt: completion?.completedAt?.toISOString() ?? null,
    progress: completion ? 100 : 0,
  })
}
