import { NextResponse } from 'next/server'

export async function GET() {
  const hasCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS
  return NextResponse.json({ available: hasCreds })
}
