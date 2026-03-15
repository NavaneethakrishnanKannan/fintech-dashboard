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
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM ?? 'onboarding@resend.dev'
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: 'Reset your password – Wealth SaaS',
          html: `<p>Use the link below to reset your password. It expires in 24 hours.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you didn't request this, ignore this email.</p>`,
        }),
      })
      if (!r.ok) {
        const err = await r.text()
        console.error('[forgot-password] Resend error:', err)
      }
    } catch (e) {
      console.error('[forgot-password] Send failed:', e)
    }
  }
  return NextResponse.json({ ok: true, resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined })
}
