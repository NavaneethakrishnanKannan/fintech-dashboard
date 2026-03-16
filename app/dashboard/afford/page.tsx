'use client'

import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { SliderInput } from '@/components/SliderInput'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

const IMPACT_HELP =
  'Impact = New monthly savings − Existing monthly savings. A negative value means the new EMI reduces your free cash each month. This calculator does not touch your existing investments or SIPs—it only shows how a new EMI changes your monthly surplus and retirement timeline.'

type Result = {
  emi: number
  totalPayment: number
  interestCost: number
  existingMonthlySavings: number
  newMonthlySavings: number
  impactOnSavings: number
  currentScore: number
  newScore: number
  projectedRetirementAge: number
  yearsToRetire: number
}

export default function AffordPage() {
  const [itemPrice, setItemPrice] = useState(500000)
  const [downPayment, setDownPayment] = useState(100000)
  const [loanInterest, setLoanInterest] = useState(9)
  const [loanTenureMonths, setLoanTenureMonths] = useState(60)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [useMyData, setUseMyData] = useState(false)
  const [showImpactHelp, setShowImpactHelp] = useState(false)
  const impactHelpRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showImpactHelp) return
    const close = (e: MouseEvent) => {
      if (impactHelpRef.current && !impactHelpRef.current.contains(e.target as Node)) {
        setShowImpactHelp(false)
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [showImpactHelp])

  const run = async () => {
    setLoading(true)
    try {
      const res = await axios.post<Result>('/api/afford', {
        itemPrice,
        downPayment,
        loanInterest,
        loanTenureMonths,
        useMyData,
      })
      setResult(res.data)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Can I afford this?</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Simulate a purchase with a loan. See EMI, impact on your monthly savings, and effect on your retirement timeline.
      </p>

      <DashboardCard title="Purchase details">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="useMyData"
            checked={useMyData}
            onChange={(e) => setUseMyData(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="useMyData" className="text-sm">
            Use my dashboard data (income, expenses, existing loans)
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SliderInput
            label="Item price (₹)"
            value={itemPrice}
            min={10000}
            max={5000000}
            step={25000}
            unit="₹"
            onChange={setItemPrice}
          />
          <SliderInput
            label="Down payment (₹)"
            value={downPayment}
            min={0}
            max={itemPrice}
            step={10000}
            unit="₹"
            onChange={setDownPayment}
          />
          <SliderInput
            label="Loan interest (% p.a.)"
            value={loanInterest}
            min={0}
            max={24}
            step={0.5}
            unit="%"
            onChange={setLoanInterest}
          />
          <SliderInput
            label="Tenure (months)"
            value={loanTenureMonths}
            min={6}
            max={360}
            step={6}
            onChange={setLoanTenureMonths}
          />
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="mt-4 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Calculating…' : 'Calculate'}
        </button>
      </DashboardCard>

      {result && (
        <DashboardCard title="Results">
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            This calculator only looks at your monthly cash flow. It does not sell or stop your existing investments / SIPs;
            they continue as they are. A new EMI just reduces how much new money you can save or invest each month.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'EMI', value: `₹${result.emi.toLocaleString('en-IN')}`, className: '' },
              { label: 'Total payment', value: `₹${result.totalPayment.toLocaleString('en-IN')}`, className: '' },
              {
                label: 'Interest cost',
                value: `₹${result.interestCost.toLocaleString('en-IN')}`,
                className: 'text-amber-600 dark:text-amber-400',
              },
              {
                label: 'Existing monthly savings',
                value:
                  (() => {
                    const v = result.existingMonthlySavings ?? 0
                    return v >= 0
                      ? `₹${v.toLocaleString('en-IN')}`
                      : `−₹${Math.abs(v).toLocaleString('en-IN')}`
                  })(),
                className: 'text-gray-600 dark:text-gray-400',
              },
              {
                label: 'New monthly savings',
                value:
                  result.newMonthlySavings >= 0
                    ? `₹${result.newMonthlySavings.toLocaleString('en-IN')}`
                    : `−₹${Math.abs(result.newMonthlySavings).toLocaleString('en-IN')}`,
                className: '',
              },
              {
                label: 'Impact on savings',
                value: `${result.impactOnSavings >= 0 ? '+' : ''}₹${result.impactOnSavings.toLocaleString(
                  'en-IN',
                )}/month`,
                className:
                  result.impactOnSavings >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400',
                helpText: IMPACT_HELP,
              },
              {
                label: 'Financial score',
                value: `${result.currentScore} → ${result.newScore}`,
                className: '',
              },
              {
                label: 'Projected retirement age',
                value: `Age ${result.projectedRetirementAge}`,
                className: '',
              },
            ].map(({ label, value, className, helpText }) => (
              <div
                key={label}
                className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 min-h-[4.5rem] flex flex-col justify-center"
                ref={helpText ? impactHelpRef : undefined}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                  {helpText && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowImpactHelp((s) => !s)
                      }}
                      className="inline-flex shrink-0 rounded-full p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                      aria-label="Why is this negative?"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                <p className={`text-lg font-semibold tabular-nums ${className}`}>{value}</p>
                {helpText && showImpactHelp && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-2">
                    {helpText}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DashboardCard>
      )}
    </div>
  )
}

