'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { DashboardCard } from '@/components/DashboardCard'

type Section80CResponse = {
  limit80C: number
  used80C: number
  remaining80C: number
  potentialTaxSaving30: number
  potentialTaxSaving20: number
  suggestions: string[]
}

type CapitalGainsResponse = {
  ltcg: number
  stcg: number
  totalGain: number
  byHolding: {
    name: string
    type: string
    buyDate: string
    holdingDays: number
    bucket: 'LTCG' | 'STCG' | '—'
    bucketApprox?: boolean
    cost: number
    value: number
    gain: number
    source?: 'zerodha' | 'manual'
  }[]
}

export default function TaxPage() {
  const { data, error, mutate, isLoading } = useSWR<CapitalGainsResponse>('/api/tax/capital-gains')
  const { data: section80C } = useSWR<Section80CResponse>('/api/tax/section80c')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  const retry = () => mutate(undefined, { revalidate: true })

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Tax – Capital gains</h1>
        <DashboardCard title="Unable to load">
          <p className="text-red-600 dark:text-red-400 mb-3">
            Failed to load capital gains. This can happen if Zerodha session expired or the request failed.
          </p>
          <button
            type="button"
            onClick={retry}
            disabled={isLoading}
            className="rounded-md bg-gray-200 dark:bg-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {isLoading ? 'Retrying…' : 'Retry'}
          </button>
        </DashboardCard>
      </div>
    )
  }

  if (!data || isLoading) return <div className="py-8 text-gray-500">Loading…</div>

  const { ltcg, stcg, totalGain, byHolding } = data

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tax – Capital gains</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        When Zerodha is connected, equity and MF come from Zerodha; otherwise from saved Portfolio. Zerodha MF with an active SIP gets LTCG/STCG from SIP instalments; MF without SIP and equity are shown as STCG (approx) since purchase date isn’t available from the API.
      </p>

      <DashboardCard title="Summary (unrealized)">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          LTCG/STCG include manual (exact), Zerodha MF from SIP (approx), and Zerodha equity / MF without SIP as STCG (approx).
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">LTCG (≥1 yr)</p>
            <p className="text-xl font-semibold text-green-600 dark:text-green-400">₹{ltcg.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">STCG (&lt;1 yr)</p>
            <p className="text-xl font-semibold text-amber-600 dark:text-amber-400">₹{stcg.toLocaleString('en-IN')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total gain (all holdings)</p>
            <p className="text-xl font-semibold">₹{totalGain.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </DashboardCard>

      {section80C && (
        <DashboardCard title="Tax optimization (80C)">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Section 80C limit: ₹1.5L per financial year. Use for ELSS, PPF, EPF, etc.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Remaining limit</p>
              <p className="font-semibold">₹{section80C.remaining80C.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Potential saving (30% slab)</p>
              <p className="font-semibold text-green-600 dark:text-green-400">₹{section80C.potentialTaxSaving30.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
            {section80C.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </DashboardCard>
      )}

      <DashboardCard title="By holding">
        {byHolding.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No holdings. Connect Zerodha or add investments in Portfolio to see capital gains.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-600 text-left">
                  <th className="py-2 pr-2">Name</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Buy date</th>
                  <th className="py-2 pr-2">Holding (days)</th>
                  <th className="py-2 pr-2">Bucket</th>
                  <th className="text-right py-2 pr-2">Cost</th>
                  <th className="text-right py-2 pr-2">Value</th>
                  <th className="text-right py-2">Gain</th>
                </tr>
              </thead>
              <tbody>
                {byHolding.map((h, i) => (
                  <tr key={`${h.source ?? 'manual'}-${h.name}-${h.buyDate}-${i}`} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2">{h.name}</td>
                    <td className="py-2">{h.type}</td>
                    <td className="py-2">{h.buyDate}</td>
                    <td className="py-2">{h.holdingDays}</td>
                    <td className="py-2">
                      <span className={h.bucket === 'LTCG' ? 'text-green-600 dark:text-green-400' : h.bucket === 'STCG' ? 'text-amber-600 dark:text-amber-400' : ''}>
                        {h.bucket}{h.bucketApprox ? ' (approx)' : ''}
                      </span>
                    </td>
                    <td className="text-right py-2">₹{h.cost.toLocaleString('en-IN')}</td>
                    <td className="text-right py-2">₹{h.value.toLocaleString('en-IN')}</td>
                    <td className={`text-right py-2 ${h.gain >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ₹{h.gain.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
