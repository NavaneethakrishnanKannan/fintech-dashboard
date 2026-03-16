/**
 * Generate structured financial insights from user data.
 */

export type InsightInput = {
  monthlyIncome: number
  monthlyExpenses: number
  monthlySavings: number
  totalEmi: number
  portfolioValue: number
  equityValue: number
  debtValue: number
  emergencyFundMonths: number
  savingsRatePercent: number
  savingsRatePrevMonthPercent?: number
  totalExpenseThisMonth?: number
  totalExpenseLastMonth?: number
  byCategoryThisMonth?: { category: string; amount: number }[]
  byCategoryLastMonth?: { category: string; amount: number }[]
  currentAge?: number
  monthlySip?: number
  expectedReturn?: number
  netWorth?: number
}

export function generateInsights(input: InsightInput): string[] {
  const insights: string[] = []
  const {
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    portfolioValue,
    equityValue,
    debtValue,
    emergencyFundMonths,
    savingsRatePercent,
    savingsRatePrevMonthPercent,
    totalExpenseThisMonth = 0,
    totalExpenseLastMonth = 0,
    currentAge = 30,
    monthlySip = 0,
    expectedReturn = 10,
    netWorth = 0,
  } = input

  if (monthlyIncome > 0 && savingsRatePrevMonthPercent != null && savingsRatePercent !== savingsRatePrevMonthPercent) {
    const diff = savingsRatePercent - savingsRatePrevMonthPercent
    if (Math.abs(diff) >= 1) {
      insights.push(
        diff > 0
          ? `Your savings rate increased by ${diff.toFixed(1)}% this month.`
          : `Your savings rate decreased by ${Math.abs(diff).toFixed(1)}% this month.`
      )
    }
  }

  if (portfolioValue > 0) {
    const equityPct = (equityValue / portfolioValue) * 100
    if (equityPct > 75) insights.push(`Your equity exposure is ${equityPct.toFixed(0)}%. A balanced range is often 60–70% for moderate risk.`)
    else if (equityPct < 30 && debtValue > 0) insights.push(`Your equity allocation is ${equityPct.toFixed(0)}%. Consider increasing equity for long-term growth if your timeline allows.`)
  }

  if (monthlyExpenses + (input.totalEmi || 0) > 0) {
    const months = emergencyFundMonths
    if (months < 3) insights.push(`Your emergency fund covers only ${months.toFixed(1)} months. Aim for 3–6 months of expenses.`)
    else if (months < 6) insights.push(`Your emergency fund covers ${months.toFixed(1)} months. Consider building to 6 months for more security.`)
  }

  if (monthlySip > 0 && expectedReturn > 0 && netWorth >= 0) {
    const r = expectedReturn / 100
    const targetCr = 3
    const targetAmount = targetCr * 1_00_00_000
    let nw = netWorth
    let years = 0
    while (nw < targetAmount && years < 40) {
      nw = nw * (1 + r) + monthlySip * 12
      years++
    }
    const age = currentAge + years
    if (years <= 25 && years > 0) insights.push(`At your current investment rate you could reach ₹${targetCr}Cr by age ${age}.`)
  }

  if (totalExpenseThisMonth > 0 && totalExpenseLastMonth > 0 && totalExpenseLastMonth !== totalExpenseThisMonth) {
    const pct = ((totalExpenseThisMonth - totalExpenseLastMonth) / totalExpenseLastMonth) * 100
    if (Math.abs(pct) >= 10) {
      insights.push(
        pct > 0
          ? `Spending increased ${pct.toFixed(0)}% vs last month.`
          : `Spending decreased ${Math.abs(pct).toFixed(0)}% vs last month.`
      )
    }
  }

  if (monthlyIncome > 0) {
    const debtRatio = (input.totalEmi || 0) / monthlyIncome
    if (debtRatio > 0.4) insights.push(`Your EMI is ${(debtRatio * 100).toFixed(0)}% of income. Keeping it under 40% is usually healthier.`)
  }

  return insights.slice(0, 8)
}
