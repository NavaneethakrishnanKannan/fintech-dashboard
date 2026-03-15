'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type Status = { connected: boolean; kiteUserId: string | null; userName: string | null; connectedAt: string | null }
type Holdings = {
  totalValue: number
  equityValue?: number
  mfValue?: number
  totalSipMonthly?: number
  bySymbol: { symbol: string; value: number; pnl: number }[]
  mfByFund?: { fund: string; value: number; pnl: number }[]
  sips?: { fund: string; instalment_amount: number; frequency: string; next_instalment: string; tag?: string }[]
}

export default function IntegrationsPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status | null>(null)
  const [holdings, setHoldings] = useState<Holdings | null>(null)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [disconnectLoading, setDisconnectLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const connected = searchParams.get('zerodha')
    const reason = searchParams.get('reason')
    if (connected === 'connected') {
      setMessage('Zerodha connected successfully.')
      if (typeof window !== 'undefined') sessionStorage.removeItem('zerodha-expired-banner-dismissed')
    }
    if (connected === 'signin') setMessage('Session was lost when returning from Zerodha. Please stay on the same browser tab when connecting, or sign in again and try Connect Zerodha once more.')
    if (connected === 'error') {
      const reasons: Record<string, string> = {
        no_token: 'No request token from Zerodha. Make sure the redirect URL in Kite developer console is exactly: ' + (typeof window !== 'undefined' ? window.location.origin : '') + '/api/zerodha/callback',
        exchange_failed: 'Token exchange with Zerodha failed. Check that KITE_API_KEY and KITE_API_SECRET in .env are correct and the request token was not used or expired.',
        user_not_enabled: 'Your Zerodha account is not enabled for this app. In Kite (kite.zerodha.com), go to Profile → API and enable this app for your account, then try Connect Zerodha again.',
        invalid_response: 'Invalid response from Zerodha.',
        no_access_token: 'Zerodha did not return an access token.',
        exception: 'Something went wrong. Check server logs.',
      }
      setMessage(reasons[reason ?? ''] || 'Zerodha connection failed. Try again.')
    }
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    setTokenExpired(false)
    axios
      .get<Status>('/api/zerodha/status')
      .then((r) => {
        if (!cancelled) setStatus(r.data)
        if (r.data.connected) {
          return axios.get<Holdings & { holdings?: unknown[]; code?: string; error?: string }>('/api/zerodha/holdings')
        }
        return null
      })
      .then((r) => {
        if (!cancelled && r?.data && !('code' in r.data && r.data.code === 'TOKEN_EXPIRED')) {
          setHoldings({
            totalValue: r.data.totalValue,
            equityValue: r.data.equityValue,
            mfValue: r.data.mfValue,
            totalSipMonthly: r.data.totalSipMonthly,
            bySymbol: r.data.bySymbol ?? [],
            mfByFund: r.data.mfByFund ?? [],
            sips: r.data.sips ?? [],
          })
        }
      })
      .catch((err: { response?: { status?: number; data?: { details?: string; code?: string; error?: string } } }) => {
        if (!cancelled) {
          const statusCode = err.response?.status
          const data = err.response?.data
          if (statusCode === 401) {
            setTokenExpired(true)
            setHoldings(null)
          } else if (statusCode !== 401) {
            setStatus(null)
          }
          const details = data?.details
          if (statusCode === 500 && details) setMessage(`Zerodha status error: ${details}. Run: npx prisma migrate deploy && npx prisma generate`)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const connectZerodha = () => {
    window.location.href = '/api/zerodha/connect'
  }

  const disconnectZerodha = async () => {
    setDisconnectLoading(true)
    try {
      await axios.delete('/api/zerodha/disconnect')
      setStatus({ connected: false, kiteUserId: null, userName: null, connectedAt: null })
      setHoldings(null)
      setMessage('Zerodha disconnected.')
    } catch {
      setMessage('Failed to disconnect.')
    } finally {
      setDisconnectLoading(false)
    }
  }

  if (loading && !status) return <div className="py-8 text-gray-500">Loading…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Integrations</h1>
      {message && (
        <p className={`text-sm rounded-lg p-3 ${message.includes('success') || message.includes('disconnected') ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'}`}>
          {message}
        </p>
      )}

      <DashboardCard title="Zerodha (Kite)">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Link your Zerodha account to pull equity holdings, mutual funds (Coin), and SIPs into the app. Data is used in the dashboard and AI Advisor.
        </p>
        {status?.connected ? (
          <div className="space-y-4">
            {tokenExpired && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Session expired</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">Your Zerodha access token has expired. Reconnect to refresh your holdings and portfolio data.</p>
                <a href="/api/zerodha/connect" className="inline-flex items-center rounded-lg bg-orange-600 text-white px-4 py-2 text-sm font-medium hover:bg-orange-700 mt-3">
                  Reconnect Zerodha
                </a>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              {tokenExpired ? (
                <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">Session expired</span>
              ) : (
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">Connected</span>
              )}
              {status.kiteUserId && <span className="text-sm text-gray-500">ID: {status.kiteUserId}</span>}
              {status.userName && <span className="text-sm text-gray-500">{status.userName}</span>}
              <button type="button" onClick={disconnectZerodha} disabled={disconnectLoading} className="text-sm text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                {disconnectLoading ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
            {holdings && (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Total portfolio (equity + MF)</p>
                  <p className="text-xl font-semibold">₹{holdings.totalValue.toLocaleString('en-IN')}</p>
                  {(holdings.equityValue != null && holdings.equityValue > 0) && (
                    <p className="text-sm text-gray-500 mt-1">Equity: ₹{holdings.equityValue.toLocaleString('en-IN')}</p>
                  )}
                  {(holdings.mfValue != null && holdings.mfValue > 0) && (
                    <p className="text-sm text-gray-500">Mutual funds (Coin): ₹{holdings.mfValue.toLocaleString('en-IN')}</p>
                  )}
                  {(holdings.totalSipMonthly != null && holdings.totalSipMonthly > 0) && (
                    <p className="text-sm text-gray-500">Active SIPs (≈ monthly): ₹{holdings.totalSipMonthly.toLocaleString('en-IN')}</p>
                  )}
                </div>
                {holdings.bySymbol.length > 0 && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Equity holdings</p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {holdings.bySymbol.slice(0, 8).map((x) => (
                        <li key={x.symbol}>{x.symbol}: ₹{x.value.toLocaleString('en-IN')} (P&amp;L ₹{x.pnl.toLocaleString('en-IN')})</li>
                      ))}
                      {holdings.bySymbol.length > 8 && <li>… and {holdings.bySymbol.length - 8} more</li>}
                    </ul>
                  </div>
                )}
                {holdings.mfByFund && holdings.mfByFund.length > 0 && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mutual funds (Coin)</p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {holdings.mfByFund.slice(0, 8).map((x) => (
                        <li key={x.fund}>{x.fund}: ₹{x.value.toLocaleString('en-IN')} (P&amp;L ₹{x.pnl.toLocaleString('en-IN')})</li>
                      ))}
                      {holdings.mfByFund.length > 8 && <li>… and {holdings.mfByFund.length - 8} more</li>}
                    </ul>
                  </div>
                )}
                {holdings.sips && holdings.sips.length > 0 && (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Active SIPs</p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {holdings.sips.map((s) => (
                        <li key={s.fund + s.next_instalment}>{s.fund}: ₹{s.instalment_amount.toLocaleString('en-IN')} / {s.frequency}, next: {s.next_instalment}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {tokenExpired && !holdings && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio data is unavailable until you reconnect.</p>
            )}
            <p className="text-xs text-gray-500">Access token expires daily (~6 AM). Reconnect if holdings stop updating.</p>
          </div>
        ) : (
          <div>
            <a href="/api/zerodha/connect" className="inline-flex items-center rounded-lg bg-orange-600 text-white px-4 py-2 text-sm font-medium hover:bg-orange-700">
              Connect Zerodha
            </a>
            <p className="text-xs text-gray-500 mt-2">You will be redirected to Zerodha to sign in securely. We never see your password.</p>
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
