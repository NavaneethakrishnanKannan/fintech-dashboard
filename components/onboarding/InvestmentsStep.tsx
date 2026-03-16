'use client'

type Props = {
  hasInvestments: boolean | null
  totalInvestments: number | null
  onChange: (state: { hasInvestments: boolean; totalInvestments: number }) => void
}

export function InvestmentsStep({ hasInvestments, totalInvestments, onChange }: Props) {
  const handleHasInvestments = (value: boolean) => {
    onChange({
      hasInvestments: value,
      totalInvestments: value ? totalInvestments ?? 0 : 0,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Do you already have any investments?</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleHasInvestments(true)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              hasInvestments
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-100'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => handleHasInvestments(false)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              hasInvestments === false
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-100'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
            }`}
          >
            No
          </button>
        </div>
      </div>

      {hasInvestments && (
        <label className="block">
          <span className="text-sm text-gray-600 dark:text-gray-400">Rough total value of your investments (₹)</span>
          <input
            type="number"
            min={0}
            step={10000}
            value={totalInvestments ?? ''}
            onChange={(e) => onChange({ hasInvestments: true, totalInvestments: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
            You don&apos;t need to be exact. Detailed holdings can be added later from the Portfolio section.
          </span>
        </label>
      )}
    </div>
  )
}

