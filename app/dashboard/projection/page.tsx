'use client'

import { useEffect, useState, useMemo } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { SliderInput } from '@/components/SliderInput'
import { LineChartCard } from '@/components/Charts/LineChartCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type ProjectionPoint = { age: number; value: number; year: number }

export default function WealthProjectionPage() {
  const [currentAge, setCurrentAge] = useState(30)
  const [currentNetWorth, setCurrentNetWorth] = useState(0)
  const [monthlyInvestment, setMonthlyInvestment] = useState(15000)
  const [expectedReturn, setExpectedReturn] = useState(10)
  const [salaryGrowthPercent, setSalaryGrowthPercent] = useState(5)
  const [projections, setProjections] = useState<ProjectionPoint[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProjection = async () => {
    try {
      setLoading(true)
      const res = await axios.post<{ projections: ProjectionPoint[]; initialNetWorth: number }>('/api/wealth/projection', {
        currentAge,
        currentNetWorth,
        monthlyInvestment,
        expectedReturn,
        salaryGrowthPercent,
      })
      setProjections(res.data.projections ?? [])
      if (res.data.initialNetWorth != null && currentNetWorth === 0) setCurrentNetWorth(res.data.initialNetWorth)
    } catch {
      setProjections([])
    } finally {
      setLoading(false)
    }
  }

  const useMyData = () => {
    axios.post<{ projections: ProjectionPoint[]; initialNetWorth: number }>('/api/wealth/projection', {
      useMyData: true,
      currentAge,
      monthlyInvestment,
      expectedReturn,
      salaryGrowthPercent,
    }).then((res) => {
      setProjections(res.data.projections ?? [])
      if (typeof res.data.initialNetWorth === 'number') setCurrentNetWorth(res.data.initialNetWorth)
    }).catch(() => {})
  }

  useEffect(() => { fetchProjection() }, [currentAge, currentNetWorth, monthlyInvestment, expectedReturn, salaryGrowthPercent])

  const chartData = useMemo(() => projections.map((p) => ({ age: p.age, value: p.value })), [projections])
  const milestones = useMemo(() => {
    const ages = [30, 35, 40, 45, 50, 55, 60]
    return ages.map((age) => {
      const p = projections.find((x) => x.age === age) || projections.filter((x) => x.age <= age).pop()
      return { age, value: p?.value ?? 0 }
    }).filter((m) => m.value > 0 || projections.some((p) => p.age === m.age))
  }, [projections])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wealth projection</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        See how your wealth could grow with monthly investments and expected returns. Adjust sliders to update the chart.
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
          <span className="text-xs text-gray-500 dark:text-gray-400">Pre-fill current net worth from your dashboard.</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SliderInput label="Current age" value={currentAge} min={18} max={60} step={1} onChange={setCurrentAge} />
          <SliderInput label="Current net worth (₹)" value={currentNetWorth} min={0} max={5000000} step={50000} unit="₹" onChange={setCurrentNetWorth} />
          <SliderInput label="Monthly investment (₹)" value={monthlyInvestment} min={0} max={200000} step={5000} unit="₹" onChange={setMonthlyInvestment} />
          <SliderInput label="Expected return (%)" value={expectedReturn} min={0} max={20} step={0.5} unit="%" onChange={setExpectedReturn} />
          <SliderInput label="Salary growth (%)" value={salaryGrowthPercent} min={0} max={15} step={0.5} unit="%" onChange={setSalaryGrowthPercent} />
        </div>
      </DashboardCard>

      {loading && projections.length === 0 ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <>
          <LineChartCard
            title="Projected wealth by age"
            data={chartData}
            xKey="age"
            lines={[{ dataKey: 'value', name: 'Net worth (₹)', color: '#22c55e' }]}
          />
          <DashboardCard title="Milestones">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {milestones.map((m) => (
                <div key={m.age} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-gray-500 dark:text-gray-400">Age {m.age}</p>
                  <p className="font-semibold">₹{(m.value / 1_00_000).toFixed(1)}L</p>
                </div>
              ))}
            </div>
          </DashboardCard>
        </>
      )}
    </div>
  )
}
