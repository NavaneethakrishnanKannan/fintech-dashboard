'use client'

import { v4 as uuid } from 'uuid'

export type VariableExpenseRow = {
  id: string
  label: string
  amount: number
}

type Props = {
  rows: VariableExpenseRow[]
  onChange: (rows: VariableExpenseRow[]) => void
  onSkip: () => void
}

const DEFAULT_LABELS = ['Food', 'Transport', 'Shopping', 'Entertainment']

export function VariableExpensesStep({ rows, onChange, onSkip }: Props) {
  const ensureInitialRows = () => {
    if (rows.length === 0) {
      onChange(DEFAULT_LABELS.map((label) => ({ id: uuid(), label, amount: 0 })))
    }
  }

  if (rows.length === 0) {
    ensureInitialRows()
  }

  const updateRow = (id: string, patch: Partial<VariableExpenseRow>) => {
    onChange(
      rows.map((r) => (r.id === id ? { ...r, ...patch, amount: patch.amount != null ? Number(patch.amount) || 0 : r.amount } : r)),
    )
  }

  const addRow = () => {
    onChange([...rows, { id: uuid(), label: '', amount: 0 }])
  }

  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Do you want to add your common spending categories? This helps make the first dashboard view more accurate.
        You can also skip this step and enter details later.
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex gap-2 items-center">
            <input
              type="text"
              value={row.label}
              onChange={(e) => updateRow(row.id, { label: e.target.value })}
              placeholder="Category (e.g. Food)"
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
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onSkip}
          className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
        >
          Skip this step
        </button>
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-blue-600 dark:text-blue-400"
        >
          + Add another category
        </button>
      </div>
    </div>
  )
}

