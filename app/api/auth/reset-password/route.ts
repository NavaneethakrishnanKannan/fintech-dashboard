import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const token = (body.token ?? '').trim()
  const newPassword = body.newPassword
  if (!token || !newPassword || String(newPassword).length < 6) {
    return NextResponse.json(
      { error: 'Valid token and new password (min 6 characters) are required' },
      { status: 400 },
    )
  }
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
  })
  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
  }
  if (!record.userId) {
    return NextResponse.json({ error: 'Invalid reset link' }, { status: 400 })
  }
  const hashed = await bcrypt.hash(String(newPassword), 10)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: hashed },
    }),
    prisma.passwordResetToken.delete({ where: { id: record.id } }),
  ])
  return NextResponse.json({ ok: true })
}
