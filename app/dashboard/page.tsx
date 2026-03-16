'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { StatCard } from '@/components/StatCard'
import { LineChartCard } from '@/components/Charts/LineChartCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type Summary = {
  KPIs: {
    netWorth: number
    totalCurrent: number
    totalInvested: number
    totalIncome: number
    totalExpenses: number
    totalLoanEmi: number
    monthlySavings: number
    totalMonthlySip?: number
    surplusAfterInvestments?: number
    totalLoanPrincipal: number
  }
}

type Alert = { id: string; type: string; title: string; message: string; severity: string | null; read: boolean; createdAt: string }
type NetWorthPoint = { date: string; netWorth: number }
type InsightsRes = { insights: string[] }

export default function DashboardOverview() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [history, setHistory] = useState<NetWorthPoint[]>([])
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recomputeLoading, setRecomputeLoading] = useState(false)
  const [zerodhaValue, setZerodhaValue] = useState<number | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      let summaryError: 'unauthorized' | 'failed' | null = null
      const [sumRes, alertsRes, histRes, insightsRes] = await Promise.all([
        axios.get<Summary>('/api/summary').catch((e: { response?: { status?: number } }) => {
          if (e?.response?.status === 401) summaryError = 'unauthorized'
          else summaryError = 'failed'
          return { data: null }
        }),
        axios.get<Alert[]>('/api/alerts').catch(() => ({ data: [] })),
        axios.get<NetWorthPoint[]>('/api/networth/history').catch(() => ({ data: [] })),
        axios.get<InsightsRes>('/api/insights').catch(() => ({ data: { insights: [] } })),
      ])
      const summaryData = sumRes.data as Summary | null | undefined
      if (summaryData && typeof summaryData === 'object' && summaryData.KPIs) {
        setSummary(summaryData)
      } else {
        setSummary(null)
        setError(
          summaryError === 'unauthorized'
            ? 'Session expired or not signed in. Please sign in again.'
            : 'Could not load dashboard data. Check your connection and try again.'
        )
      }
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : [])
      const hist = Array.isArray(histRes.data) ? histRes.data : []
      setHistory(hist.map((h: { date: string; netWorth: number }) => ({ date: h.date.slice(0, 10), netWorth: h.netWorth })))
      if (summaryData?.KPIs) axios.post('/api/networth/history').catch(() => {})
      axios.get<{ totalValue: number }>('/api/zerodha/holdings').then((r) => setZerodhaValue(r.data.totalValue)).catch(() => setZerodhaValue(null))
    } catch (e) {
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const markAlertRead = async (id: string) => {
    try {
      await axios.patch('/api/alerts', { id, read: true })
      setAlerts((a) => a.map((x) => (x.id === id ? { ...x, read: true } : x)))
    } catch {}
  }

  const recomputeNetWorthHistory = async () => {
    setRecomputeLoading(true)
    try {
      await axios.post('/api/networth/history/recompute')
      await load()
    } catch {
      setError('Recalculate failed. Try again.')
    } finally {
      setRecomputeLoading(false)
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button type="button" onClick={load} className="mt-2 text-sm text-red-600 dark:text-red-400 underline">Retry</button>
      </div>
    )
  }

  const k: Summary['KPIs'] = summary?.KPIs ?? {} as Summary['KPIs']
  const netWorth = Number(k.netWorth) || 0
  const totalCurrent = Number(k.totalCurrent) || 0
  const totalInvested = Number(k.totalInvested) || 0
  const monthlySavings = Number(k.monthlySavings) || 0
  const totalLoanPrincipal = Number(k.totalLoanPrincipal) || 0
  const totalMonthlySip = Number(k.totalMonthlySip) || 0
  const surplusAfterInvestments = Number(k.surplusAfterInvestments) ?? monthlySavings - totalMonthlySip
  const isEmpty = netWorth === 0 && totalCurrent === 0 && totalLoanPrincipal === 0

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {isEmpty && (
        <p className="text-sm text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
          No data yet. Add investments, income, expenses, or loans from the links below to see your summary here.
        </p>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Net worth" value={fmt(netWorth)} />
        <StatCard label="Portfolio (current)" value={fmt(totalCurrent)} sub={`Invested: ${fmt(totalInvested)}`} />
        <StatCard label="Monthly savings" value={fmt(monthlySavings)} sub="Income − expenses − EMI" />
        <StatCard label="After expenses & investments" value={fmt(surplusAfterInvestments)} sub={totalMonthlySip > 0 ? `Monthly savings − SIP (₹${totalMonthlySip.toLocaleString('en-IN')})` : undefined} />
        <StatCard label="Outstanding loans" value={fmt(totalLoanPrincipal)} sub="View details on the Loans page." />
        {zerodhaValue != null && (
          <StatCard label="Zerodha portfolio" value={fmt(zerodhaValue)} sub="Linked account" />
        )}
      </section>

      {insights.length > 0 && (
        <DashboardCard title="Smart insights">
          <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            {insights.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-green-600 dark:text-green-400 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </DashboardCard>
      )}

      {alerts.filter((a) => !a.read).length > 0 && (
        <DashboardCard title="Alerts">
          <ul className="space-y-2">
            {alerts.filter((a) => !a.read).slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <span className="font-medium">{a.title}</span>
                  <p className="text-gray-600 dark:text-gray-400">{a.message}</p>
                </div>
                <button type="button" onClick={() => markAlertRead(a.id)} className="text-gray-500 hover:underline shrink-0">Dismiss</button>
              </li>
            ))}
          </ul>
          {alerts.filter((a) => !a.read).length > 5 && (
            <Link href="/dashboard/health" className="text-sm text-blue-600 dark:text-blue-400 mt-2 inline-block">View all</Link>
          )}
        </DashboardCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <LineChartCard
            title="Net worth over time"
            data={history}
            xKey="date"
            lines={[{ dataKey: 'netWorth', name: 'Net worth', color: '#0088FE' }]}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Chart showing wrong values?{' '}
            <button type="button" onClick={recomputeNetWorthHistory} disabled={recomputeLoading} className="text-blue-600 dark:text-blue-400 underline disabled:opacity-50">
              {recomputeLoading ? 'Recalculating…' : 'Recalculate history to match card'}
            </button>
          </p>
        </div>
        <DashboardCard title="Import CSV" className="overflow-auto max-h-96">
          <div className="grid grid-cols-2 gap-2">
            <Link href="/dashboard/portfolio" className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Portfolio</Link>
            <select className="p-3 rounded-lg border border-gray-200 dark:border-gray-600">
              <option value="">Select File</option>
              <option value="file1">File 1</option>
              <option value="file2">File 2</option>
            </select>
            <Link href="/dashboard/expenses" className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Expenses</Link>
            <Link href="/dashboard/loans" className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Loans</Link>
            <Link href="/dashboard/goals" className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Goals</Link>
            <Link href="/dashboard/health" className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">Health</Link>
            <Link href="/dashboard/ai" className="p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">AI Advisor</Link>
          </div>
        </DashboardCard>
      </div>
    </div>
  )
}