'use client'

const GOALS = [
  'Retire early',
  'Buy a house',
  'Build wealth',
  'Emergency fund',
  'Children education',
] as const

type PrimaryGoal = (typeof GOALS)[number]

type Props = {
  value: PrimaryGoal | null
  onChange: (v: PrimaryGoal) => void
}

export function GoalStep({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        What is your primary financial goal right now? This helps tailor the AI suggestions and projections.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {GOALS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onChange(g)}
            className={`text-left px-3 py-2 rounded-lg border text-sm ${
              value === g
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-100'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {g}
          </button>
        ))}
      </div>
    </div>
  )
}

