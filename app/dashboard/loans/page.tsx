'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'
import { SliderInput } from '@/components/SliderInput'
import { LineChartCard } from '@/components/Charts/LineChartCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type Loan = {
  id: string
  name: string
  principal: number
  interest: number
  tenure: number
  totalTenureMonths: number | null
  emi: number
  startDate: string
  remainingPrincipal?: number
}

type Projection = {
  remainingPrincipal: number
  monthsRemaining: number
  totalInterestPaid: number
  schedule: { month: number; balance: number; interest: number; principal: number }[]
  extraEmi: { extraEmi: number; monthsSaved: number; interestSaved: number } | null
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [projection, setProjection] = useState<Projection | null>(null)
  const [extraEmi, setExtraEmi] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addForm, setAddForm] = useState({ name: '', principal: '', interest: '', tenure: '', totalTenureMonths: '', emi: '', startDate: new Date().toISOString().slice(0, 10) })
  const [addLoading, setAddLoading] = useState(false)
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', principal: '', interest: '', tenure: '', totalTenureMonths: '', emi: '', startDate: '' })
  const [editLoading, setEditLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const loadLoans = async () => {
    try {
      setLoading(true)
      const res = await axios.get<Loan[]>('/api/loans')
      setLoans(res.data)
      if (res.data.length && !selectedLoanId) setSelectedLoanId(res.data[0].id)
    } catch {
      setLoans([])
    } finally {
      setLoading(false)
    }
  }

  const loadProjection = async () => {
    if (!selectedLoanId) return
    try {
      const res = await axios.post<Projection>('/api/loans/projection', { loanId: selectedLoanId, extraEmi })
      setProjection(res.data)
    } catch {
      setProjection(null)
    }
  }

  useEffect(() => { loadLoans() }, [])
  useEffect(() => { if (selectedLoanId) loadProjection() }, [selectedLoanId, extraEmi])

  const submitLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    const principal = Number(addForm.principal)
    const tenure = Number(addForm.tenure) || 0
    const emi = Number(addForm.emi)
    if (addLoading || !addForm.name.trim() || !principal || tenure <= 0 || !emi) return
    setAddLoading(true)
    setToast(null)
    try {
      await axios.post('/api/loans', {
        name: addForm.name.trim(),
        principal,
        interest: Number(addForm.interest) || 0,
        tenure,
        totalTenureMonths: addForm.totalTenureMonths ? Number(addForm.totalTenureMonths) : tenure,
        emi,
        startDate: addForm.startDate || new Date().toISOString().slice(0, 10),
      })
      setAddForm({ name: '', principal: '', interest: '', tenure: '', totalTenureMonths: '', emi: '', startDate: new Date().toISOString().slice(0, 10) })
      setToast('Loan added.')
      loadLoans()
    } catch {
      setToast('Failed to add loan.')
    } finally {
      setAddLoading(false)
    }
  }

  const startEdit = (l: Loan) => {
    setEditingLoanId(l.id)
    setEditForm({
      name: l.name,
      principal: String(l.principal),
      interest: String(l.interest),
      tenure: String(l.tenure),
      totalTenureMonths: l.totalTenureMonths != null ? String(l.totalTenureMonths) : '',
      emi: String(l.emi),
      startDate: l.startDate ? new Date(l.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    })
    setToast(null)
  }

  const cancelEdit = () => {
    setEditingLoanId(null)
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingLoanId || editLoading) return
    const principal = Number(editForm.principal)
    const tenure = Number(editForm.tenure) || 0
    const emi = Number(editForm.emi)
    if (!editForm.name.trim() || !principal || tenure <= 0 || !emi) return
    setEditLoading(true)
    setToast(null)
    try {
      await axios.patch(`/api/loans/${editingLoanId}`, {
        name: editForm.name.trim(),
        principal,
        interest: Number(editForm.interest) || 0,
        tenure,
        totalTenureMonths: editForm.totalTenureMonths ? Number(editForm.totalTenureMonths) : tenure,
        emi,
        startDate: editForm.startDate || new Date().toISOString().slice(0, 10),
      })
      setEditingLoanId(null)
      setToast('Loan updated.')
      loadLoans()
    } catch {
      setToast('Failed to update loan.')
    } finally {
      setEditLoading(false)
    }
  }

  const deleteLoan = async (id: string) => {
    if (!confirm('Delete this loan? This cannot be undone.')) return
    setToast(null)
    try {
      await axios.delete(`/api/loans/${id}`)
      if (selectedLoanId === id) setSelectedLoanId(loans.find((l) => l.id !== id)?.id ?? null)
      setToast('Loan deleted.')
      loadLoans()
    } catch {
      setToast('Failed to delete loan.')
    }
  }

  if (loading && !loans.length) return <div className="py-8 text-gray-500">Loading…</div>

  const balanceData = projection?.schedule?.map((s) => ({ month: s.month, balance: s.balance })) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Loans</h1>

      <DashboardCard title="Add loan">
        <form onSubmit={submitLoan} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <input type="text" placeholder="Loan name" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
          <input type="number" placeholder="Principal (₹)" value={addForm.principal} onChange={(e) => setAddForm((f) => ({ ...f, principal: e.target.value }))} min="0" step="0.01" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
          <input type="number" placeholder="Interest % p.a." value={addForm.interest} onChange={(e) => setAddForm((f) => ({ ...f, interest: e.target.value }))} min="0" step="0.1" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          <input type="number" placeholder="Tenure (months left)" value={addForm.tenure} onChange={(e) => setAddForm((f) => ({ ...f, tenure: e.target.value }))} min="1" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
          <input type="number" placeholder="Total tenure (months, optional)" value={addForm.totalTenureMonths} onChange={(e) => setAddForm((f) => ({ ...f, totalTenureMonths: e.target.value }))} min="1" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          <input type="number" placeholder="EMI (₹)" value={addForm.emi} onChange={(e) => setAddForm((f) => ({ ...f, emi: e.target.value }))} min="0" step="0.01" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
          <input type="date" value={addForm.startDate} onChange={(e) => setAddForm((f) => ({ ...f, startDate: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
          <button type="submit" disabled={addLoading} className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 sm:col-span-2">Add loan</button>
        </form>
        {toast && <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{toast}</p>}
      </DashboardCard>

      {editingLoanId && (
        <DashboardCard title="Edit loan">
          <form onSubmit={saveEdit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <input type="text" placeholder="Loan name" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
            <input type="number" placeholder="Principal (₹)" value={editForm.principal} onChange={(e) => setEditForm((f) => ({ ...f, principal: e.target.value }))} min="0" step="0.01" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
            <input type="number" placeholder="Interest % p.a." value={editForm.interest} onChange={(e) => setEditForm((f) => ({ ...f, interest: e.target.value }))} min="0" step="0.1" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            <input type="number" placeholder="Tenure (months left)" value={editForm.tenure} onChange={(e) => setEditForm((f) => ({ ...f, tenure: e.target.value }))} min="1" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
            <input type="number" placeholder="Total tenure (months, optional)" value={editForm.totalTenureMonths} onChange={(e) => setEditForm((f) => ({ ...f, totalTenureMonths: e.target.value }))} min="1" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            <input type="number" placeholder="EMI (₹)" value={editForm.emi} onChange={(e) => setEditForm((f) => ({ ...f, emi: e.target.value }))} min="0" step="0.01" className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" required />
            <input type="date" value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={editLoading} className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Save</button>
              <button type="button" onClick={cancelEdit} disabled={editLoading} className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">Cancel</button>
            </div>
          </form>
        </DashboardCard>
      )}

      <DashboardCard title="Your loans">
        <ul className="space-y-2">
          {loans.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <button type="button" onClick={() => setSelectedLoanId(l.id)} className={`text-left flex-1 min-w-0 ${selectedLoanId === l.id ? 'font-semibold' : ''}`}>
                {l.name} — EMI ₹{l.emi.toLocaleString('en-IN')} · ₹{(l.remainingPrincipal ?? l.principal).toLocaleString('en-IN')} outstanding
              </button>
              <span className="flex shrink-0 gap-1">
                <button type="button" onClick={() => startEdit(l)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Edit</button>
                <button type="button" onClick={() => deleteLoan(l.id)} className="text-sm text-red-600 dark:text-red-400 hover:underline">Delete</button>
              </span>
            </li>
          ))}
        </ul>
        {loans.length === 0 && <p className="text-gray-500 py-4">No loans.</p>}
      </DashboardCard>

      {selectedLoanId && (
        <>
          <DashboardCard title="Payoff simulator">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Increase EMI to see how much sooner you can close the loan and interest saved.</p>
            <SliderInput label="Extra EMI (₹)" value={extraEmi} min={0} max={50000} step={500} unit="₹" onChange={setExtraEmi} />
            {projection?.extraEmi && projection.extraEmi.extraEmi > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200">
                <p>Months saved: <strong>{projection.extraEmi.monthsSaved}</strong> (loan closes earlier)</p>
                <p>Interest saved: <strong>₹{projection.extraEmi.interestSaved.toLocaleString('en-IN')}</strong></p>
                <p className="text-xs mt-1 opacity-90">Less interest you will pay on the remaining balance by closing the loan sooner.</p>
              </div>
            )}
          </DashboardCard>

          {projection && (
            <DashboardCard title="Loan details">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div><p className="text-sm text-gray-500">Remaining principal</p><p className="font-semibold">₹{projection.remainingPrincipal.toLocaleString('en-IN')}</p></div>
                <div><p className="text-sm text-gray-500">Months remaining</p><p className="font-semibold">{projection.monthsRemaining}</p></div>
                <div><p className="text-sm text-gray-500">Total interest (remaining)</p><p className="font-semibold">₹{projection.totalInterestPaid.toLocaleString('en-IN')}</p></div>
              </div>
              {balanceData.length > 0 && (
                <LineChartCard title="Remaining balance over time" data={balanceData} xKey="month" lines={[{ dataKey: 'balance', name: 'Balance' }]} />
              )}
            </DashboardCard>
          )}
        </>
      )}
    </div>
  )
}
