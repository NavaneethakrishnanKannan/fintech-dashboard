'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type MonthlyReport = {
  month: number
  year: number
  totalExpense: number
  totalIncome: number
  totalEmi: number
  savingsRate: number
  netWorthStart: number
  netWorthEnd: number
  netWorthChange: number
  topCategories: { category: string; amount: number }[]
  investmentValue: number
}

export default function MonthlyReportPage() {
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    axios.get<MonthlyReport>('/api/report/monthly').then((r) => setReport(r.data)).catch(() => setReport(null)).finally(() => setLoading(false))
  }, [])

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/report/monthly?format=pdf', { credentials: 'include' })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'monthly-report.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <div className="py-8 text-gray-500">Loading…</div>
  if (!report) return <div className="py-8 text-red-600">Failed to load report.</div>

  const monthLabel = `${report.year}-${String(report.month).padStart(2, '0')}`

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Monthly report</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Summary for {monthLabel}. A cron runs on the 1st of each month to notify you when the report is ready.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={downloadPdf}
          disabled={downloading}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {downloading ? 'Downloading…' : 'Download PDF'}
        </button>
      </div>

      <DashboardCard title={`Report – ${monthLabel}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Net worth change</p>
            <p className={`font-semibold ${report.netWorthChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {report.netWorthChange >= 0 ? '+' : ''}₹{report.netWorthChange.toLocaleString('en-IN')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Expenses</p>
            <p className="font-semibold">₹{report.totalExpense.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Income</p>
            <p className="font-semibold">₹{report.totalIncome.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Savings rate</p>
            <p className="font-semibold">{report.savingsRate}%</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Top spending categories</p>
        <ul className="space-y-1 text-sm">
          {report.topCategories.map((c) => (
            <li key={c.category} className="flex justify-between">
              <span>{c.category}</span>
              <span>₹{c.amount.toLocaleString('en-IN')}</span>
            </li>
          ))}
        </ul>
      </DashboardCard>
    </div>
  )
}
