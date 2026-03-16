import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

/** EMI = P * r * (1+r)^n / ((1+r)^n - 1), P = principal, r = monthly rate, n = months */
function emi(principal: number, annualRatePercent: number, tenureMonths: number): number {
  if (tenureMonths <= 0) return 0
  const r = annualRatePercent / 100 / 12
  if (r <= 0) return principal / tenureMonths
  const factor = Math.pow(1 + r, tenureMonths)
  return (principal * r * factor) / (factor - 1)
}

/** Approximate financial score 0-100 from savings rate and debt ratio */
function simpleScore(monthlyIncome: number, monthlyExpenses: number, emiTotal: number): number {
  const burn = monthlyExpenses + emiTotal
  const savings = monthlyIncome - burn
  const savingsRate = monthlyIncome > 0 ? savings / monthlyIncome : 0
  const debtRatio = monthlyIncome > 0 ? emiTotal / monthlyIncome : 0
  const srScore = Math.min(1, Math.max(0, savingsRate / 0.3)) * 50
  const debtScore = Math.max(0, 1 - debtRatio / 0.4) * 50
  return Math.round(Math.min(100, Math.max(0, srScore + debtScore)))
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const itemPrice = Number(body.itemPrice) || 0
  const downPayment = Number(body.downPayment) || 0
  const loanInterest = Number(body.loanInterest) || 10
  const loanTenureMonths = Math.min(360, Math.max(1, Math.floor(Number(body.loanTenureMonths) || 60)))
  const principal = Math.max(0, itemPrice - downPayment)
  const monthlyEmi = principal > 0 ? emi(principal, loanInterest, loanTenureMonths) : 0

  let monthlyIncome = Number(body.monthlyIncome)
  let monthlyExpenses = Number(body.monthlyExpenses)
  let currentSavings = Number(body.currentSavings)
  let currentAge = Number(body.currentAge) || 30
  let expectedReturn = Number(body.expectedReturn) || 10
  let currentScore = 0

  if (body.useMyData) {
    const [incomes, expenses, loans] = await Promise.all([
      prisma.income.findMany({ where: { userId } }),
      prisma.expense.findMany({ where: { userId } }),
      prisma.loan.findMany({ where: { userId } }),
    ])
    monthlyIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
    monthlyExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const existingEmi = loans.reduce((s, l) => s + Number(l.emi), 0)
    currentSavings = monthlyIncome - monthlyExpenses - existingEmi
    currentScore = simpleScore(monthlyIncome, monthlyExpenses, existingEmi)
  } else {
    monthlyIncome = monthlyIncome || 100000
    monthlyExpenses = monthlyExpenses || 50000
    currentSavings = monthlyIncome - monthlyExpenses
    currentScore = simpleScore(monthlyIncome, monthlyExpenses, 0)
  }

  const newEmiTotal = (body.useMyData ? (await prisma.loan.findMany({ where: { userId } })).reduce((s, l) => s + Number(l.emi), 0) : 0) + monthlyEmi
  const newMonthlySavings = monthlyIncome - monthlyExpenses - newEmiTotal
  const newScore = simpleScore(monthlyIncome, monthlyExpenses, newEmiTotal)

  const fireMultiple = 25
  const monthlyBurn = monthlyExpenses + newEmiTotal
  const annualExpenses = monthlyBurn * 12
  const fireCorpus = annualExpenses * fireMultiple
  const r = expectedReturn / 100
  let yearsToRetire = 0
  let nw = Math.max(0, currentSavings * 12)
  const maxY = 50
  while (nw < fireCorpus && yearsToRetire < maxY) {
    nw = nw * (1 + r) + newMonthlySavings * 12
    yearsToRetire++
  }
  const projectedRetirementAge = currentAge + yearsToRetire

  const impactOnSavings = newMonthlySavings - currentSavings

  return NextResponse.json({
    emi: Math.round(monthlyEmi * 100) / 100,
    totalPayment: Math.round(monthlyEmi * loanTenureMonths * 100) / 100,
    interestCost: Math.round((monthlyEmi * loanTenureMonths - principal) * 100) / 100,
    existingMonthlySavings: Math.round(currentSavings * 100) / 100,
    newMonthlySavings: Math.round(newMonthlySavings * 100) / 100,
    impactOnSavings: Math.round(impactOnSavings * 100) / 100,
    currentScore,
    newScore,
    projectedRetirementAge,
    yearsToRetire,
  })
}
