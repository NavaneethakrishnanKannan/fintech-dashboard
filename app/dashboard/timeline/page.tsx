'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { LineChartCard } from '@/components/Charts/LineChartCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type HistoryPoint = { date: string; netWorth: number; assets?: number; liabilities?: number }
type ProjectionPoint = { age: number; value: number; year: number }

export default function WealthTimelinePage() {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [projections, setProjections] = useState<ProjectionPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      axios.get<HistoryPoint[]>('/api/networth/history').then((r) => r.data ?? []),
      axios.post<{ projections: ProjectionPoint[] }>('/api/wealth/projection', { useMyData: true, currentAge: 30, monthlyInvestment: 0, expectedReturn: 10 }).then((r) => r.data?.projections ?? []),
    ]).then(([hist, proj]) => {
      setHistory(Array.isArray(hist) ? hist.map((h) => ({ date: (h as { date?: string }).date?.slice(0, 10) ?? '', netWorth: (h as { netWorth?: number }).netWorth ?? 0 })) : [])
      setProjections(Array.isArray(proj) ? proj : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const historyByYear = history.reduce((acc, h) => {
    const year = h.date.slice(0, 4)
    if (!year) return acc
    const existing = acc.find((x) => x.year === year)
    if (existing) {
      if (h.netWorth > existing.netWorth) existing.netWorth = h.netWorth
    } else acc.push({ year, netWorth: h.netWorth })
    return acc
  }, [] as { year: string; netWorth: number }[])
  historyByYear.sort((a, b) => a.year.localeCompare(b.year))

  const projectionByYear = projections.map((p) => ({ year: `Age ${p.age}`, netWorth: p.value }))
  const combinedChart = [...historyByYear.map((h) => ({ label: h.year, value: h.netWorth })), ...projectionByYear.slice(0, 20).map((p, i) => ({ label: p.year, value: p.netWorth }))]

  if (loading) return <div className="py-8 text-gray-500">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wealth timeline</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Past net worth (from history) and projected growth until retirement. Update Wealth Projection inputs for different scenarios.
      </p>

      <DashboardCard title="Timeline">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {historyByYear.slice(-8).map((h) => (
            <div key={h.year} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-gray-500 dark:text-gray-400">{h.year}</p>
              <p className="font-semibold">₹{(h.netWorth / 1_00_000).toFixed(1)}L</p>
            </div>
          ))}
          {projections.filter((_, i) => [0, 5, 10, 15, 20].includes(i)).map((p) => (
            <div key={p.age} className="rounded-lg border border-dashed border-gray-400 dark:border-gray-500 p-3">
              <p className="text-gray-500 dark:text-gray-400">Age {p.age} (proj.)</p>
              <p className="font-semibold">₹{(p.value / 1_00_000).toFixed(1)}L</p>
            </div>
          ))}
        </div>
      </DashboardCard>

      {(historyByYear.length > 0 || projections.length > 0) && (
        <LineChartCard
          title="Net worth & projection"
          data={projections.length > 0 ? projections.map((p) => ({ age: p.age, value: p.value })) : historyByYear.map((h) => ({ age: h.year, value: h.netWorth }))}
          xKey="age"
          lines={[{ dataKey: 'value', name: 'Net worth (₹)', color: '#0088FE' }]}
        />
      )}

      {historyByYear.length === 0 && projections.length === 0 && (
        <p className="text-gray-500 dark:text-gray-400">No history or projection data. Add data and use Wealth Projection to see timeline.</p>
      )}
    </div>
  )
}
