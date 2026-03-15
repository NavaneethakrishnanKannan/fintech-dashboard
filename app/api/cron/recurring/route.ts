import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/** Called by Vercel Cron (or external scheduler). Set CRON_SECRET in env. */
function addFrequency(date: Date, frequency: string): Date {
  const d = new Date(date)
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  return d
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const due = await prisma.recurringTemplate.findMany({
    where: { nextRun: { lte: today } },
  })

  let created = 0
  for (const t of due) {
    try {
      const runDate = new Date(t.nextRun)
      runDate.setHours(0, 0, 0, 0)
      if (t.type === 'expense') {
        await prisma.expense.create({
          data: {
            userId: t.userId,
            amount: t.amount,
            category: t.category,
            description: t.description,
            date: runDate,
          },
        })
      } else {
        await prisma.income.create({
          data: {
            userId: t.userId,
            amount: t.amount,
            category: t.category,
            date: runDate,
          },
        })
      }
      const nextRun = addFrequency(runDate, t.frequency)
      await prisma.recurringTemplate.update({
        where: { id: t.id },
        data: { nextRun },
      })
      created++
    } catch (e) {
      console.error('[cron/recurring]', t.id, e)
    }
  }

  return NextResponse.json({ ok: true, processed: due.length, created })
}
