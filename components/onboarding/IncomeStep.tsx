'use client'

type Props = {
  value: number | null
  onChange: (v: number) => void
}

export function IncomeStep({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm text-gray-600 dark:text-gray-400">What is your monthly income (₹)?</span>
        <input
          type="number"
          min={0}
          step={1000}
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2"
        />
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        You can approximate. You’ll be able to refine this later from the Expenses and Income sections.
      </p>
    </div>
  )
}

