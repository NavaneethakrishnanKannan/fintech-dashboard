import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

function remainingPrincipalAfterPayments(
  principal: number,
  annualRatePct: number,
  emi: number,
  monthsPaid: number,
): number {
  if (monthsPaid <= 0) return principal
  const r = annualRatePct / 100 / 12
  if (r <= 0) return Math.max(0, principal - emi * monthsPaid)
  const factor = Math.pow(1 + r, monthsPaid)
  const balance = principal * factor - emi * ((factor - 1) / r)
  return Math.max(0, Math.round(balance * 100) / 100)
}

function monthsToPayoff(principal: number, annualRatePct: number, emi: number): number {
  if (emi <= 0) return Infinity
  const r = annualRatePct / 100 / 12
  if (r <= 0) return Math.ceil(principal / emi)
  let balance = principal
  let months = 0
  while (balance > 0.01 && months < 600) {
    const interest = balance * r
    const principalPart = emi - interest
    balance = balance - principalPart
    months++
  }
  return months
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const loanId = body.loanId as string | undefined
  const extraEmi = Number(body.extraEmi) || 0

  if (!loanId) {
    return NextResponse.json({ error: 'loanId is required' }, { status: 400 })
  }

  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId } })
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  const monthsPaid = loan.totalTenureMonths != null ? loan.totalTenureMonths - loan.tenure : 0
  const currentPrincipal =
    monthsPaid > 0 && loan.totalTenureMonths != null
      ? remainingPrincipalAfterPayments(loan.principal, loan.interest, loan.emi, monthsPaid)
      : loan.principal

  const emiWithExtra = loan.emi + extraEmi
  const monthsRemaining = monthsToPayoff(currentPrincipal, loan.interest, loan.emi)
  const monthsWithExtra = extraEmi > 0 ? monthsToPayoff(currentPrincipal, loan.interest, emiWithExtra) : monthsRemaining

  let totalInterestPaid = 0
  let balance = currentPrincipal
  const r = loan.interest / 100 / 12
  const schedule: { month: number; balance: number; interest: number; principal: number }[] = []
  for (let m = 0; m < monthsRemaining && balance > 0.01; m++) {
    const interest = balance * r
    const principalPart = loan.emi - interest
    totalInterestPaid += interest
    balance = Math.max(0, balance - principalPart)
    schedule.push({
      month: m + 1,
      balance: Math.round(balance * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      principal: Math.round(principalPart * 100) / 100,
    })
  }

  let interestSaved = 0
  let monthsSaved = 0
  if (extraEmi > 0) {
    let bal2 = currentPrincipal
    let int2 = 0
    for (let m = 0; m < monthsWithExtra && bal2 > 0.01; m++) {
      const interest = bal2 * r
      int2 += interest
      bal2 = Math.max(0, bal2 - (emiWithExtra - interest))
    }
    interestSaved = totalInterestPaid - int2
    monthsSaved = monthsRemaining - monthsWithExtra
  }

  return NextResponse.json({
    loanId,
    remainingPrincipal: currentPrincipal,
    monthsRemaining,
    totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
    schedule: schedule.slice(0, 120),
    extraEmi: extraEmi > 0 ? { extraEmi, monthsSaved, interestSaved } : null,
  })
}
