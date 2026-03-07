import { NextResponse } from 'next/server'

/**
 * Health check for Render/load balancers. No DB or auth – use for readiness checks.
 */
export async function GET() {
  return NextResponse.json({ ok: true })
}
