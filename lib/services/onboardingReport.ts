/**
 * Compute instant report from onboarding payload (no DB required).
 * Used after onboarding completion to show financial score, savings rate, emergency fund, projected retirement.
 */

export type OnboardingPayload = {
  monthlyIncome: number
  monthlyExpenses: number
  currentSavings: number
  investmentsValue?: number
  loansPrincipal?: number
  loansEmi?: number
  currentAge?: number
  expectedReturn?: number
}

export type OnboardingReport = {
  financialScore: number
  savingsRate: number
  emergencyFundMonths: number
  projectedRetirementAge: number | null
  suggestions: string[]
}

export function computeOnboardingReport(p: OnboardingPayload): OnboardingReport {
  const income = Math.max(0, p.monthlyIncome)
  const expenses = Math.max(0, p.monthlyExpenses)
  const emi = Math.max(0, p.loansEmi ?? 0)
  const monthlyBurn = expenses + emi
  const savings = income - monthlyBurn
  const savingsRate = income > 0 ? savings / income : 0
  const liquidPlusInvest = Math.max(0, p.currentSavings ?? 0) + Math.max(0, p.investmentsValue ?? 0)
  const emergencyFundMonths = monthlyBurn > 0 ? liquidPlusInvest / monthlyBurn : 0

  // Score components (0–1 each), weighted
  const savingsRateScore = Math.min(1, Math.max(0, savingsRate / 0.35))
  const debtToIncome = income > 0 ? emi / income : 0
  const debtScore = Math.max(0, 1 - debtToIncome / 0.4)
  const emergencyScore = Math.min(1, emergencyFundMonths / 6)
  const financialScore = Math.round(
    Math.min(100, Math.max(0, savingsRateScore * 30 + debtScore * 25 + emergencyScore * 25 + (savings > 0 ? 20 : 0)))
  )

  const suggestions: string[] = []
  if (savingsRate < 0.2) suggestions.push('Aim to save at least 20–30% of your income.')
  if (debtToIncome > 0.4) suggestions.push('Keep EMI under 40% of income for a healthy debt ratio.')
  if (emergencyFundMonths < 3) suggestions.push('Build an emergency fund of 3–6 months of expenses.')
  if (emergencyFundMonths >= 3 && emergencyFundMonths < 6) suggestions.push('Consider growing emergency fund to 6 months for more security.')

  const currentAge = p.currentAge ?? 30
  const expectedReturn = (p.expectedReturn ?? 10) / 100
  const fireMultiple = 25
  const annualExpenses = monthlyBurn * 12
  const fireCorpus = annualExpenses * fireMultiple
  let projectedRetirementAge: number | null = currentAge
  if (fireCorpus <= 0) {
    projectedRetirementAge = null
  } else {
    let nw = liquidPlusInvest - Math.max(0, p.loansPrincipal ?? 0)
    nw = Math.max(0, nw)
    const annualSip = Math.max(0, savings * 12)
    const r = expectedReturn
    let years = 0
    const maxYears = 50
    while (nw < fireCorpus && years < maxYears) {
      nw = nw * (1 + r) + annualSip
      years++
    }
    projectedRetirementAge = Math.min(currentAge + years, 99)
  }

  return {
    financialScore,
    savingsRate: Math.round(savingsRate * 1000) / 10,
    emergencyFundMonths: Math.round(emergencyFundMonths * 10) / 10,
    projectedRetirementAge,
    suggestions,
  }
}
