import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

/** Required monthly investment to reach target: PMT such that FV = target.
 * FV = PV*(1+r)^n + PMT*(((1+r)^n - 1)/r)  with PMT monthly, r monthly.
 * So PMT = (FV - PV*(1+r)^n) / (((1+r)^n - 1)/r)
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const goalId = body.goalId as string | undefined
  const targetAmount = Number(body.targetAmount)
  const currentAmount = Number(body.currentAmount)
  const targetDate = body.targetDate ? new Date(body.targetDate) : null
  const expectedReturn = Number(body.expectedReturn) || 0

  let goal: { targetAmount: number; currentAmount: number; targetDate: Date | null; expectedReturnRate: number | null } | null = null
  if (goalId) {
    const g = await prisma.goal.findFirst({ where: { id: goalId, userId } })
    if (g) goal = { targetAmount: g.targetAmount, currentAmount: g.currentAmount, targetDate: g.targetDate, expectedReturnRate: g.expectedReturnRate }
  }

  const target = goal ? goal.targetAmount : targetAmount
  const current = goal ? goal.currentAmount : currentAmount
  const date = goal ? goal.targetDate : targetDate
  const rAnnual = goal ? (goal.expectedReturnRate ?? expectedReturn) : expectedReturn
  const r = rAnnual / 100 / 12

  const now = new Date()
  const endDate = date || new Date(now.getFullYear() + 10, now.getMonth(), 1)
  const monthsLeft = Math.max(1, Math.ceil((endDate.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))

  const fvFromCurrent = current * Math.pow(1 + r, monthsLeft)
  const shortfall = Math.max(0, target - fvFromCurrent)
  const annuityFactor = r > 0 ? (Math.pow(1 + r, monthsLeft) - 1) / r : monthsLeft
  const requiredMonthly = annuityFactor > 0 ? shortfall / annuityFactor : 0

  const progressPercent = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const projectedValueAtTarget = fvFromCurrent + (requiredMonthly * annuityFactor)

  const timeline: { month: number; value: number; target: number }[] = []
  for (let m = 0; m <= Math.min(monthsLeft, 120); m += 6) {
    const factor = Math.pow(1 + r, m)
    const annuity = r > 0 ? (factor - 1) / r : m
    const v = current * factor + requiredMonthly * annuity
    timeline.push({ month: m, value: Math.round(v * 100) / 100, target })
  }

  return NextResponse.json({
    requiredMonthlyInvestment: Math.round(requiredMonthly * 100) / 100,
    progressPercent: Math.round(progressPercent * 100) / 100,
    projectedValueAtTarget: Math.round(projectedValueAtTarget * 100) / 100,
    monthsLeft,
    timeline,
  })
}
