'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ThemeToggle } from './ThemeToggle'

type ExportFormat = 'csv' | 'pdf' | 'xlsx'

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/onboarding', label: 'Onboarding' },
  { href: '/dashboard/add-data', label: 'Add data' },
  { href: '/dashboard/portfolio', label: 'Portfolio' },
  { href: '/dashboard/expenses', label: 'Expenses' },
  { href: '/dashboard/report', label: 'Monthly report' },
  { href: '/dashboard/loans', label: 'Loans' },
  { href: '/dashboard/goals', label: 'Goals' },
  { href: '/dashboard/health', label: 'Financial Health' },
  { href: '/dashboard/analytics', label: 'Behavior analytics' },
  { href: '/dashboard/tax', label: 'Tax (LTCG/STCG)' },
  { href: '/dashboard/planner', label: 'AI Planner' },
  { href: '/dashboard/projection', label: 'Wealth Projection' },
  { href: '/dashboard/timeline', label: 'Wealth timeline' },
  { href: '/dashboard/afford', label: 'Can I afford this?' },
  { href: '/dashboard/scenario', label: 'Scenario Simulator' },
  { href: '/dashboard/fire', label: 'FIRE Calculator' },
  { href: '/dashboard/ai', label: 'AI Advisor' },
  { href: '/dashboard/integrations', label: 'Integrations' },
  { href: '/dashboard/settings', label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [downloadingFormat, setDownloadingFormat] = useState<ExportFormat | null>(null)
  const [onboardingProgress, setOnboardingProgress] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/onboarding/status', { credentials: 'include' })
        if (!res.ok) return
        const data = (await res.json()) as { progress?: number; completed?: boolean }
        if (!cancelled) {
          if (typeof data.progress === 'number') {
            setOnboardingProgress(Math.max(0, Math.min(100, Math.round(data.progress))))
          } else if (data.completed) {
            setOnboardingProgress(100)
          } else {
            setOnboardingProgress(0)
          }
        }
      } catch {
        // ignore
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleDownload = async (format: ExportFormat) => {
    setDownloadingFormat(format)
    try {
      const res = await fetch(`/api/export?format=${format}`, { credentials: 'include' })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'csv' ? 'wealth-export.csv' : format === 'pdf' ? 'wealth-export.pdf' : 'wealth-export.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingFormat(null)
    }
  }

  const exportButtons: { format: ExportFormat; label: string }[] = [
    { format: 'csv', label: 'Download CSV' },
    { format: 'pdf', label: 'Download PDF' },
    { format: 'xlsx', label: 'Download Excel' },
  ]
  const isExporting = downloadingFormat !== null

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
          {nav.map(({ href, label }) => {
            const isActive = pathname === href
            const isOnboarding = href === '/dashboard/onboarding'
            const showProgress = isOnboarding && onboardingProgress != null
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm ${
                  isActive ? 'bg-gray-200 dark:bg-gray-700 font-medium' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <span>{label}</span>
                {showProgress && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-200">
                    {onboardingProgress}%
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-1 shrink-0">
          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Export</div>
          {exportButtons.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              onClick={() => handleDownload(format)}
              disabled={isExporting}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60 disabled:pointer-events-none flex items-center gap-2"
            >
              {downloadingFormat === format ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin shrink-0" aria-hidden />
                  <span>Preparing…</span>
                </>
              ) : (
                label
              )}
            </button>
          ))}
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
