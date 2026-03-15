'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ThemeToggle } from './ThemeToggle'

async function downloadExport(format: 'csv' | 'pdf' | 'xlsx') {
  const res = await fetch(`/api/export?format=${format}`, { credentials: 'include' })
  if (!res.ok) return
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = format === 'csv' ? 'wealth-export.csv' : format === 'pdf' ? 'wealth-export.pdf' : 'wealth-export.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/portfolio', label: 'Portfolio' },
  { href: '/dashboard/expenses', label: 'Expenses' },
  { href: '/dashboard/loans', label: 'Loans' },
  { href: '/dashboard/goals', label: 'Goals' },
  { href: '/dashboard/health', label: 'Financial Health' },
  { href: '/dashboard/tax', label: 'Tax (LTCG/STCG)' },
  { href: '/dashboard/planner', label: 'AI Planner' },
  { href: '/dashboard/scenario', label: 'Scenario Simulator' },
  { href: '/dashboard/fire', label: 'FIRE Calculator' },
  { href: '/dashboard/ai', label: 'AI Advisor' },
  { href: '/dashboard/integrations', label: 'Integrations' },
  { href: '/dashboard/settings', label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="md:hidden fixed top-4 left-4 z-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
        aria-label="Toggle menu"
      >
        {open ? 'Close' : 'Menu'}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-10 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col h-screen fixed inset-y-0 left-0 z-10 transform transition-transform md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } md:sticky md:top-0`}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <Link href="/dashboard" className="font-semibold text-lg" onClick={() => setOpen(false)}>Wealth</Link>
          <ThemeToggle />
        </div>
        <nav className="p-2 flex-1 min-h-0 overflow-y-auto">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 rounded-md text-sm ${
                pathname === href
                  ? 'bg-gray-200 dark:bg-gray-700 font-medium'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-1 shrink-0">
          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Export</div>
          <button type="button" onClick={() => downloadExport('csv')} className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
            Download CSV
          </button>
          <button type="button" onClick={() => downloadExport('pdf')} className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
            Download PDF
          </button>
          <button type="button" onClick={() => downloadExport('xlsx')} className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
            Download Excel
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full text-left px-3 py-2 rounded-md text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
