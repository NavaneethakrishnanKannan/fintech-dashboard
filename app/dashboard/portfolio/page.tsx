'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { PieChartCard } from '@/components/Charts/PieChartCard'
import { LineChartCard } from '@/components/Charts/LineChartCard'
import { SliderInput } from '@/components/SliderInput'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

const PORTFOLIO_KEY = '/api/portfolio/combined'

type PortfolioSummary = {
  totalInvested: number
  totalCurrentValue: number
  totalPnl: number
  pnlPercent: number
  cagr: number | null
  allocationByAsset: { name: string; value: number }[]
  allocationBySector: { name: string; value: number }[]
  allocationByCategory: { name: string; value: number }[]
}

type Investment = {
  id: string
  type: string
  name: string
  quantity: number
  buyPrice: number
  currentPrice: number | null
  profit: number
  buyDate: string
  sector: string | null
  category: string | null
  monthlySip: number | null
  goalId?: string | null
  goal?: { id: string; title: string } | null
}

type HoldingRow = {
  source: 'zerodha' | 'manual'
  id?: string
  name: string
  type: string
  quantity: number
  invested: number
  value: number
  pnl: number
  monthlySip?: number | null
  buyDate?: string
  goalId?: string | null
  goalTitle?: string | null
}

type Goal = { id: string; title: string }

type CombinedResponse = {
  zerodhaConnected: boolean
  zerodhaError: string | null
  summary: PortfolioSummary
  holdings: HoldingRow[]
  manualInvestments: Investment[]
}

