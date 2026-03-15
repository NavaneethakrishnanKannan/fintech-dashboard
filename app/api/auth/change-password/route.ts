import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const currentPassword = body.currentPassword
  const newPassword = body.newPassword
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    return NextResponse.json(
      { error: 'Current password and new password (min 6 characters) are required' },
      { status: 400 },
    )
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })
  if (!user?.password) {
    return NextResponse.json({ error: 'Account uses social login; set a password first from forgot-password flow' }, { status: 400 })
  }
  const ok = await bcrypt.compare(String(currentPassword), user.password)
  if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  const hashed = await bcrypt.hash(String(newPassword), 10)
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  })
  return NextResponse.json({ ok: true })
}
