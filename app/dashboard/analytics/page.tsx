'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type BehaviorData = {
  totalExpenseThisMonth: number
  totalExpenseLastMonth: number
  spendingChangePercent: number
  savingsRateThisMonth: number
  savingsRateLastMonth: number
  savingsRateTrend: number
  categoryTrends: { category: string; thisMonth: number; lastMonth: number; changePercent: number }[]
  monthlyIncome: number
}

export default function AnalyticsPage() {
  const [data, setData] = useState<BehaviorData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get<BehaviorData>('/api/analytics/behavior').then((res) => setData(res.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-8 text-gray-500">Loading…</div>
  if (!data) return <div className="py-8 text-red-600">Failed to load analytics.</div>

  const chartData = data.categoryTrends.map((t) => ({
    name: t.category,
    thisMonth: t.thisMonth,
    lastMonth: t.lastMonth,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financial behavior</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Spending and savings trends compared to last month.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardCard title="Spending vs last month">
          <p className={`text-2xl font-semibold ${data.spendingChangePercent >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
            {data.spendingChangePercent >= 0 ? '+' : ''}{data.spendingChangePercent}%
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            This month: ₹{data.totalExpenseThisMonth.toLocaleString('en-IN')} · Last: ₹{data.totalExpenseLastMonth.toLocaleString('en-IN')}
          </p>
        </DashboardCard>
        <DashboardCard title="Savings rate">
          <p className="text-2xl font-semibold">{data.savingsRateThisMonth}%</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {data.savingsRateTrend >= 0 ? '+' : ''}{data.savingsRateTrend}% vs last month
          </p>
        </DashboardCard>
        <DashboardCard title="Top categories this month">
          <ul className="text-sm space-y-1">
            {data.categoryTrends.slice(0, 5).map((t) => (
              <li key={t.category} className="flex justify-between">
                <span>{t.category}</span>
                <span>₹{t.thisMonth.toLocaleString('en-IN')} ({t.changePercent >= 0 ? '+' : ''}{t.changePercent}%)</span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      </div>

      {chartData.length > 0 && (
        <DashboardCard title="Spending by category (this month vs last)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₹${Number(v).toLocaleString('en-IN')}`, '']} />
                <Legend />
                <Bar dataKey="thisMonth" name="This month" fill="#22c55e" radius={[2, 2, 0, 0]} />
                <Bar dataKey="lastMonth" name="Last month" fill="#94a3b8" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
      )}
    </div>
  )
}
