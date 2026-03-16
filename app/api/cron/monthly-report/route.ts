import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Runs on 1st of month (e.g. 0 9 1 * *). Creates an alert for each user that monthly report is ready. */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth()
  const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const monthLabel = `${lastYear}-${String(lastMonth + 1).padStart(2, '0')}`

  const users = await prisma.user.findMany({ select: { id: true } })
  let created = 0
  for (const u of users) {
    try {
      await prisma.alert.create({
        data: {
          userId: u.id,
          type: 'monthly_report',
          title: 'Monthly report ready',
          message: `Your financial report for ${monthLabel} is ready. Go to Dashboard → Monthly report to download PDF.`,
          severity: 'info',
        },
      })
      created++
    } catch (e) {
      console.error('[cron/monthly-report]', u.id, e)
    }
  }

  return NextResponse.json({ ok: true, users: users.length, alertsCreated: created })
}
