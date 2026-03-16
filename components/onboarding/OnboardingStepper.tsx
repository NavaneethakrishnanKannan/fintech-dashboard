'use client'

type Step = {
  key: string
  label: string
}

type Props = {
  steps: Step[]
  currentIndex: number
}

export function OnboardingStepper({ steps, currentIndex }: Props) {
  const total = steps.length
  const clampedIndex = Math.min(Math.max(currentIndex, 0), total - 1)
  const pct = ((clampedIndex + 1) / total) * 100

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">
          Step {clampedIndex + 1} of {total}
        </span>
        <span>{steps[clampedIndex]?.label}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

