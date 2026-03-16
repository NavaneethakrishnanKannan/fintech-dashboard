'use client'

import { v4 as uuid } from 'uuid'

export type FixedExpenseRow = {
  id: string
  label: string
  amount: number
}

type Props = {
  rows: FixedExpenseRow[]
  onChange: (rows: FixedExpenseRow[]) => void
}

const DEFAULT_LABELS = ['Rent', 'EMI', 'Subscriptions', 'Insurance']

export function FixedExpensesStep({ rows, onChange }: Props) {
  const updateRow = (id: string, patch: Partial<FixedExpenseRow>) => {
    onChange(
      rows.map((r) => (r.id === id ? { ...r, ...patch, amount: patch.amount != null ? Number(patch.amount) || 0 : r.amount } : r)),
    )
  }

  const addRow = (label?: string) => {
    onChange([...rows, { id: uuid(), label: label ?? '', amount: 0 }])
  }

  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id))
  }

  const ensureInitialRows = () => {
    if (rows.length === 0) {
      onChange(DEFAULT_LABELS.map((label) => ({ id: uuid(), label, amount: 0 })))
    }
  }

  // Initialise suggested rows lazily, without side effects on first render
  if (rows.length === 0) {
    // This call is safe here because component is client-side and we immediately render with defaults
    ensureInitialRows()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Add your fixed monthly expenses. These usually don’t change much month to month.
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex gap-2 items-center">
            <input
              type="text"
              value={row.label}
              onChange={(e) => updateRow(row.id, { label: e.target.value })}
              placeholder="Name (e.g. Rent)"
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              step={500}
              value={row.amount || ''}
              onChange={(e) => updateRow(row.id, { amount: Number(e.target.value) || 0 })}
              placeholder="Amount ₹"
              className="w-28 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="text-xs text-red-600 dark:text-red-400"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => addRow()}
        className="text-sm text-blue-600 dark:text-blue-400"
      >
        + Add another fixed expense
      </button>
    </div>
  )
}

