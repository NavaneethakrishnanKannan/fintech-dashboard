'use client'

import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type Summary = {
  KPIs?: {
    totalIncome?: number
    totalExpenses?: number
    totalLoanEmi?: number
    totalExpensesIncludingEmi?: number
    monthlySavings?: number
    totalMonthlySip?: number
  }
  expenses?: { category: string; amount: number }[]
}
type Goal = { id: string; title: string; targetAmount: number }

type PlannerResponse = {
  plan?: string
  structured?: {
    suggestedExpensesTotal: number
    monthlySavings: number
    budgetBreakdown: { category: string; amount: number; note?: string }[]
    allocations: { purpose: string; amount: number; note?: string }[]
    summary: string
  }
  current?: {
    totalExpenses: number
    totalEmi: number
    monthlySavings: number
    income: number
    totalMonthlySip?: number
    expensesByCategory?: { category: string; amount: number }[]
  }
}

function formatRupee(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

function formatPlanText(text: string) {
  const parts = text.split(/\n\n+/)
  return parts.map((block, idx) => {
    const trimmed = block.trim()
    if (!trimmed) return null
    const isHeading = /^[\d]+\.\s+\*\*/.test(trimmed) || /^\*\*[^*]+\*\*/.test(trimmed)
    const lineContent = trimmed.replace(/^[\d.]+\s*/, '')
    const segments = lineContent.split(/(\*\*[^*]+\*\*)/g).map((seg, i) => {
      const match = seg.match(/\*\*([^*]+)\*\*/)
      return match ? <strong key={i}>{match[1]}</strong> : seg
    })
    return (
      <p key={idx} className={isHeading ? 'font-medium text-gray-900 dark:text-gray-100 mt-3 first:mt-0' : 'mt-1.5 text-gray-700 dark:text-gray-300'}>
        {segments}
      </p>
    )
  }).filter(Boolean)
}

export default function PlannerPage() {
  const [plan, setPlan] = useState<string | null>(null)
  const [structured, setStructured] = useState<PlannerResponse['structured']>(null)
  const [planCurrent, setPlanCurrent] = useState<PlannerResponse['current']>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<{ income: number; expenses: number; byCategory: { category: string; amount: number }[]; emi: number; savings: number; sip: number; goals: Goal[] } | null>(null)

  useEffect(() => {
    Promise.all([
      axios.get<Summary>('/api/summary'),
      axios.get<Goal[]>('/api/goals'),
    ]).then(([sRes, gRes]) => {
      const kpis = sRes.data?.KPIs
      const expenses = sRes.data?.expenses ?? []
      const byCategory: Record<string, number> = {}
      for (const e of expenses) {
        const cat = (e as { category?: string }).category ?? 'Other'
        byCategory[cat] = (byCategory[cat] ?? 0) + Number((e as { amount?: number }).amount ?? 0)
      }
      setSnapshot({
        income: kpis?.totalIncome ?? 0,
        expenses: kpis?.totalExpenses ?? 0,
        byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
        emi: kpis?.totalLoanEmi ?? 0,
        savings: kpis?.monthlySavings ?? 0,
        sip: kpis?.totalMonthlySip ?? 0,
        goals: Array.isArray(gRes.data) ? gRes.data : [],
      })
    }).catch(() => setSnapshot(null))
  }, [])

  // Scale allocation amounts to fit balance so the plan never exceeds income
  const displayAllocations = useMemo(() => {
    if (!structured?.allocations?.length || !planCurrent) return structured?.allocations ?? []
    const suggestedExpensesFromBreakdown =
      structured.budgetBreakdown?.length > 0
        ? structured.budgetBreakdown
            .filter((row) => row.category.trim().toLowerCase() !== 'emi')
            .reduce((s, row) => s + row.amount, 0)
        : structured.suggestedExpensesTotal ?? 0
    const balanceForSuggestion =
      planCurrent.income -
      suggestedExpensesFromBreakdown -
      planCurrent.totalEmi -
      (planCurrent.totalMonthlySip ?? 0)
    const total = structured.allocations.reduce((s, a) => s + (a.amount ?? 0), 0)
    if (balanceForSuggestion <= 0) return structured.allocations.map((a) => ({ ...a, amount: 0 }))
    if (total <= balanceForSuggestion) return structured.allocations
    const scale = balanceForSuggestion / total
    const rounded = structured.allocations.map((a) => ({ ...a, amount: Math.round((a.amount ?? 0) * scale) }))
    const sum = rounded.reduce((s, a) => s + a.amount, 0)
    const diff = balanceForSuggestion - sum
    if (diff !== 0 && rounded.length > 0) {
      const idx = diff > 0 ? rounded.reduce((i, _, j) => (rounded[j].amount > (rounded[i].amount ?? 0) ? j : i), 0) : rounded.reduce((i, _, j) => (rounded[j].amount < (rounded[i].amount ?? 0) ? j : i), 0)
      rounded[idx] = { ...rounded[idx], amount: Math.max(0, (rounded[idx].amount ?? 0) + diff) }
    }
    return rounded
  }, [structured, planCurrent])

  const fetchPlan = async () => {
    setLoading(true)
    setError(null)
    setPlan(null)
    setStructured(null)
    setPlanCurrent(null)
    try {
      const res = await axios.post<PlannerResponse & { error?: string; details?: string }>('/api/ai/planner')
      setPlan(res.data?.plan ?? null)
      setStructured(res.data?.structured ?? null)
      setPlanCurrent(res.data?.current ?? null)
      if (res.data?.error) setError(res.data.details ?? res.data.error)
    } catch (e: unknown) {
      const err = e && typeof e === 'object' && 'response' in e && (e as { response?: { data?: { error?: string; details?: string } } }).response?.data
      setError(err?.details ?? err?.error ?? 'Failed to load planner.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI Planner</h1>

      {snapshot && (
        <DashboardCard title="Currently you're doing">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Your numbers from the dashboard. The AI plan below is based on this.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Income</p>
              <p className="font-semibold">{formatRupee(snapshot.income)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="font-semibold">{formatRupee(snapshot.expenses)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Loan EMI</p>
              <p className="font-semibold">{formatRupee(snapshot.emi)}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Monthly savings</p>
              <p className="font-semibold">{formatRupee(snapshot.savings)}</p>
            </div>
          </div>
          {snapshot.byCategory.length > 0 && (
            <div className="mt-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Spending by category</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {snapshot.byCategory.map((c) => (
                  <li key={c.category} className="text-gray-700 dark:text-gray-300">{c.category}: {formatRupee(c.amount)}</li>
                ))}
              </ul>
            </div>
          )}
          {snapshot.sip > 0 && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Existing SIP: {formatRupee(snapshot.sip)}/month</p>
          )}
          {snapshot.goals.length > 0 && (
            <div className="mt-3">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Goals</p>
              <ul className="text-sm text-gray-700 dark:text-gray-300">
                {snapshot.goals.map((g) => (
                  <li key={g.id}>{g.title}: {formatRupee(Number(g.targetAmount))}</li>
                ))}
              </ul>
            </div>
          )}
        </DashboardCard>
      )}

      <DashboardCard title="Get your plan">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Based on the numbers above, the AI will suggest a monthly budget, how much you can save, and how to use that savings (emergency fund, goals, investments).
        </p>
        <button
          type="button"
          onClick={fetchPlan}
          disabled={loading}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Get AI planner'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </DashboardCard>

      {plan && (
        <>
          {structured && planCurrent ? (
            <>
              {(() => {
                // Use sum of budget breakdown (excl. EMI) so "Suggested expenses" matches the table below
                const suggestedExpensesFromBreakdown =
                  structured.budgetBreakdown?.length > 0
                    ? structured.budgetBreakdown
                        .filter((row) => row.category.trim().toLowerCase() !== 'emi')
                        .reduce((s, row) => s + row.amount, 0)
                    : structured.suggestedExpensesTotal
                const existingSip = planCurrent.totalMonthlySip ?? 0
                const balanceForSuggestion = planCurrent.income - suggestedExpensesFromBreakdown - planCurrent.totalEmi - existingSip
                return (
                  <>
                    <DashboardCard title="How much you can save">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Expenses, EMI and Existing SIP are already committed; balance can be used for suggested allocation below.</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm max-w-md">
                          <tbody>
                            <tr className="border-b border-gray-200 dark:border-gray-600">
                              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">Income</td>
                              <td className="py-2 text-right font-medium">{formatRupee(planCurrent.income)}</td>
                            </tr>
                            <tr className="border-b border-gray-200 dark:border-gray-600">
                              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">− Suggested expenses</td>
                              <td className="py-2 text-right font-medium">− {formatRupee(suggestedExpensesFromBreakdown)}</td>
                            </tr>
                            <tr className="border-b border-gray-200 dark:border-gray-600">
                              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">− EMI (already committed)</td>
                              <td className="py-2 text-right font-medium">− {formatRupee(planCurrent.totalEmi)}</td>
                            </tr>
                            {existingSip > 0 && (
                              <tr className="border-b border-gray-200 dark:border-gray-600">
                                <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">− Existing SIP / investments (already committed)</td>
                                <td className="py-2 text-right font-medium">− {formatRupee(existingSip)}</td>
                              </tr>
                            )}
                            <tr className="border-t-2 border-gray-300 dark:border-gray-500">
                              <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-gray-100">= Balance for suggested allocation</td>
                              <td className="py-3 text-right text-lg font-bold text-green-600 dark:text-green-400">
                                {formatRupee(balanceForSuggestion)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </DashboardCard>
                  </>
                )
              })()}

              {structured.budgetBreakdown && structured.budgetBreakdown.length > 0 && (() => {
                // Prefer planner API's expensesByCategory (same data the AI saw); fallback to snapshot
                const source = (planCurrent?.expensesByCategory?.length ? planCurrent.expensesByCategory : snapshot?.byCategory) ?? []
                const currentByCategory: Record<string, number> = {}
                for (const c of source) {
                  const key = c.category.trim().toLowerCase()
                  currentByCategory[key] = (currentByCategory[key] ?? 0) + c.amount
                }
                // Find current amount for an AI category: exact key, or first key that contains/equals AI label
                const getCurrent = (aiCategory: string) => {
                  const k = aiCategory.trim().toLowerCase()
                  if (currentByCategory[k] != null) return currentByCategory[k]
                  const found = Object.entries(currentByCategory).find(([db]) => db === k || db.startsWith(k) || k.startsWith(db) || db.includes(k) || k.includes(db))
                  return found ? found[1] : 0
                }
                // Exclude EMI from breakdown (EMI is in "How much you can save")
                const breakdownWithoutEmi = structured.budgetBreakdown.filter((row) => row.category.trim().toLowerCase() !== 'emi')
                let totalCurrent = 0
                let totalSuggested = 0
                let totalReduceBy = 0
                return (
                  <DashboardCard title="Suggested budget by category">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Expense categories only; EMI is shown in the section above.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[32rem] text-sm" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                          <col className="w-auto" />
                          <col style={{ width: '6.5rem', minWidth: '6.5rem' }} />
                          <col style={{ width: '6.5rem', minWidth: '6.5rem' }} />
                          <col style={{ width: '6rem', minWidth: '6rem' }} />
                          <col className="min-w-0" />
                        </colgroup>
                        <thead>
                          <tr className="border-b-2 border-gray-200 dark:border-gray-600">
                            <th className="py-2.5 pr-3 text-left font-semibold text-gray-900 dark:text-gray-100">Category</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-gray-900 dark:text-gray-100">Current</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-gray-900 dark:text-gray-100">Suggested</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-gray-900 dark:text-gray-100">Reduce by</th>
                            <th className="py-2.5 pl-3 text-left font-semibold text-gray-500 dark:text-gray-400">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdownWithoutEmi.map((row, i) => {
                            const current = getCurrent(row.category)
                            const suggested = row.amount
                            const reduceBy = current > suggested ? current - suggested : 0
                            const increaseBy = suggested > current ? suggested - current : 0
                            totalCurrent += current
                            totalSuggested += suggested
                            totalReduceBy += reduceBy
                            return (
                              <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                                <td className="py-2.5 pr-3 text-gray-900 dark:text-gray-100">{row.category}</td>
                                <td className="py-2.5 px-2 text-right whitespace-nowrap text-gray-600 dark:text-gray-400">{current ? formatRupee(current) : '—'}</td>
                                <td className="py-2.5 px-2 text-right whitespace-nowrap font-semibold text-gray-900 dark:text-gray-100">{formatRupee(suggested)}</td>
                                <td className="py-2.5 px-2 text-right whitespace-nowrap">
                                  {reduceBy > 0 ? <span className="font-medium text-green-600 dark:text-green-400">{formatRupee(reduceBy)}</span> : increaseBy > 0 ? <span className="font-medium text-amber-600 dark:text-amber-400">+{formatRupee(increaseBy)}</span> : '—'}
                                </td>
                                <td className="py-2.5 pl-3 text-gray-500 dark:text-gray-400">{row.note ?? '—'}</td>
                              </tr>
                            )
                          })}
                          <tr className="border-t-2 border-gray-300 dark:border-gray-500 bg-gray-100/80 dark:bg-gray-800/50 font-semibold">
                            <td className="py-3 pr-3 text-gray-900 dark:text-gray-100">Total</td>
                            <td className="py-3 px-2 text-right whitespace-nowrap text-gray-700 dark:text-gray-300">{totalCurrent ? formatRupee(totalCurrent) : '—'}</td>
                            <td className="py-3 px-2 text-right whitespace-nowrap text-gray-900 dark:text-gray-100">{formatRupee(totalSuggested)}</td>
                            <td className="py-3 px-2 text-right whitespace-nowrap">
                              {totalReduceBy > 0 ? <span className="text-green-600 dark:text-green-400">{formatRupee(totalReduceBy)}—</span> : '—'}
                            </td>
                            <td className="py-3 pl-3 text-gray-500 dark:text-gray-400">—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </DashboardCard>
                )
              })()}

              <DashboardCard title="Where your savings go">
                {(() => {
                  // Same as "How much you can save": use sum of breakdown so it matches the budget table
                  const suggestedExpensesFromBreakdown =
                    structured.budgetBreakdown?.length > 0
                      ? structured.budgetBreakdown
                          .filter((row) => row.category.trim().toLowerCase() !== 'emi')
                          .reduce((s, row) => s + row.amount, 0)
                      : structured.suggestedExpensesTotal
                  const existingSipAmount = planCurrent.totalMonthlySip ?? 0
                  const balanceForSuggestion = planCurrent.income - suggestedExpensesFromBreakdown - planCurrent.totalEmi - existingSipAmount
                  const suggestedAllocationTotal = displayAllocations.reduce((s, a) => s + (a.amount ?? 0), 0)
                  return (
                    <>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                        You have <strong>{formatRupee(balanceForSuggestion)}</strong> for suggested allocation (after expenses, EMI and Existing SIP in the section above). Allocate it like this:
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[24rem] text-sm" style={{ tableLayout: 'fixed' }}>
                          <colgroup>
                            <col className="w-auto" />
                            <col style={{ width: '8rem', minWidth: '8rem' }} />
                            <col className="min-w-0" />
                          </colgroup>
                          <thead>
                            <tr className="border-b-2 border-gray-200 dark:border-gray-600">
                              <th className="py-2.5 pr-3 text-left font-semibold text-gray-900 dark:text-gray-100">Purpose</th>
                              <th className="py-2.5 px-2 text-right font-semibold text-gray-900 dark:text-gray-100">Per month</th>
                              <th className="py-2.5 pl-3 text-left font-semibold text-gray-500 dark:text-gray-400">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayAllocations.map((a, i) => (
                              <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                                <td className="py-2.5 pr-3 text-gray-900 dark:text-gray-100">{a.purpose}</td>
                                <td className="py-2.5 px-2 text-right whitespace-nowrap font-semibold text-gray-900 dark:text-gray-100">{formatRupee(a.amount)}/mo</td>
                                <td className="py-2.5 pl-3 text-gray-500 dark:text-gray-400">{a.note ?? '—'}</td>
                              </tr>
                            ))}
                            {displayAllocations.length > 0 ? (
                              <tr className="border-t-2 border-gray-300 dark:border-gray-500 bg-green-50/60 dark:bg-green-950/30 font-semibold">
                                <td className="py-2.5 pr-3 text-gray-900 dark:text-gray-100">Total</td>
                                <td className="py-2.5 px-2 text-right whitespace-nowrap text-gray-900 dark:text-gray-100">{formatRupee(suggestedAllocationTotal)}/mo</td>
                                <td className="py-2.5 pl-3 text-gray-500 dark:text-gray-400" />
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )
                })()}
              </DashboardCard>

              {(() => {
                const suggestedExpensesFromBreakdown =
                  structured.budgetBreakdown?.length > 0
                    ? structured.budgetBreakdown
                        .filter((row) => row.category.trim().toLowerCase() !== 'emi')
                        .reduce((s, row) => s + row.amount, 0)
                    : structured.suggestedExpensesTotal
                const breakdownWithoutEmi = structured.budgetBreakdown?.filter((row) => row.category.trim().toLowerCase() !== 'emi') ?? []
                const emi = planCurrent?.totalEmi ?? 0
                const existingSip = planCurrent?.totalMonthlySip ?? 0
                const allocationTotal = displayAllocations.reduce((s, a) => s + (a.amount ?? 0), 0)
                const totalSpending = suggestedExpensesFromBreakdown + emi + existingSip + allocationTotal
                return (
                  <DashboardCard title="Income &amp; spending summary">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Overall income and spending by category.</p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[20rem] text-sm" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr className="border-b-2 border-gray-200 dark:border-gray-600">
                            <th className="py-2.5 pr-3 text-left font-semibold text-gray-900 dark:text-gray-100">Category</th>
                            <th className="py-2.5 px-2 text-right font-semibold text-gray-900 dark:text-gray-100">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-blue-50/50 dark:bg-blue-950/30">
                            <td className="py-2.5 pr-3 font-semibold text-gray-900 dark:text-gray-100">Income</td>
                            <td className="py-2.5 px-2 text-right font-semibold text-gray-900 dark:text-gray-100">{formatRupee(planCurrent.income)}</td>
                          </tr>
                          <tr className="border-b border-gray-100 dark:border-gray-700/50">
                            <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 text-xs font-medium uppercase tracking-wide">Spending</td>
                            <td className="py-2 px-2 text-right" />
                          </tr>
                          {breakdownWithoutEmi.map((row, i) => (
                            <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                              <td className="py-2 pr-3 pl-4 text-gray-700 dark:text-gray-300">{row.category}</td>
                              <td className="py-2 px-2 text-right font-medium">{formatRupee(row.amount)}</td>
                            </tr>
                          ))}
                          {emi > 0 && (
                            <tr className="border-b border-gray-100 dark:border-gray-700/50">
                              <td className="py-2 pr-3 pl-4 text-gray-700 dark:text-gray-300">EMI</td>
                              <td className="py-2 px-2 text-right font-medium">{formatRupee(emi)}</td>
                            </tr>
                          )}
                          {existingSip > 0 && (
                            <tr className="border-b border-gray-100 dark:border-gray-700/50">
                              <td className="py-2 pr-3 pl-4 text-gray-700 dark:text-gray-300">Existing SIP / investments</td>
                              <td className="py-2 px-2 text-right font-medium">{formatRupee(existingSip)}</td>
                            </tr>
                          )}
                          {displayAllocations.map((a, i) => (
                            <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50">
                              <td className="py-2 pr-3 pl-4 text-gray-700 dark:text-gray-300">{a.purpose}</td>
                              <td className="py-2 px-2 text-right font-medium">{formatRupee(a.amount)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-gray-300 dark:border-gray-500 bg-gray-100/80 dark:bg-gray-800/50 font-semibold">
                            <td className="py-3 pr-3 text-gray-900 dark:text-gray-100">Total spending</td>
                            <td className="py-3 px-2 text-right text-gray-900 dark:text-gray-100">{formatRupee(totalSpending)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </DashboardCard>
                )
              })()}

              {structured.summary && (
                <DashboardCard title="Summary">
                  <p className="text-gray-700 dark:text-gray-300">{structured.summary}</p>
                </DashboardCard>
              )}
            </>
          ) : (
            <DashboardCard title="Your suggested plan">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Based on your current numbers above.</p>
              <div className="text-sm space-y-0">
                {formatPlanText(plan)}
              </div>
            </DashboardCard>
          )}
        </>
      )}
    </div>
  )
}
