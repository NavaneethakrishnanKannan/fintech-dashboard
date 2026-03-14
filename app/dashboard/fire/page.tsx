'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { SliderInput } from '@/components/SliderInput'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

export default function FIREPage() {
  const [monthlyExpenses, setMonthlyExpenses] = useState(50000)
  const [expectedReturn, setExpectedReturn] = useState(8)
  const [inflationRate, setInflationRate] = useState(6)
  const [currentNetWorth, setCurrentNetWorth] = useState(0)
  const [currentAge, setCurrentAge] = useState(30)

  const withdrawalRate = 0.04
  const fireNumber = (monthlyExpenses * 12) / withdrawalRate
  const realReturn = (1 + expectedReturn / 100) / (1 + inflationRate / 100) - 1
  const yearsToFIRaw = currentNetWorth >= fireNumber ? 0 : Math.ceil(Math.log(fireNumber / Math.max(currentNetWorth, 1)) / Math.log(1 + realReturn))
  const yearsToFI = realReturn <= 0 ? 999 : Math.min(yearsToFIRaw, 60)
  const projectedAge = currentAge + yearsToFI
  const isCapped = yearsToFIRaw > 60

  useEffect(() => {
    axios.get('/api/summary').then((res) => {
      const nw = res.data?.KPIs?.netWorth
      if (typeof nw === 'number') setCurrentNetWorth(nw)
    }).catch(() => {})
  }, [])

  const useMyData = () => {
    const now = new Date()
    const thisMonth = now.getMonth() + 1
    const thisYear = now.getFullYear()
    Promise.all([
      axios.get('/api/summary'),
      axios.get(`/api/expenses/report?month=${thisMonth}&year=${thisYear}`),
    ]).then(([summaryRes, reportRes]) => {
      const kpis = summaryRes.data?.KPIs
      if (kpis && typeof kpis.netWorth === 'number') setCurrentNetWorth(kpis.netWorth)
      const report = reportRes.data
      const monthExpense = typeof report?.totalExpense === 'number' ? report.totalExpense : 0
      const emi = typeof kpis?.totalLoanEmi === 'number' ? kpis.totalLoanEmi : 0
      const sip = typeof kpis?.totalMonthlySip === 'number' ? kpis.totalMonthlySip : 0
      const monthly = Math.max(0, monthExpense + emi - sip)
      if (monthly > 0) setMonthlyExpenses(Math.round(monthly))
    }).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <h1 className="text-2xl font-bold">FIRE Calculator</h1>
        <span
          className="inline-flex shrink-0 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-help"
          title="Uses the 4% rule: your target corpus = 25× annual expenses. You can withdraw 4% per year in retirement. Current net worth is loaded from your dashboard when available."
          aria-label="Info"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z" clipRule="evenodd" /></svg>
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Estimate your financial independence number using the 4% rule. Your target corpus is 25× annual expenses; see how many years until you reach it. Net worth is pre-filled from your dashboard when available.
      </p>

      <DashboardCard title="Inputs">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            type="button"
            onClick={useMyData}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Use my data
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">Pre-fills net worth and monthly expenses: this month&apos;s expenses + loan EMI, minus your total monthly SIP (so investments are not counted as expense).</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SliderInput label="Monthly expenses (₹)" value={monthlyExpenses} min={10000} max={500000} step={5000} unit="₹" onChange={setMonthlyExpenses} />
          <SliderInput label="Expected annual return (%)" value={expectedReturn} min={0} max={20} step={0.5} unit="%" onChange={setExpectedReturn} />
          <SliderInput label="Inflation rate (%)" value={inflationRate} min={0} max={15} step={0.5} unit="%" onChange={setInflationRate} />
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Current net worth (₹)</span>
              <input
                type="number"
                value={currentNetWorth || ''}
                onChange={(e) => setCurrentNetWorth(Number(e.target.value) || 0)}
                className="w-32 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-right"
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Current age</span>
              <input
                type="number"
                value={currentAge}
                onChange={(e) => setCurrentAge(Number(e.target.value) || 25)}
                min={18}
                max={80}
                className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-right"
              />
            </div>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard title="Results">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">FIRE number (4% rule)</p>
            <p className="text-xl font-semibold">₹{fireNumber.toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-500">Target corpus = 25× annual expenses. You withdraw 4% per year in retirement.</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Years to financial independence</p>
            <p className="text-xl font-semibold">{yearsToFI}{isCapped ? '+' : ''}</p>
            <p className="text-xs text-gray-500">Years until your net worth reaches the FIRE number at current real return.</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Projected retirement age</p>
            <p className="text-xl font-semibold">{projectedAge}{isCapped ? '+' : ''}</p>
            <p className="text-xs text-gray-500">Current age + years to FI.</p>
          </div>
        </div>
        {(yearsToFI >= 40 || isCapped) && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
            This is a long time because your current net worth is far below the target. To shorten it: increase monthly savings (e.g. SIP), reduce expenses, or use higher expected return (with more risk). The calculator assumes a single lump sum growing at real return; it does not add new savings each year.
          </p>
        )}
      </DashboardCard>
    </div>
  )
}
