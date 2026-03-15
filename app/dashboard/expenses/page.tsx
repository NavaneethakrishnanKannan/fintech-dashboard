'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { PieChartCard } from '@/components/Charts/PieChartCard'
import { BarChartCard } from '@/components/Charts/BarChartCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type RecurringTemplate = {
  id: string
  type: string
  amount: number
  category: string
  description: string | null
  frequency: string
  startDate: string
  nextRun: string
}

type Report = {
  totalExpense: number
  incomeInPeriod: number
  savingsRate: number
  byCategory: { category: string; amount: number }[]
}

type ExpenseRow = { id: string; amount: number; category: string; description: string | null; date: string }

const EXPENSE_CATEGORIES = ['Food', 'Transport', 'Travel', 'Rent', 'Utilities', 'Shopping', 'Health', 'Entertainment', 'Education', 'Other']
const BUDGET_CATEGORIES = ['total', ...EXPENSE_CATEGORIES]
const INCOME_CATEGORIES = ['Salary', 'Bonus', 'Freelance', 'Investment', 'Other']

type BudgetRow = { id: string; category: string; amount: number }

export default function ExpensesPage() {
  const [report, setReport] = useState<Report | null>(null)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [expenseForm, setExpenseForm] = useState({ amount: '', category: 'Food', description: '', date: new Date().toISOString().slice(0, 10) })
  const [incomeForm, setIncomeForm] = useState({ amount: '', category: 'Salary' })
  const [addLoading, setAddLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [expensesList, setExpensesList] = useState<ExpenseRow[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ amount: '', category: 'Food', description: '', date: '' })
  const [importType, setImportType] = useState<'expenses' | 'incomes'>('expenses')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ createdExpenses: number; createdIncomes: number; errors: string[] } | null>(null)
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [budgetForm, setBudgetForm] = useState({ category: 'total', amount: '' })
  const [budgetLoading, setBudgetLoading] = useState(false)
  const { data: recurringTemplates = [], mutate: mutateRecurring } = useSWR<RecurringTemplate[]>('/api/recurring')
  const [recurringForm, setRecurringForm] = useState({ type: 'expense' as 'expense' | 'income', amount: '', category: 'Food', description: '', frequency: 'monthly', startDate: new Date().toISOString().slice(0, 10) })
  const [recurringLoading, setRecurringLoading] = useState(false)

  const loadBudgets = async () => {
    try {
      const res = await axios.get<BudgetRow[]>('/api/budgets')
      setBudgets(Array.isArray(res.data) ? res.data : [])
    } catch {
      setBudgets([])
    }
  }

  const load = async () => {
    try {
      setLoading(true)
      const [reportRes, listRes] = await Promise.all([
        axios.get<Report>(`/api/expenses/report?month=${month}&year=${year}`),
        axios.get<ExpenseRow[]>('/api/expenses'),
      ])
      setReport(reportRes.data)
      const list = listRes.data ?? []
      const filtered = list.filter((e) => {
        const d = new Date(e.date)
        return d.getMonth() + 1 === month && d.getFullYear() === year
      })
      setExpensesList(filtered)
    } catch {
      setReport(null)
      setExpensesList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [month, year])
  useEffect(() => { loadBudgets() }, [])

  const addBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(budgetForm.amount)
    if (!amt || amt <= 0 || budgetLoading) return
    setBudgetLoading(true)
    try {
      await axios.post('/api/budgets', { category: budgetForm.category, amount: amt })
      setBudgetForm({ category: 'total', amount: '' })
      loadBudgets()
      setToast('Budget set.')
    } catch {
      setToast('Failed to set budget.')
    } finally {
      setBudgetLoading(false)
    }
  }

  const deleteBudget = async (id: string) => {
    if (!confirm('Remove this budget?')) return
    setBudgetLoading(true)
    try {
      await axios.delete(`/api/budgets/${id}`)
      loadBudgets()
      setToast('Budget removed.')
    } catch {
      setToast('Failed to remove.')
    } finally {
      setBudgetLoading(false)
    }
  }

  const startEdit = (e: ExpenseRow) => {
    setEditingId(e.id)
    setEditForm({
      amount: String(e.amount),
      category: e.category,
      description: e.description ?? '',
      date: e.date.slice(0, 10),
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setAddLoading(true)
    try {
      await axios.patch(`/api/expenses/${editingId}`, {
        amount: Number(editForm.amount),
        category: editForm.category,
        description: editForm.description.trim() || null,
        date: editForm.date,
      })
      setToast('Expense updated.')
      setEditingId(null)
      load()
    } catch {
      setToast('Failed to update.')
    } finally {
      setAddLoading(false)
    }
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    setAddLoading(true)
    try {
      await axios.delete(`/api/expenses/${id}`)
      setToast('Expense deleted.')
      load()
    } catch {
      setToast('Failed to delete.')
    } finally {
      setAddLoading(false)
    }
  }

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (addLoading || !expenseForm.amount) return
    setAddLoading(true)
    setToast(null)
    try {
      await axios.post('/api/expenses', {
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        description: expenseForm.description.trim() || undefined,
        date: expenseForm.date || new Date().toISOString().slice(0, 10),
      })
      setExpenseForm({ amount: '', category: 'Food', description: '', date: new Date().toISOString().slice(0, 10) })
      setToast('Expense added.')
      load()
    } catch {
      setToast('Failed to add expense.')
    } finally {
      setAddLoading(false)
    }
  }

  const submitIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (addLoading || !incomeForm.amount) return
    setAddLoading(true)
    setToast(null)
    try {
      await axios.post('/api/incomes', { amount: Number(incomeForm.amount), category: incomeForm.category })
      setIncomeForm({ amount: '', category: 'Salary' })
      setToast('Income added.')
      load()
    } catch {
      setToast('Failed to add income.')
    } finally {
      setAddLoading(false)
    }
  }

  const submitRecurring = async (e: React.FormEvent) => {
    e.preventDefault()
    const amt = Number(recurringForm.amount)
    if (!amt || amt <= 0 || recurringLoading) return
    setRecurringLoading(true)
    try {
      await axios.post('/api/recurring', {
        type: recurringForm.type,
        amount: amt,
        category: recurringForm.type === 'expense' ? recurringForm.category : (INCOME_CATEGORIES.includes(recurringForm.category) ? recurringForm.category : 'Salary'),
        description: recurringForm.type === 'expense' ? (recurringForm.description || null) : undefined,
        frequency: recurringForm.frequency,
        startDate: recurringForm.startDate,
      })
      setRecurringForm({ type: 'expense', amount: '', category: 'Food', description: '', frequency: 'monthly', startDate: new Date().toISOString().slice(0, 10) })
      mutateRecurring()
      setToast('Recurring template added.')
    } catch {
      setToast('Failed to add recurring.')
    } finally {
      setRecurringLoading(false)
    }
  }

  const deleteRecurring = async (id: string) => {
    if (!confirm('Remove this recurring template?')) return
    try {
      await axios.delete(`/api/recurring/${id}`)
      mutateRecurring()
      setToast('Recurring removed.')
    } catch {
      setToast('Failed to remove.')
    }
  }

  const submitImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!importFile || importLoading) return
    setImportResult(null)
    setImportLoading(true)
    try {
      const form = new FormData()
      form.append('file', importFile)
      form.append('type', importType)
      const res = await axios.post<{ ok: boolean; createdExpenses: number; createdIncomes: number; errors: string[] }>('/api/import/csv', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult({
        createdExpenses: res.data.createdExpenses ?? 0,
        createdIncomes: res.data.createdIncomes ?? 0,
        errors: res.data.errors ?? [],
      })
      setImportFile(null)
      load()
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      setImportResult({
        createdExpenses: 0,
        createdIncomes: 0,
        errors: [ax.response?.data?.error ?? 'Import failed.'],
      })
    } finally {
      setImportLoading(false)
    }
  }

  if (loading && !report) return <div className="py-8 text-gray-500">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Expenses</h1>

      <DashboardCard title="Add expense">
        <form onSubmit={submitExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <input type="number" placeholder="Amount (₹)" value={expenseForm.amount} onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))} min="0" step="0.01" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
          <select value={expenseForm.category} onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" placeholder="Description (optional)" value={expenseForm.description} onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          <button type="submit" disabled={addLoading} className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Add expense</button>
        </form>
        {toast && <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{toast}</p>}
      </DashboardCard>

      <DashboardCard title="Add income">
        <form onSubmit={submitIncome} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <input type="number" placeholder="Amount (₹)" value={incomeForm.amount} onChange={(e) => setIncomeForm((f) => ({ ...f, amount: e.target.value }))} min="0" step="0.01" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
          <select value={incomeForm.category} onChange={(e) => setIncomeForm((f) => ({ ...f, category: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
            {INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" disabled={addLoading} className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Add income</button>
        </form>
      </DashboardCard>

      <DashboardCard title="Recurring (expenses &amp; income)">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Auto-create entries on a schedule. A daily cron runs at midnight (Vercel); set CRON_SECRET to secure the endpoint.</p>
        <form onSubmit={submitRecurring} className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <select value={recurringForm.type} onChange={(e) => { const t = e.target.value as 'expense' | 'income'; setRecurringForm((f) => ({ ...f, type: t, category: t === 'income' ? 'Salary' : f.category || 'Food' })) }} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Amount (₹)</label>
            <input type="number" min="0.01" step="0.01" value={recurringForm.amount} onChange={(e) => setRecurringForm((f) => ({ ...f, amount: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm w-28" required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
            <select value={recurringForm.category} onChange={(e) => setRecurringForm((f) => ({ ...f, category: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
              {recurringForm.type === 'expense' ? EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>) : INCOME_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {recurringForm.type === 'expense' && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
              <input type="text" value={recurringForm.description} onChange={(e) => setRecurringForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Frequency</label>
            <select value={recurringForm.frequency} onChange={(e) => setRecurringForm((f) => ({ ...f, frequency: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start date</label>
            <input type="date" value={recurringForm.startDate} onChange={(e) => setRecurringForm((f) => ({ ...f, startDate: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={recurringLoading} className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Add recurring</button>
        </form>
        {recurringTemplates.length > 0 ? (
          <ul className="text-sm space-y-1">
            {recurringTemplates.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span>{t.type === 'expense' ? 'Expense' : 'Income'} — ₹{t.amount.toLocaleString('en-IN')} / {t.frequency} — {t.category} — next: {t.nextRun.slice(0, 10)}</span>
                <button type="button" onClick={() => deleteRecurring(t.id)} className="text-red-600 dark:text-red-400 text-xs">Remove</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No recurring templates.</p>
        )}
      </DashboardCard>

      <DashboardCard title="Budgets">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Set monthly limits. You’ll get an alert when spending exceeds a budget.</p>
        <form onSubmit={addBudget} className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
            <select value={budgetForm.category} onChange={(e) => setBudgetForm((f) => ({ ...f, category: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
              {BUDGET_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c === 'total' ? 'Total (all categories)' : c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Amount (₹/month)</label>
            <input type="number" min="1" step="1" value={budgetForm.amount} onChange={(e) => setBudgetForm((f) => ({ ...f, amount: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm w-32" placeholder="e.g. 5000" required />
          </div>
          <button type="submit" disabled={budgetLoading} className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Set budget</button>
        </form>
        {budgets.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {budgets.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
                <span><strong>{b.category === 'total' ? 'Total' : b.category}</strong> — ₹{Number(b.amount).toLocaleString('en-IN')}/month</span>
                <button type="button" onClick={() => deleteBudget(b.id)} disabled={budgetLoading} className="text-red-600 dark:text-red-400 disabled:opacity-50">Remove</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No budgets set.</p>
        )}
      </DashboardCard>

      <DashboardCard title="Import CSV">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Upload a CSV with columns: amount, category, date (optional: description for expenses). Header row required.</p>
        <form onSubmit={submitImport} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Import as</label>
            <select value={importType} onChange={(e) => setImportType(e.target.value as 'expenses' | 'incomes')} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm">
              <option value="expenses">Expenses</option>
              <option value="incomes">Incomes</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">File</label>
            <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300" />
          </div>
          <button type="submit" disabled={!importFile || importLoading} className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Import</button>
        </form>
        {importResult && (
          <div className="mt-3 text-sm">
            {(importResult.createdExpenses > 0 || importResult.createdIncomes > 0) && (
              <p className="text-green-600 dark:text-green-400">
                Created: {importResult.createdExpenses > 0 && `${importResult.createdExpenses} expense(s)`}
                {importResult.createdExpenses > 0 && importResult.createdIncomes > 0 && ', '}
                {importResult.createdIncomes > 0 && `${importResult.createdIncomes} income(s)`}.
              </p>
            )}
            {importResult.errors.length > 0 && (
              <p className="text-red-600 dark:text-red-400 mt-1">{importResult.errors.join(' ')}</p>
            )}
          </div>
        )}
      </DashboardCard>

      <DashboardCard title="Monthly report">
        <div className="flex flex-wrap gap-4 items-center mb-4">
          <label className="flex items-center gap-2">
            <span className="text-sm">Month</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm">Year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1">
              {[year - 2, year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-sm text-gray-500">Income</p><p className="font-semibold">₹{report.incomeInPeriod.toLocaleString('en-IN')}</p></div>
            <div><p className="text-sm text-gray-500">Expenses</p><p className="font-semibold">₹{report.totalExpense.toLocaleString('en-IN')}</p></div>
            <div><p className="text-sm text-gray-500">Savings rate</p><p className="font-semibold">{(report.savingsRate * 100).toFixed(1)}%</p></div>
          </div>
        )}
      </DashboardCard>

      <DashboardCard title="Expense list">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">For {new Date(year, month - 1).toLocaleString('default', { month: 'long' })} {year}. Edit or delete entries.</p>
        {expensesList.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No expenses in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600 text-left">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Category</th>
                  <th className="py-2 pr-2">Amount</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expensesList.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 dark:border-gray-700/50">
                    {editingId === e.id ? (
                      <>
                        <td className="py-1.5"><input type="date" value={editForm.date} onChange={(ev) => setEditForm((f) => ({ ...f, date: ev.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 w-full max-w-[130px]" /></td>
                        <td className="py-1.5">
                          <select value={editForm.category} onChange={(ev) => setEditForm((f) => ({ ...f, category: ev.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1">
                            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="py-1.5"><input type="number" value={editForm.amount} onChange={(ev) => setEditForm((f) => ({ ...f, amount: ev.target.value }))} min="0" step="0.01" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 w-24" /></td>
                        <td className="py-1.5"><input type="text" value={editForm.description} onChange={(ev) => setEditForm((f) => ({ ...f, description: ev.target.value }))} placeholder="Optional" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 min-w-[100px]" /></td>
                        <td className="py-1.5">
                          <button type="button" onClick={saveEdit} disabled={addLoading} className="text-blue-600 dark:text-blue-400 mr-1 disabled:opacity-50">Save</button>
                          <button type="button" onClick={cancelEdit} disabled={addLoading} className="text-gray-600 dark:text-gray-400 disabled:opacity-50">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2">{e.date.slice(0, 10)}</td>
                        <td className="py-2">{e.category}</td>
                        <td className="py-2">₹{Number(e.amount).toLocaleString('en-IN')}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{e.description ?? '—'}</td>
                        <td className="py-2">
                          <button type="button" onClick={() => startEdit(e)} className="text-blue-600 dark:text-blue-400 mr-2">Edit</button>
                          <button type="button" onClick={() => deleteExpense(e.id)} disabled={addLoading} className="text-red-600 dark:text-red-400 disabled:opacity-50">Delete</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>

      {report && (
        <>
          <PieChartCard title="Spending by category" data={report.byCategory.map((c) => ({ name: c.category, value: c.amount }))} />
          <BarChartCard title="Category breakdown" data={report.byCategory} xKey="category" barKey="amount" />
        </>
      )}

      {report?.byCategory.length === 0 && <p className="text-gray-500">No expense data for this period.</p>}
    </div>
  )
}
