'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export function BarChartCard<T extends Record<string, string | number>>({
  title,
  data,
  xKey,
  barKey,
  className = '',
}: {
  title: string
  data: T[]
  xKey: keyof T
  barKey: keyof T
  className?: string
}) {
  if (!data.length) {
    return (
      <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${className}`}>
        <h3 className="font-medium mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">No data</p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 ${className}`}>
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
            <XAxis dataKey={xKey as string} className="text-xs" />
            <YAxis className="text-xs" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [`₹${Number(v).toLocaleString('en-IN')}`, '']} />
            <Legend />
            <Bar dataKey={barKey as string} fill="#0088FE" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
