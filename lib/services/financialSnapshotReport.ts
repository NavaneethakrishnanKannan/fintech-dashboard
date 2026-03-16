export type FinancialSnapshotInput = {
  monthlyIncome: number
  fixedExpensesTotal: number
  estimatedVariableExpenses: number
  totalInvestments: number
  totalLoans: number
  totalEmi: number
  primaryGoal?: string | null
}

export type FinancialSnapshotReport = {
  financialScore: number
  savingsRate: number // 0–100 (%)
  emergencyFundMonths: number
  debtRatio: number // EMI / income (0–1)
  debtLabel: 'Low' | 'Moderate' | 'High'
  projectedRetirementAge: number | null
}

export function computeFinancialSnapshotReport(
  input: FinancialSnapshotInput & { currentAge?: number; expectedReturnPct?: number },
): FinancialSnapshotReport {
  const income = Math.max(0, input.monthlyIncome)
  const fixed = Math.max(0, input.fixedExpensesTotal)
  const variable = Math.max(0, input.estimatedVariableExpenses)
  const emi = Math.max(0, input.totalEmi)
  const expenses = fixed + variable
  const monthlyBurn = expenses + emi

  const savings = income - monthlyBurn
  const savingsRate = income > 0 ? savings / income : 0

  // Treat total investments as rough emergency + long-term buffer
  const liquidPlusInvest = Math.max(0, input.totalInvestments)
  const emergencyFundMonths = monthlyBurn > 0 ? liquidPlusInvest / monthlyBurn : 0

  const debtRatio = income > 0 ? emi / income : 0
  const debtLabel: FinancialSnapshotReport['debtLabel'] =
    debtRatio < 0.2 ? 'Low' : debtRatio <= 0.4 ? 'Moderate' : 'High'

  // Financial score: combine savings rate, debt, emergency fund
  const savingsRateScore = Math.min(1, Math.max(0, savingsRate / 0.3))
  const debtScore = Math.max(0, 1 - debtRatio / 0.4)
  const emergencyScore = Math.min(1, emergencyFundMonths / 6)
  const financialScore = Math.round(
    Math.min(100, Math.max(0, savingsRateScore * 30 + debtScore * 25 + emergencyScore * 25 + (savings > 0 ? 20 : 0))),
  )

  // Simple retirement age estimate using FIRE-style corpus
  const currentAge = input.currentAge ?? 30
  const expectedReturn = (input.expectedReturnPct ?? 10) / 100
  const fireMultiple = 25
  const annualExpenses = monthlyBurn * 12
  const fireCorpus = annualExpenses * fireMultiple

  let projectedRetirementAge: number | null = currentAge
  if (fireCorpus <= 0 || income <= 0) {
    projectedRetirementAge = null
  } else {
    let nw = Math.max(0, input.totalInvestments - input.totalLoans)
    const annualSip = Math.max(0, savings * 12)
    let years = 0
    const maxYears = 50
    while (nw < fireCorpus && years < maxYears) {
      nw = nw * (1 + expectedReturn) + annualSip
      years++
    }
    projectedRetirementAge = years >= maxYears ? null : Math.min(currentAge + years, 99)
  }

  return {
    financialScore,
    savingsRate: Math.round(savingsRate * 1000) / 10, // one decimal %
    emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10,
    debtRatio,
    debtLabel,
    projectedRetirementAge,
  }
}

