'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

function getScoreStyle(score: number): { color: string; bg: string } {
  if (score >= 70) return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500' }
  if (score >= 40) return { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500' }
  return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500' }
}

function ScoreIcon({ score }: { score: number }) {
  const { bg } = getScoreStyle(score)
  return <span className={`inline-flex shrink-0 w-5 h-5 rounded-full ${bg}`} aria-hidden />
}

type HealthResponse = {
  score: number
  breakdown: { name: string; score: number; suggestion?: string }[]
  suggestions: string[]
  metrics: {
    savingsRate: number
    debtToIncomeRatio: number
    emergencyFundMonths: number
    diversificationScore: number
    portfolioGrowthPercent: number
  }
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [alerts, setAlerts] = useState<{ id: string; title: string; message: string; severity: string | null; read: boolean }[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setLoading(true)
      const [hRes, aRes] = await Promise.all([
        axios.get<HealthResponse>('/api/health/score'),
        axios.get<{ id: string; title: string; message: string; severity: string | null; read: boolean }[]>('/api/alerts'),
      ])
      setHealth(hRes.data)
      setAlerts(aRes.data)
    } catch {
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading && !health) return <div className="py-8 text-gray-500">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financial Health</h1>

      {health && (
        <>
          <DashboardCard title="Health score">
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 rounded-full border-8 flex items-center justify-center text-3xl font-bold"
                style={{
                  borderColor: health.score >= 70 ? '#22c55e' : health.score >= 40 ? '#eab308' : '#ef4444',
                }}
              >
                {health.score}
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">Out of 100</p>
                <p className="text-sm mt-2">Based on savings rate, debt-to-income, emergency fund, diversification, and portfolio growth.</p>
              </div>
            </div>
          </DashboardCard>

          <DashboardCard title="Breakdown">
            <ul className="space-y-3">
              {health.breakdown.map((b) => {
                const style = getScoreStyle(b.score)
                return (
                  <li key={b.name} className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <ScoreIcon score={b.score} />
                      <div>
                        <span className="font-medium">{b.name}</span>
                        {b.suggestion && <p className="text-sm text-gray-500 dark:text-gray-400">{b.suggestion}</p>}
                      </div>
                    </div>
                    <span className={`font-semibold shrink-0 ${style.color}`}>{b.score}/100</span>
                  </li>
                )
              })}
            </ul>
          </DashboardCard>

          <DashboardCard title="Suggestions">
            <ul className="list-disc list-inside space-y-1">
              {health.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            {health.suggestions.length === 0 && <p className="text-gray-500">No specific suggestions. Keep it up!</p>}
          </DashboardCard>

          <DashboardCard title="Metrics">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div><p className="text-gray-500">Savings rate</p><p className="font-semibold">{health.metrics.savingsRate.toFixed(1)}%</p></div>
              <div><p className="text-gray-500">Debt-to-income</p><p className="font-semibold">{health.metrics.debtToIncomeRatio.toFixed(1)}%</p></div>
              <div><p className="text-gray-500">Emergency fund (months)</p><p className="font-semibold">{health.metrics.emergencyFundMonths.toFixed(1)}</p></div>
              <div><p className="text-gray-500">Diversification</p><p className="font-semibold">{health.metrics.diversificationScore.toFixed(0)}%</p></div>
              <div><p className="text-gray-500">Portfolio growth</p><p className="font-semibold">{health.metrics.portfolioGrowthPercent.toFixed(1)}%</p></div>
            </div>
          </DashboardCard>
        </>
      )}

      <DashboardCard title="Alerts">
        <ul className="space-y-2">
          {alerts.slice(0, 10).map((a) => (
            <li key={a.id} className={`p-2 rounded ${a.read ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
              <span className="font-medium">{a.title}</span>
              <p className="text-sm text-gray-600 dark:text-gray-400">{a.message}</p>
            </li>
          ))}
        </ul>
        {alerts.length === 0 && <p className="text-gray-500">No alerts.</p>}
      </DashboardCard>
    </div>
  )
}
