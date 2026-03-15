'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import axios from 'axios'

const DISMISS_KEY = 'zerodha-expired-banner-dismissed'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

/** Shows a banner when Zerodha is connected but token has expired. Dismissible for the session. Hidden on Integrations page (message shown there already). */
export function ZerodhaExpiredBanner() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    axios
      .get<{ connected: boolean }>('/api/zerodha/status')
      .then((r) => {
        if (cancelled || !r.data?.connected) {
          setChecked(true)
          return
        }
        return axios.get('/api/zerodha/holdings')
      })
      .then(() => {
        if (!cancelled) setChecked(true)
      })
      .catch((err: { response?: { status?: number } }) => {
        if (!cancelled) {
          setChecked(true)
          if (err?.response?.status === 401 && typeof window !== 'undefined' && !sessionStorage.getItem(DISMISS_KEY)) {
            setShow(true)
          }
        }
      })
    return () => { cancelled = true }
  }, [])

  const dismiss = () => {
    if (typeof window !== 'undefined') sessionStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  if (!checked || !show) return null
  if (pathname === '/dashboard/integrations') return null

  return (
    <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 mb-4 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        Zerodha token expired. Reconnect on <Link href="/dashboard/integrations" className="font-medium underline hover:no-underline">Integrations</Link> to refresh your equity and mutual fund data.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="/api/zerodha/connect"
          className="rounded-md bg-amber-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-amber-700"
        >
          Reconnect
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="text-amber-700 dark:text-amber-300 hover:underline text-sm"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
