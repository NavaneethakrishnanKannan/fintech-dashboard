import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { getTaxCapitalGains } from '@/lib/taxCapitalGains'

/** Unrealized capital gains: Zerodha when connected, else saved investments. LTCG/STCG for manual; Zerodha rows show "—" for bucket. */
export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getTaxCapitalGains(userId)
  return NextResponse.json(result)
}
