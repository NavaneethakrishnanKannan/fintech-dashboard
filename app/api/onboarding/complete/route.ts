import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'
import { computeFinancialSnapshotReport } from '@/lib/services/financialSnapshotReport'

type FixedExpenseInput = { label: string; amount: number }
type VariableExpenseInput = { label: string; amount: number }
type LoanInput = { type: string; totalAmount: number; emi: number; interestRate?: number }

type OnboardingPayload = {
  monthlyIncome?: number
  fixedExpenses?: FixedExpenseInput[]
  variableExpenses?: VariableExpenseInput[]
  hasInvestments?: boolean
  totalInvestments?: number
  hasLoans?: boolean
  loans?: LoanInput[]
  primaryGoal?: string
  currentAge?: number
  expectedReturn?: number
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as OnboardingPayload

  const monthlyIncome = Number(body.monthlyIncome) || 0
  const fixedExpensesTotal =
    Array.isArray(body.fixedExpenses) && body.fixedExpenses.length
      ? body.fixedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      : 0
  const estimatedVariableExpenses =
    Array.isArray(body.variableExpenses) && body.variableExpenses.length
      ? body.variableExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      : 0
  const totalInvestments = body.hasInvestments ? Number(body.totalInvestments) || 0 : 0
  const loans = Array.isArray(body.loans) ? body.loans : []
  const totalLoans = loans.reduce((s, l) => s + (Number(l.totalAmount) || 0), 0)
  const totalEmi = loans.reduce((s, l) => s + (Number(l.emi) || 0), 0)
  const primaryGoal = body.primaryGoal ?? null

  const snapshotData = {
    userId,
    monthlyIncome,
    fixedExpensesTotal,
    estimatedVariableExpenses,
    totalInvestments,
    totalLoans,
    primaryGoal: primaryGoal || null,
  }

  // Persist snapshot for future use
  await prisma.financialSnapshot.create({
    data: snapshotData,
  })

  // Keep legacy onboardingCompletion so existing "completed" checks continue to work
  const legacyPayload: OnboardingPayload = {
    monthlyIncome,
    fixedExpenses: body.fixedExpenses ?? [],
    variableExpenses: body.variableExpenses ?? [],
    hasInvestments: body.hasInvestments ?? (totalInvestments > 0),
    totalInvestments,
    hasLoans: body.hasLoans ?? (loans.length > 0),
    loans,
    primaryGoal: primaryGoal || undefined,
    currentAge: body.currentAge,
    expectedReturn: body.expectedReturn,
  }

  await prisma.onboardingCompletion.upsert({
    where: { userId },
    create: { userId, payload: legacyPayload },
    update: { payload: legacyPayload, completedAt: new Date() },
  })

  // Optional "Other Expenses" prefill: create a single generic expense entry
  const totalMonthlyExpenses = fixedExpensesTotal + estimatedVariableExpenses
  if (totalMonthlyExpenses > 0) {
    const existingExpensesCount = await prisma.expense.count({ where: { userId } })
    if (existingExpensesCount === 0) {
      await prisma.expense.create({
        data: {
          userId,
          amount: totalMonthlyExpenses,
          category: 'Other Expenses',
          description: 'Temporary total from onboarding. Replace with detailed categories over time.',
        },
      })
    }
  }

  const report = computeFinancialSnapshotReport({
    monthlyIncome,
    fixedExpensesTotal,
    estimatedVariableExpenses,
    totalInvestments,
    totalLoans,
    totalEmi,
    primaryGoal: primaryGoal || undefined,
    currentAge: body.currentAge ? Number(body.currentAge) : undefined,
    expectedReturnPct: body.expectedReturn ? Number(body.expectedReturn) : undefined,
  })

  return NextResponse.json({ report, completed: true })
}

