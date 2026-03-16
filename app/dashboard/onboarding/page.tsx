'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper'
import { IncomeStep } from '@/components/onboarding/IncomeStep'
import { FixedExpensesStep, FixedExpenseRow } from '@/components/onboarding/FixedExpensesStep'
import { VariableExpensesStep, VariableExpenseRow } from '@/components/onboarding/VariableExpensesStep'
import { InvestmentsStep } from '@/components/onboarding/InvestmentsStep'
import { LoansStep, LoanRow } from '@/components/onboarding/LoansStep'
import { GoalStep } from '@/components/onboarding/GoalStep'
import { SummaryStep } from '@/components/onboarding/SummaryStep'
import type { FinancialSnapshotReport } from '@/lib/services/financialSnapshotReport'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type PrimaryGoal =
  | 'Retire early'
  | 'Buy a house'
  | 'Build wealth'
  | 'Emergency fund'
  | 'Children education'

const STEPS = [
  { key: 'income', label: 'Monthly income' },
  { key: 'fixed', label: 'Fixed expenses' },
  { key: 'variable', label: 'Variable expenses (optional)' },
  { key: 'investments', label: 'Investments' },
  { key: 'loans', label: 'Loans' },
  { key: 'goal', label: 'Primary goal' },
] as const

type OnboardingState = {
  monthlyIncome: number | null
  fixedExpenses: FixedExpenseRow[]
  variableExpenses: VariableExpenseRow[]
  hasInvestments: boolean | null
  totalInvestments: number | null
  hasLoans: boolean | null
  loans: LoanRow[]
  primaryGoal: PrimaryGoal | null
}

export default function OnboardingPage() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [report, setReport] = useState<FinancialSnapshotReport | null>(null)
  const [state, setState] = useState<OnboardingState>({
    monthlyIncome: null,
    fixedExpenses: [],
    variableExpenses: [],
    hasInvestments: null,
    totalInvestments: null,
    hasLoans: null,
    loans: [],
    primaryGoal: null,
  })

  useEffect(() => {
    axios
      .get<{ completed: boolean }>('/api/onboarding/status')
      .then((res) => {
        if (res.data.completed) {
          setCompleted(true)
          router.replace('/dashboard')
        }
      })
      .catch(() => {
        // ignore
      })
      .finally(() => setLoading(false))
  }, [router])

  const isLastStep = stepIndex === STEPS.length - 1

  const goNext = async () => {
    if (isLastStep) {
      await submit()
      return
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }

  const goBack = () => {
    setStepIndex((i) => Math.max(0, i - 1))
  }

  const submit = async () => {
    const payload = {
      monthlyIncome: state.monthlyIncome ?? 0,
      fixedExpenses: state.fixedExpenses.map((r) => ({ label: r.label || 'Fixed', amount: r.amount || 0 })),
      variableExpenses: state.variableExpenses.map((r) => ({ label: r.label || 'Variable', amount: r.amount || 0 })),
      hasInvestments: state.hasInvestments ?? (state.totalInvestments != null && state.totalInvestments > 0),
      totalInvestments: state.totalInvestments ?? 0,
      hasLoans: state.hasLoans ?? (state.loans.length > 0),
      loans: state.loans.map((l) => ({
        type: l.type || 'Loan',
        totalAmount: l.totalAmount || 0,
        emi: l.emi || 0,
        interestRate: l.interestRate,
      })),
      primaryGoal: state.primaryGoal ?? undefined,
    }
    try {
      const res = await axios.post<{ report: FinancialSnapshotReport }>('/api/onboarding/complete', payload)
      setReport(res.data.report)
      setCompleted(true)
    } catch {
      setReport(null)
    }
  }

  if (loading) return <div className="py-8 text-gray-500">Loading…</div>
  if (completed && report) {
    return <SummaryStep report={report} />
  }

  const currentStep = STEPS[stepIndex]

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Financial onboarding</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        A short guided flow to personalize your dashboard. You can refine everything later in each module.
      </p>

      <OnboardingStepper steps={STEPS as unknown as { key: string; label: string }[]} currentIndex={stepIndex} />

      <DashboardCard title={currentStep.label}>
        {currentStep.key === 'income' && (
          <IncomeStep
            value={state.monthlyIncome}
            onChange={(v) => setState((s) => ({ ...s, monthlyIncome: v }))}
          />
        )}

        {currentStep.key === 'fixed' && (
          <FixedExpensesStep
            rows={state.fixedExpenses}
            onChange={(rows) => setState((s) => ({ ...s, fixedExpenses: rows }))}
          />
        )}

        {currentStep.key === 'variable' && (
          <VariableExpensesStep
            rows={state.variableExpenses}
            onChange={(rows) => setState((s) => ({ ...s, variableExpenses: rows }))}
            onSkip={() => {
              setState((s) => ({ ...s, variableExpenses: [] }))
              goNext()
            }}
          />
        )}

        {currentStep.key === 'investments' && (
          <InvestmentsStep
            hasInvestments={state.hasInvestments}
            totalInvestments={state.totalInvestments}
            onChange={({ hasInvestments, totalInvestments }) =>
              setState((s) => ({ ...s, hasInvestments, totalInvestments }))
            }
          />
        )}

        {currentStep.key === 'loans' && (
          <LoansStep
            hasLoans={state.hasLoans}
            loans={state.loans}
            onChange={({ hasLoans, loans }) => setState((s) => ({ ...s, hasLoans, loans }))}
          />
        )}

        {currentStep.key === 'goal' && (
          <GoalStep
            value={state.primaryGoal}
            onChange={(v) => setState((s) => ({ ...s, primaryGoal: v }))}
          />
        )}

        <div className="flex justify-between pt-4">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </DashboardCard>
    </div>
  )
}

