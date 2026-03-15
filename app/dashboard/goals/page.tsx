'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import axios from 'axios'
import Link from 'next/link'
import { DashboardCard } from '@/components/DashboardCard'
import { LineChartCard } from '@/components/Charts/LineChartCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type Goal = {
  id: string
  title: string
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  expectedReturnRate: number | null
}

type Projection = {
  requiredMonthlyInvestment: number
  progressPercent: number
  projectedValueAtTarget: number
  monthsLeft: number
  timeline: { month: number; value: number; target: number }[]
}

type GoalInvestment = {
  id: string
  name: string
  type: string
  quantity: number
  buyPrice: number
  currentPrice: number | null
  profit: number
  buyDate: string
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [projection, setProjection] = useState<Projection | null>(null)
  const [loading, setLoading] = useState(true)
  const [addForm, setAddForm] = useState({ title: '', targetAmount: '', currentAmount: '0', targetDate: '', targetYear: '', expectedReturnRate: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const loadGoals = async () => {
    try {
      setLoading(true)
      const res = await axios.get<Goal[]>('/api/goals')
      setGoals(res.data)
      if (res.data.length && !selectedGoalId) setSelectedGoalId(res.data[0].id)
    } catch {
      setGoals([])
    } finally {
      setLoading(false)
    }
  }

  const loadProjection = async () => {
    if (!selectedGoalId) return
    try {
      const res = await axios.post<Projection>('/api/goals/projection', { goalId: selectedGoalId })
      setProjection(res.data)
    } catch {
      setProjection(null)
    }
  }

  const { data: goalInvestments = [] } = useSWR<GoalInvestment[]>(
    selectedGoalId ? `/api/goals/${selectedGoalId}/investments` : null
  )

  useEffect(() => { loadGoals() }, [])
  useEffect(() => { if (selectedGoalId) loadProjection() }, [selectedGoalId])

  const submitGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (addLoading || !addForm.title.trim() || !addForm.targetAmount) return
    setAddLoading(true)
    setToast(null)
    try {
      const targetDate = addForm.targetDate
        ? addForm.targetDate
        : addForm.targetYear
          ? `${addForm.targetYear}-12-31`
          : null
      await axios.post('/api/goals', {
        title: addForm.title.trim(),
        targetAmount: Number(addForm.targetAmount),
        currentAmount: Number(addForm.currentAmount) || 0,
        targetDate,
        expectedReturnRate: addForm.expectedReturnRate ? Number(addForm.expectedReturnRate) : null,
      })
      setAddForm({ title: '', targetAmount: '', currentAmount: '0', targetDate: '', targetYear: '', expectedReturnRate: '' })
      setToast('Goal added.')
      loadGoals()
    } catch {
      setToast('Failed to add goal.')
    } finally {
      setAddLoading(false)
    }
  }

  if (loading && !goals.length) return <div className="py-8 text-gray-500">Loading…</div>

  const timelineData = projection?.timeline?.map((t) => ({ month: t.month, value: t.value, target: t.target })) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Goals</h1>

      <DashboardCard title="Add goal">
        <form onSubmit={submitGoal} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <input type="text" placeholder="Goal title" value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
          <input type="number" placeholder="Target amount (₹)" value={addForm.targetAmount} onChange={(e) => setAddForm((f) => ({ ...f, targetAmount: e.target.value }))} min="0" step="0.01" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
          <input type="number" placeholder="Current amount (₹)" value={addForm.currentAmount} onChange={(e) => setAddForm((f) => ({ ...f, currentAmount: e.target.value }))} min="0" step="0.01" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          <input type="date" placeholder="Target date" value={addForm.targetDate} onChange={(e) => setAddForm((f) => ({ ...f, targetDate: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          <input type="number" placeholder="Target year (if no date)" value={addForm.targetYear} onChange={(e) => setAddForm((f) => ({ ...f, targetYear: e.target.value }))} min={new Date().getFullYear()} max={2100} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          <input type="number" placeholder="Expected return % (optional)" value={addForm.expectedReturnRate} onChange={(e) => setAddForm((f) => ({ ...f, expectedReturnRate: e.target.value }))} min="0" max="30" step="0.5" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          <button type="submit" disabled={addLoading} className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 sm:col-span-2">Add goal</button>
        </form>
        {toast && <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{toast}</p>}
      </DashboardCard>

      <DashboardCard title="Your goals">
        <ul className="space-y-2">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <button type="button" onClick={() => setSelectedGoalId(g.id)} className={`text-left ${selectedGoalId === g.id ? 'font-semibold' : ''}`}>
                {g.title} — ₹{g.currentAmount.toLocaleString('en-IN')} / ₹{g.targetAmount.toLocaleString('en-IN')}
              </button>
              <span className="text-sm text-gray-500">{g.targetDate ? new Date(g.targetDate).toLocaleDateString() : '—'}</span>
            </li>
          ))}
        </ul>
        {goals.length === 0 && <p className="text-gray-500 py-4">No goals. Create one from the API or dashboard.</p>}
      </DashboardCard>

      {selectedGoalId && (
        <DashboardCard title="Funded by (Portfolio link)">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Investments allocated to this goal. Link investments in Portfolio → Add/Edit → Goal.</p>
          {goalInvestments.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No investments linked yet.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {goalInvestments.map((inv) => {
                const value = inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.quantity * inv.buyPrice + inv.profit
                return (
                  <li key={inv.id} className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <Link href="/dashboard/portfolio" className="text-blue-600 dark:text-blue-400 hover:underline">{inv.name}</Link>
                    <span>₹{value.toLocaleString('en-IN')}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </DashboardCard>
      )}

      {selectedGoalId && projection && (
        <DashboardCard title="Goal projection &amp; suggested SIP">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div><p className="text-sm text-gray-500">Progress</p><p className="font-semibold">{projection.progressPercent.toFixed(1)}%</p></div>
            <div><p className="text-sm text-gray-500">Suggested monthly SIP</p><p className="font-semibold">₹{projection.requiredMonthlyInvestment.toLocaleString('en-IN')}</p></div>
            <div><p className="text-sm text-gray-500">Months left</p><p className="font-semibold">{projection.monthsLeft}</p></div>
            <div><p className="text-sm text-gray-500">Projected at target</p><p className="font-semibold">₹{projection.projectedValueAtTarget.toLocaleString('en-IN')}</p></div>
          </div>
          {timelineData.length > 0 && (
            <LineChartCard
              title="Progress over time"
              data={timelineData}
              xKey="month"
              lines={[
                { dataKey: 'value', name: 'Value', color: '#0088FE' },
                { dataKey: 'target', name: 'Target', color: '#00C49F' },
              ]}
            />
          )}
        </DashboardCard>
      )}
    </div>
  )
}
