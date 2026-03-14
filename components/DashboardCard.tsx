import { ReactNode } from 'react'

export function DashboardCard({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden ${className}`}
    >
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 font-medium">
          {title}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}
