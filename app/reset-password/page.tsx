'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    setToken(searchParams.get('token') ?? '')
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!token) {
      setError('Invalid reset link.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      setDone(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token && typeof window !== 'undefined') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 24 }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 12, maxWidth: 400 }}>
          <p style={{ margin: 0, color: '#666' }}>Missing or invalid reset link. Use the link from your email.</p>
          <Link href="/forgot-password" style={{ display: 'inline-block', marginTop: 16, color: '#0070f3' }}>Request a new link</Link>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        padding: 24,
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: 32,
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          width: '100%',
          maxWidth: 400,
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 24 }}>Set new password</h1>
        <p style={{ margin: '0 0 24px', color: '#666', fontSize: 14 }}>
          Enter your new password below.
        </p>
        {done ? (
          <p style={{ color: '#0b8457', margin: 0 }}>Password updated. Redirecting to sign in…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#555' }}>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#555' }}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                style={{ width: '100%', padding: 10, border: '1px solid #ddd', borderRadius: 6, fontSize: 14 }}
              />
            </div>
            {error && <p style={{ margin: 0, color: '#c92a2a', fontSize: 13 }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: 12,
                background: loading ? '#ccc' : '#0070f3',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
        <p style={{ marginTop: 20, fontSize: 13, color: '#666', textAlign: 'center' }}>
          <Link href="/login" style={{ color: '#0070f3' }}>Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
            padding: 24,
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 32,
              borderRadius: 12,
              maxWidth: 400,
            }}
          >
            <p style={{ margin: 0, color: '#666' }}>Loading…</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
