'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type SectionKey = 'income' | 'expenses' | 'investments' | 'loans' | 'goals'

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Travel', 'Rent', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Education', 'Other']

const SECTIONS: { key: SectionKey; title: string; description: string }[] = [
  {
    key: 'income',
    title: 'Income',
    description: 'Add salary and other regular income. Powers savings rate, AI Planner and FIRE projections.',
  },
  {
    key: 'expenses',
    title: 'Expenses',
    description: 'Capture key spending like rent, bills and food. Powers savings rate, budgets and alerts.',
  },
  {
    key: 'investments',
    title: 'Investments',
    description: 'Manual holdings (MF, stocks, others). Powers portfolio, projections and AI insights.',
  },
  {
    key: 'loans',
    title: 'Loans',
    description: 'Home, car and personal loans. Powers EMI stats, affordability and payoff simulations.',
  },
  {
    key: 'goals',
    title: 'Goals',
    description: 'Retire early, buy a house, build wealth, etc. Powers projections and advice.',
  },
]

export default function AddDataPage() {
  const searchParams = useSearchParams()
  const initial = (searchParams.get('section') as SectionKey) || 'income'

  const [openKey, setOpenKey] = useState<SectionKey>(initial)

  const [incomeForm, setIncomeForm] = useState({ amount: '', category: 'Salary' })
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'Food', description: '' })
  const [investmentForm, setInvestmentForm] = useState({ name: '', type: 'STOCK', quantity: '1', buyPrice: '', currentPrice: '' })
  const [loanForm, setLoanForm] = useState({ name: '', principal: '', emi: '', interest: '', tenure: '' })
  const [goalForm, setGoalForm] = useState({ title: '', targetAmount: '', currentAmount: '0' })

  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const incomeAmountRef = useRef<HTMLInputElement | null>(null)
  const expenseAmountRef = useRef<HTMLInputElement | null>(null)
  const investmentNameRef = useRef<HTMLInputElement | null>(null)
  const loanNameRef = useRef<HTMLInputElement | null>(null)
  const goalTitleRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const fromUrl = searchParams.get('section') as SectionKey | null
    if (fromUrl && SECTIONS.some((s) => s.key === fromUrl)) {
      setOpenKey(fromUrl)
      const el = document.getElementById(`add-${fromUrl}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }, [searchParams])

  useEffect(() => {
    // Focus first input of the opened section
    const focus = (el: HTMLInputElement | null) => {
      if (!el) return
      // Small timeout so browser has applied layout before focusing
      setTimeout(() => el.focus(), 10)
    }
    if (openKey === 'income') focus(incomeAmountRef.current)
    if (openKey === 'expenses') focus(expenseAmountRef.current)
    if (openKey === 'investments') focus(investmentNameRef.current)
    if (openKey === 'loans') focus(loanNameRef.current)
    if (openKey === 'goals') focus(goalTitleRef.current)
  }, [openKey])

  const handleToggle = (key: SectionKey) => {
    setOpenKey((prev) => (prev === key ? prev : key))
    setToast(null)
  }

  const handleSubmitIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(incomeForm.amount)
    if (!amt || amt <= 0 || submitting) return
    setSubmitting(true)
    setToast(null)
    try {
      await axios.post('/api/incomes', { amount: amt, category: incomeForm.category })
      setIncomeForm({ amount: '', category: 'Salary' })
      setToast('Income added.')
    } catch {
      setToast('Failed to add income.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(expenseForm.amount)
    if (!amt || amt <= 0 || submitting) return
    setSubmitting(true)
    setToast(null)
    try {
      await axios.post('/api/expenses', {
        amount: amt,
        category: expenseForm.category,
        description: expenseForm.description.trim() || undefined,
        date: new Date().toISOString().slice(0, 10),
      })
      setExpenseForm({ amount: '', category: 'Food', description: '' })
      setToast('Expense added.')
    } catch {
      setToast('Failed to add expense.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitInvestment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!investmentForm.name.trim() || !investmentForm.buyPrice || submitting) return
    setSubmitting(true)
    setToast(null)
    try {
      await axios.post('/api/investments', {
        name: investmentForm.name.trim(),
        type: investmentForm.type,
        quantity: Number(investmentForm.quantity) || 1,
        buyPrice: Number(investmentForm.buyPrice),
        currentPrice: investmentForm.currentPrice ? Number(investmentForm.currentPrice) : null,
        buyDate: new Date().toISOString().slice(0, 10),
      })
      setInvestmentForm({ name: '', type: 'STOCK', quantity: '1', buyPrice: '', currentPrice: '' })
      setToast('Investment added.')
    } catch {
      setToast('Failed to add investment.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    const principal = Number(loanForm.principal)
    const emi = Number(loanForm.emi)
    const tenure = Number(loanForm.tenure)
    if (!loanForm.name.trim() || !principal || !emi || !tenure || submitting) return
    setSubmitting(true)
    setToast(null)
    try {
      await axios.post('/api/loans', {
        name: loanForm.name.trim(),
        principal,
        interest: loanForm.interest ? Number(loanForm.interest) : 0,
        tenure,
        totalTenureMonths: tenure,
        emi,
        startDate: new Date().toISOString().slice(0, 10),
      })
      setLoanForm({ name: '', principal: '', emi: '', interest: '', tenure: '' })
      setToast('Loan added.')
    } catch {
      setToast('Failed to add loan.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetAmount = Number(goalForm.targetAmount)
    const currentAmount = Number(goalForm.currentAmount) || 0
    if (!goalForm.title.trim() || !targetAmount || submitting) return
    setSubmitting(true)
    setToast(null)
    try {
      await axios.post('/api/goals', {
        title: goalForm.title.trim(),
        targetAmount,
        currentAmount,
      })
      setGoalForm({ title: '', targetAmount: '', currentAmount: '0' })
      setToast('Goal added.')
    } catch {
      setToast('Failed to add goal.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Add your data</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
        Add income, expenses, loans, investments and goals from one place. You can refine details later from each tab.
      </p>

      <div className="space-y-3">
        {SECTIONS.map((section) => (
          <div
            key={section.key}
            id={`add-${section.key}`}
            className={`rounded-xl border bg-white dark:bg-gray-900 transition-colors ${
              openKey === section.key
                ? 'border-blue-200 shadow-sm dark:border-blue-700'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <button
              type="button"
              onClick={() => handleToggle(section.key)}
              className={`flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
                openKey === section.key
                  ? 'cursor-default bg-blue-50/70 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                  : 'cursor-pointer text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/60'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold
                    border-blue-200 text-blue-700 dark:border-blue-500 dark:text-blue-200 bg-white/80 dark:bg-blue-950/60">
                    {SECTIONS.findIndex((s) => s.key === section.key) + 1}
                  </span>
                  <span>{section.title}</span>
                </div>
                <div className="mt-0.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                  {section.description}
                </div>
              </div>
              <span
                className={`text-lg transition-transform duration-200 ${
                  openKey === section.key ? 'rotate-0' : 'rotate-0'
                }`}
              >
                {openKey === section.key ? '−' : '+'}
              </span>
            </button>

            {openKey === section.key && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 text-sm">
                {section.key === 'income' && (
                  <form onSubmit={handleSubmitIncome} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block text-xs text-gray-600 dark:text-gray-400">
                        Amount (₹)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={incomeForm.amount}
                          onChange={(e) => setIncomeForm((f) => ({ ...f, amount: e.target.value }))}
                          className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                          required
                        />
                      </label>
                      <label className="block text-xs text-gray-600 dark:text-gray-400">
                        Category
                        <input
                          type="text"
                          value={incomeForm.category}
                          onChange={(e) => setIncomeForm((f) => ({ ...f, category: e.target.value }))}
                          className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                          placeholder="e.g. Salary, Bonus"
                        />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded bg-blue-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save income
                      </button>
                    </div>
                  </form>
                )}

                {section.key === 'expenses' && (
                  <form onSubmit={handleSubmitExpense} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block text-xs text-gray-600 dark:text-gray-400">
                        Amount (₹)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                          className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                          required
                        />
                      </label>
                      <label className="block text-xs text-gray-600 dark:text-gray-400">
                        Category
                        <select
                          value={expenseForm.category}
                          onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
                          className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        >
                          {EXPENSE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400">
                      Description (optional)
                      <input
                        type="text"
                        value={expenseForm.description}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                        className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        placeholder="Short note to remember this"
                      />
                    </label>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded bg-blue-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save expense
                      </button>
                    </div>
                  </form>
                )}

                {section.key === 'investments' && (
                  <form onSubmit={handleSubmitInvestment} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <input
                        type="text"
                        placeholder="Name"
                        value={investmentForm.name}
                        onChange={(e) => setInvestmentForm((f) => ({ ...f, name: e.target.value }))}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        required
                      />
                      <select
                        value={investmentForm.type}
                        onChange={(e) => setInvestmentForm((f) => ({ ...f, type: e.target.value }))}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      >
                        <option value="STOCK">Stock</option>
                        <option value="MUTUAL_FUND">Mutual fund</option>
                        <option value="ETF">ETF</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={investmentForm.quantity}
                        onChange={(e) => setInvestmentForm((f) => ({ ...f, quantity: e.target.value }))}
                        min="0.0001"
                        step="any"
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Buy price (₹)"
                        value={investmentForm.buyPrice}
                        onChange={(e) => setInvestmentForm((f) => ({ ...f, buyPrice: e.target.value }))}
                        min="0"
                        step="0.01"
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Current price (₹, optional)"
                        value={investmentForm.currentPrice}
                        onChange={(e) => setInvestmentForm((f) => ({ ...f, currentPrice: e.target.value }))}
                        min="0"
                        step="0.01"
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded bg-blue-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save investment
                      </button>
                    </div>
                  </form>
                )}

                {section.key === 'loans' && (
                  <form onSubmit={handleSubmitLoan} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Loan name"
                        value={loanForm.name}
                        onChange={(e) => setLoanForm((f) => ({ ...f, name: e.target.value }))}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Principal (₹)"
                        value={loanForm.principal}
                        onChange={(e) => setLoanForm((f) => ({ ...f, principal: e.target.value }))}
                        min="0"
                        step="0.01"
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="EMI (₹)"
                        value={loanForm.emi}
                        onChange={(e) => setLoanForm((f) => ({ ...f, emi: e.target.value }))}
                        min="0"
                        step="0.01"
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Interest % p.a. (optional)"
                        value={loanForm.interest}
                        onChange={(e) => setLoanForm((f) => ({ ...f, interest: e.target.value }))}
                        min="0"
                        step="0.1"
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Tenure (months left)"
                        value={loanForm.tenure}
                        onChange={(e) => setLoanForm((f) => ({ ...f, tenure: e.target.value }))}
                        min="1"
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded bg-blue-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save loan
                      </button>
                    </div>
                  </form>
                )}

                {section.key === 'goals' && (
                  <form onSubmit={handleSubmitGoal} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Goal title"
                        value={goalForm.title}
                        onChange={(e) => setGoalForm((f) => ({ ...f, title: e.target.value }))}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Target amount (₹)"
                        value={goalForm.targetAmount}
                        onChange={(e) => setGoalForm((f) => ({ ...f, targetAmount: e.target.value }))}
                        min="0"
                        step="0.01"
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        required
                      />
                      <input
                        type="number"
                        placeholder="Current amount (₹)"
                        value={goalForm.currentAmount}
                        onChange={(e) => setGoalForm((f) => ({ ...f, currentAmount: e.target.value }))}
                        min="0"
                        step="0.01"
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="rounded bg-blue-600 text-white px-4 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save goal
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {toast && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {toast}
        </p>
      )}
    </div>
  )
}

