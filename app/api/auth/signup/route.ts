import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, name } = body
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 },
      )
    }
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || password.length < 6) {
      return NextResponse.json(
        { error: 'Email is required and password must be at least 6 characters.' },
        { status: 400 },
      )
    }
    const existing = await prisma.user.findUnique({
      where: { email: trimmedEmail },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 },
      )
    }
    const hashed = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: {
        email: trimmedEmail,
        name: typeof name === 'string' ? name.trim() || null : null,
        password: hashed,
      },
    })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json(
      { error: 'Signup failed. Please try again.' },
      { status: 500 },
    )
  }
}
