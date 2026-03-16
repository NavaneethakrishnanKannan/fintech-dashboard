'use client'

import Link from 'next/link'
import type { FinancialSnapshotReport } from '@/lib/services/financialSnapshotReport'

type Props = {
  report: FinancialSnapshotReport
}

export function SummaryStep({ report }: Props) {
  const debtRatioPct = Math.round(report.debtRatio * 1000) / 10

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Your financial snapshot</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Based on what you shared, here&apos;s a quick overview. You can refine this anytime from Expenses, Portfolio, Loans, and Goals.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Financial score</p>
          <p className="text-2xl font-semibold">{report.financialScore}/100</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Savings rate</p>
          <p className="text-2xl font-semibold">{report.savingsRate}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Emergency fund</p>
          <p className="text-2xl font-semibold">{report.emergencyFundMonths} months</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Debt ratio</p>
          <p className="text-lg font-semibold">
            {debtRatioPct}% <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({report.debtLabel})</span>
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Estimated retirement age</p>
          <p className="text-xl font-semibold">
            {report.projectedRetirementAge != null ? `Age ${report.projectedRetirementAge}` : '—'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Recommended next steps</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ActionCard
            title="Add detailed expenses"
            body="Break down your spending by category for more accurate analytics and alerts."
            href="/dashboard/expenses"
          />
          <ActionCard
            title="Connect investment accounts"
            body="Link your Zerodha or add holdings so portfolio and projections can use real data."
            href="/dashboard/portfolio"
          />
          <ActionCard
            title="Add loan details"
            body="Enter exact loan balances and EMIs to refine affordability and payoff simulations."
            href="/dashboard/loans"
          />
          <ActionCard
            title="Set up recurring transactions"
            body="Create templates for salary, rent, SIPs and bills so they’re tracked automatically."
            href="/dashboard/expenses"
          />
        </div>
      </div>

      <div className="pt-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  )
}

type ActionCardProps = {
  title: string
  body: string
  href: string
}

function ActionCard({ title, body, href }: ActionCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/70 transition-colors"
    >
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{body}</p>
    </Link>
  )
}

