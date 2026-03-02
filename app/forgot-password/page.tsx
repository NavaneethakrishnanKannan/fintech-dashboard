'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        return
      }
      setSent(true)
      if (data.resetUrl) {
        setError(`Dev: use this link to reset: ${data.resetUrl}`)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
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
        <h1 style={{ margin: '0 0 8px', fontSize: 24 }}>Forgot password</h1>
        <p style={{ margin: '0 0 24px', color: '#666', fontSize: 14 }}>
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
        {sent ? (
          <p style={{ color: '#0b8457', margin: 0 }}>
            If an account exists for that email, you will receive a reset link. Check your inbox (and spam).
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#555' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: 10,
                  border: '1px solid #ddd',
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
            {error && (
              <p style={{ margin: 0, color: '#c92a2a', fontSize: 13 }}>{error}</p>
            )}
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
              {loading ? 'Sending…' : 'Send reset link'}
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
