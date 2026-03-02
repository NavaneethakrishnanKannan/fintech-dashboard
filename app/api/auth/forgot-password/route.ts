import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

const TOKEN_VALID_HOURS = 24

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = (body.email ?? '').trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  const user = await prisma.user.findUnique({
    where: { email },
  })
  if (!user) {
    return NextResponse.json({ ok: true })
  }
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + TOKEN_VALID_HOURS * 60 * 60 * 1000)
  await prisma.passwordResetToken.create({
    data: {
      token,
      email,
      expiresAt,
      userId: user.id,
    },
  })
  const resetUrl = `${process.env.NEXTAUTH_URL ?? req.nextUrl.origin}/reset-password?token=${token}`
  if (process.env.EMAIL_SERVER) {
    // TODO: send email with resetUrl using your email provider
  }
  return NextResponse.json({ ok: true, resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined })
}