export default function PortfolioPage() {
  const { data: combined, error: combinedError, mutate } = useSWR<CombinedResponse>(PORTFOLIO_KEY)
  const { data: goals = [] } = useSWR<Goal[]>('/api/goals')
  const [projection, setProjection] = useState<{ year: number; value: number }[]>([])
  const [sip, setSip] = useState(5000)
  const [returnPct, setReturnPct] = useState(12)
  const [years, setYears] = useState(15)
  const [addForm, setAddForm] = useState({ name: '', type: 'STOCK', quantity: '1', buyPrice: '', currentPrice: '', buyDate: new Date().toISOString().slice(0, 10), sector: '', category: '', monthlySip: '', goalId: '' })
  const [addLoading, setAddLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Investment> | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const summary = combined?.summary ?? null
  const holdings = combined?.holdings ?? []
  const investments = combined?.manualInvestments ?? []
  const loading = !combined && !combinedError

  useEffect(() => {
    if (combined?.manualInvestments?.length && sip === 5000) {
      const totalSip = (combined.manualInvestments as Investment[]).reduce((sum, i) => sum + (i.monthlySip ?? 0), 0)
      if (totalSip > 0) setSip(totalSip)
    }
  }, [combined])

  const loadProjection = async () => {
    try {
      const res = await axios.post('/api/portfolio/projection', {
        monthlySip: sip,
        expectedAnnualReturn: returnPct,
        years,
        initialValue: summary?.totalCurrentValue,
      })
      setProjection(res.data.timeline ?? [])
    } catch {
      setProjection([])
    }
  }

  useEffect(() => { if (summary != null) loadProjection() }, [summary, sip, returnPct, years])

  const submitInvestment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (addLoading || !addForm.name.trim() || !addForm.buyPrice) return
    setAddLoading(true)
    setToast(null)
    try {
      await axios.post('/api/investments', {
        name: addForm.name.trim(),
        type: addForm.type,
        quantity: Number(addForm.quantity) || 1,
        buyPrice: Number(addForm.buyPrice),
        currentPrice: addForm.currentPrice ? Number(addForm.currentPrice) : null,
        buyDate: addForm.buyDate || new Date().toISOString().slice(0, 10),
        sector: addForm.sector.trim() || null,
        category: addForm.category.trim() || null,
        monthlySip: addForm.monthlySip ? Number(addForm.monthlySip) : null,
        goalId: addForm.goalId || null,
      })
      setAddForm({ name: '', type: 'STOCK', quantity: '1', buyPrice: '', currentPrice: '', buyDate: new Date().toISOString().slice(0, 10), sector: '', category: '', monthlySip: '', goalId: '' })
      setToast('Investment added.')
      mutate()
    } catch {
      setToast('Failed to add investment.')
    } finally {
      setAddLoading(false)
    }
  }

  const startEdit = (inv: Investment) => {
    if (!inv.id) return
    setEditingId(inv.id)
    setEditForm({
      name: inv.name,
      type: inv.type,
      quantity: inv.quantity,
      buyPrice: inv.buyPrice,
      currentPrice: inv.currentPrice,
      buyDate: inv.buyDate.slice(0, 10),
      sector: inv.sector ?? '',
      category: inv.category ?? '',
      monthlySip: inv.monthlySip,
      goalId: inv.goalId ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(null)
  }

  const saveEdit = async () => {
    if (!editingId || !editForm || editLoading) return
    setEditLoading(true)
    setToast(null)
    try {
      await axios.patch(`/api/investments/${editingId}`, {
        name: editForm.name?.trim(),
        type: editForm.type,
        quantity: editForm.quantity != null ? Number(editForm.quantity) : undefined,
        buyPrice: editForm.buyPrice,
        currentPrice: editForm.currentPrice != null ? Number(editForm.currentPrice) : null,
        buyDate: editForm.buyDate,
        sector: editForm.sector || null,
        category: editForm.category || null,
        monthlySip: editForm.monthlySip != null ? Number(editForm.monthlySip) : null,
        goalId: editForm.goalId || null,
      })
      setToast('Updated.')
      cancelEdit()
      mutate()
    } catch {
      setToast('Update failed.')
    } finally {
      setEditLoading(false)
    }
  }

  if (loading) return <div className="py-8 text-gray-500">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Portfolio</h1>

      {combined?.zerodhaError && (
        <div className="text-sm rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3">
          <p className="text-amber-800 dark:text-amber-200">
            {combined.zerodhaError === 'Session expired'
              ? 'Zerodha session has expired.'
              : 'Zerodha connection issue.'}
            {' '}
            <Link href="/dashboard/integrations" className="font-medium underline hover:no-underline">Reconnect in Integrations</Link>
            {' '}to refresh your equity and mutual fund data. Showing manually saved data until then.
          </p>
        </div>
      )}
      {summary && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DashboardCard>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total invested</p>
            <p className="text-xl font-semibold">₹{summary.totalInvested.toLocaleString('en-IN')}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current value</p>
            <p className="text-xl font-semibold">₹{summary.totalCurrentValue.toLocaleString('en-IN')}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-sm text-gray-500 dark:text-gray-400">P&amp;L</p>
            <p className={`text-xl font-semibold ${summary.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ₹{summary.totalPnl.toLocaleString('en-IN')} ({summary.pnlPercent.toFixed(1)}%)
            </p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-sm text-gray-500 dark:text-gray-400">CAGR</p>
            <p className="text-xl font-semibold">{summary.cagr != null ? `${summary.cagr.toFixed(1)}%` : '—'}</p>
          </DashboardCard>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PieChartCard title="Allocation by asset type" data={summary?.allocationByAsset ?? []} />
        <PieChartCard title="Allocation by sector" data={summary?.allocationBySector ?? []} />
      </div>
      <PieChartCard title="Allocation by category" data={summary?.allocationByCategory ?? []} className="max-w-2xl" />

      <DashboardCard title="Future value projection">
        {(() => {
          const totalSipFromHoldings = (combined?.manualInvestments ?? []).reduce((sum, i) => sum + (i.monthlySip ?? 0), 0)
          return totalSipFromHoldings > 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total monthly SIP from holdings: ₹{totalSipFromHoldings.toLocaleString('en-IN')} (slider pre-filled from this; you can change it.)</p>
          ) : null
        })()}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <SliderInput label="Monthly SIP (₹)" value={sip} min={0} max={100000} step={500} unit="₹" onChange={setSip} />
          <SliderInput label="Expected return (%)" value={returnPct} min={0} max={30} step={0.5} unit="%" onChange={setReturnPct} />
          <SliderInput label="Years" value={years} min={1} max={30} onChange={setYears} />
        </div>
        {projection.length > 0 && (
          <LineChartCard
            title="Projected value"
            data={projection}
            xKey="year"
            lines={[{ dataKey: 'value', name: 'Value', color: '#00C49F' }]}
          />
        )}
      </DashboardCard>

      <div className="flex flex-wrap gap-3 text-xs">
        <Link
          href="/dashboard/add-data?section=investments"
          className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-800 px-3 py-1 text-blue-700 dark:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/30"
        >
          + Add investment (via Add data)
        </Link>
      </div>

      <DashboardCard title="Holdings">
        {combined?.zerodhaConnected && !combined?.zerodhaError && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Equity &amp; MF from Zerodha; chit fund, ETF, crypto, other from saved data.</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600">
                <th className="text-left py-2">Source</th>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Goal</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Invested</th>
                <th className="text-right py-2">Current</th>
                <th className="text-right py-2">P&amp;L</th>
                <th className="text-right py-2">Monthly SIP</th>
                <th className="text-left py-2">Buy date</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((row) => {
                const inv = row.id ? investments.find((i) => i.id === row.id) : null
                const isEditing = inv && editingId === inv.id
                if (isEditing && editForm) {
                  return (
                    <tr key={inv!.id} className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <td className="py-2">Manual</td>
                      <td className="py-2"><input type="text" value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f!, name: e.target.value }))} className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm" /></td>
                      <td className="py-2">
                        <select value={editForm.type ?? 'OTHER'} onChange={(e) => setEditForm((f) => ({ ...f!, type: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm">
                          <option value="STOCK">Stock</option>
                          <option value="MUTUAL_FUND">Mutual fund</option>
                          <option value="CHIT_FUND">Chit fund</option>
                          <option value="ETF">ETF</option>
                          <option value="CRYPTO">Crypto</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </td>
                      <td className="py-2">
                        <select value={editForm.goalId ?? ''} onChange={(e) => setEditForm((f) => ({ ...f!, goalId: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm">
                          <option value="">No goal</option>
                          {goals.map((g) => (
                            <option key={g.id} value={g.id}>{g.title}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2"><input type="number" value={editForm.quantity ?? ''} onChange={(e) => setEditForm((f) => ({ ...f!, quantity: Number(e.target.value) }))} min="0.0001" step="any" className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right" /></td>
                      <td className="py-2"><input type="number" value={editForm.buyPrice ?? ''} onChange={(e) => setEditForm((f) => ({ ...f!, buyPrice: Number(e.target.value) }))} min="0" step="0.01" className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right" /></td>
                      <td className="py-2"><input type="number" value={editForm.currentPrice ?? ''} onChange={(e) => setEditForm((f) => ({ ...f!, currentPrice: e.target.value === '' ? null : Number(e.target.value) }))} min="0" step="0.01" className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right" placeholder="—" /></td>
                      <td className="py-2">—</td>
                      <td className="py-2"><input type="number" value={editForm.monthlySip ?? ''} onChange={(e) => setEditForm((f) => ({ ...f!, monthlySip: e.target.value === '' ? null : Number(e.target.value) }))} min="0" step="100" className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-right" placeholder="—" /></td>
                      <td className="py-2"><input type="date" value={editForm.buyDate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f!, buyDate: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm" /></td>
                      <td className="py-2">
                        <button type="button" onClick={saveEdit} disabled={editLoading} className="text-blue-600 dark:text-blue-400 text-sm font-medium mr-2">Save</button>
                        <button type="button" onClick={cancelEdit} className="text-gray-500 text-sm">Cancel</button>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={row.source + (row.id ?? '') + row.name + row.type} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2">{row.source === 'zerodha' ? 'Zerodha' : 'Manual'}</td>
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{row.type}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-400" title="Funded by">{row.goalTitle ?? '—'}</td>
                    <td className="text-right py-2">{row.quantity}</td>
                    <td className="text-right py-2">₹{row.invested.toLocaleString('en-IN')}</td>
                    <td className="text-right py-2">₹{row.value.toLocaleString('en-IN')}</td>
                    <td className={`text-right py-2 ${row.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>₹{row.pnl.toLocaleString('en-IN')}</td>
                    <td className="text-right py-2">{row.monthlySip != null ? `₹${row.monthlySip.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-400">{row.buyDate ?? '—'}</td>
                    <td className="text-right py-2">
                      {row.source === 'manual' && inv && (
                        <button type="button" onClick={() => startEdit(inv)} className="text-blue-600 dark:text-blue-400 text-sm font-medium">Edit</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {holdings.length === 0 && <p className="text-gray-500 py-4">No investments. Connect Zerodha (Integrations) or add manual entries below.</p>}
      </DashboardCard>
    </div>
  )
}
