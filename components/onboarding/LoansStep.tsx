'use client'

import { v4 as uuid } from 'uuid'

export type LoanRow = {
  id: string
  type: string
  totalAmount: number
  emi: number
  interestRate?: number
}

type Props = {
  hasLoans: boolean | null
  loans: LoanRow[]
  onChange: (state: { hasLoans: boolean; loans: LoanRow[] }) => void
}

export function LoansStep({ hasLoans, loans, onChange }: Props) {
  const setHasLoans = (value: boolean) => {
    onChange({ hasLoans: value, loans: value ? loans : [] })
  }

  const updateLoan = (id: string, patch: Partial<LoanRow>) => {
    const next = loans.map((l) =>
      l.id === id
        ? {
            ...l,
            ...patch,
            totalAmount: patch.totalAmount != null ? Number(patch.totalAmount) || 0 : l.totalAmount,
            emi: patch.emi != null ? Number(patch.emi) || 0 : l.emi,
            interestRate:
              patch.interestRate != null
                ? Number(patch.interestRate) || 0
                : l.interestRate,
          }
        : l,
    )
    onChange({ hasLoans: true, loans: next })
  }

  const addLoan = () => {
    onChange({
      hasLoans: true,
      loans: [...loans, { id: uuid(), type: '', totalAmount: 0, emi: 0, interestRate: undefined }],
    })
  }

  const removeLoan = (id: string) => {
    onChange({ hasLoans: true, loans: loans.filter((l) => l.id !== id) })
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Do you currently have any loans?</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setHasLoans(true)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              hasLoans
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-100'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setHasLoans(false)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              hasLoans === false
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-100'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            }`}
          >
            No
          </button>
        </div>
      </div>

      {hasLoans && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">You can add a few major loans now, or add details later from the Loans page.</p>
          {loans.map((loan) => (
            <div
              key={loan.id}
              className="grid grid-cols-2 gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded"
            >
              <input
                type="text"
                placeholder="Loan type (e.g. Home, Car)"
                value={loan.type}
                onChange={(e) => updateLoan(loan.id, { type: e.target.value })}
                className="col-span-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                placeholder="Total amount ₹"
                value={loan.totalAmount || ''}
                onChange={(e) => updateLoan(loan.id, { totalAmount: Number(e.target.value) || 0 })}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                placeholder="EMI ₹"
                value={loan.emi || ''}
                onChange={(e) => updateLoan(loan.id, { emi: Number(e.target.value) || 0 })}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                placeholder="Interest % (optional)"
                value={loan.interestRate ?? ''}
                onChange={(e) =>
                  updateLoan(loan.id, { interestRate: e.target.value === '' ? undefined : Number(e.target.value) || 0 })
                }
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => removeLoan(loan.id)}
                className="text-xs text-red-600 dark:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addLoan}
            className="text-sm text-blue-600 dark:text-blue-400"
          >
            + Add loan
          </button>
        </div>
      )}
    </div>
  )
}

