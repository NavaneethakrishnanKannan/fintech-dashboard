'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { LineChartCard } from '@/components/Charts/LineChartCard'
import { SliderInput } from '@/components/SliderInput'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

export default function ScenarioPage() {
  const [timeline, setTimeline] = useState<{ year: number; value: number }[]>([])
  const [salary, setSalary] = useState(100000)
  const [emi, setEmi] = useState(20000)
  const [sip, setSip] = useState(10000)
  const [expenses, setExpenses] = useState(40000)
  const [years, setYears] = useState(15)
  const [marketReturn, setMarketReturn] = useState(10)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    try {
      setLoading(true)
      const res = await axios.post('/api/simulation', {
        salary,
        emi,
        sip,
        expenses,
        years,
        marketReturn,
      })
      setTimeline(res.data.timeline ?? [])
    } catch {
      setTimeline([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { run() }, [salary, emi, sip, expenses, years, marketReturn])

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <h1 className="text-2xl font-bold">Scenario Simulator</h1>
        <span
          className="inline-flex shrink-0 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 cursor-help"
          title="Simulates year-by-year net worth growth. When you set salary, EMI, SIP or expenses to 0, the app uses your actual data from the dashboard (income, loans, investments) where available."
          aria-label="Info"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z" clipRule="evenodd" /></svg>
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Project future net worth by changing salary, EMI, SIP, expenses and expected return. Set any slider to 0 to use your real dashboard data for that input.
      </p>

      <DashboardCard title="Adjust assumptions">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Change sliders to see projected net worth. Leave at 0 to use your actual data where available.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SliderInput label="Monthly salary (₹)" value={salary} min={0} max={500000} step={5000} unit="₹" onChange={setSalary} />
          <SliderInput label="Monthly EMI (₹)" value={emi} min={0} max={200000} step={1000} unit="₹" onChange={setEmi} />
          <SliderInput label="Monthly SIP (₹)" value={sip} min={0} max={100000} step={1000} unit="₹" onChange={setSip} />
          <SliderInput label="Monthly expenses (₹)" value={expenses} min={0} max={200000} step={1000} unit="₹" onChange={setExpenses} />
          <SliderInput label="Years" value={years} min={1} max={30} onChange={setYears} />
          <SliderInput label="Expected return (%)" value={marketReturn} min={0} max={20} step={0.5} unit="%" onChange={setMarketReturn} />
        </div>
      </DashboardCard>

      <DashboardCard title="Projected net worth">
        {loading && <p className="text-gray-500">Calculating…</p>}
        {timeline.length > 0 && !loading && (
          <LineChartCard title="Net worth over years" data={timeline} xKey="year" lines={[{ dataKey: 'value', name: 'Net worth' }]} />
        )}
      </DashboardCard>
    </div>
  )
}
