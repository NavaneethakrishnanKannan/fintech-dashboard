'use client'

type SliderInputProps = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
  /** When false, show as read-only: no text input, slider still reflects value but is disabled. */
  editable?: boolean
}

export function SliderInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  editable = true,
}: SliderInputProps) {
  const clamp = (v: number) => {
    if (Number.isNaN(v)) return min
    if (v < min) return min
    if (v > max) return max
    return v
  }

  const displayValue =
    typeof value === 'number' && Number.isFinite(value)
      ? value % 1 !== 0
        ? value.toFixed(2)
        : value.toString()
      : ''

  const handleNumberChange = (raw: string) => {
    if (!editable) return
    if (raw === '') {
      // Let the user clear; don't spam NaN, just wait until they type something valid
      return
    }
    const parsed = Number(raw)
    const next = clamp(parsed)
    onChange(next)
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center gap-2 text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        {editable ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={displayValue}
              onChange={(e) => handleNumberChange(e.target.value)}
              className="w-24 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-right text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {unit && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {unit}
              </span>
            )}
          </div>
        ) : (
          <span className="font-medium">
            {displayValue}
            {unit}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Number(displayValue) || 0}
        onChange={(e) => editable && onChange(clamp(parseFloat(e.target.value)))}
        className={`w-full h-2 rounded-lg appearance-none ${
          editable ? 'cursor-pointer' : 'cursor-default opacity-60'
        } bg-gray-200 dark:bg-gray-600`}
        disabled={!editable}
      />
    </div>
  )
}
