'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })
      if (res?.error) {
        setError('Invalid email or password.')
        setLoading(false)
        return
      }
      // Full page redirect so the session cookie is sent on the next request (avoids
      // middleware not seeing the cookie when using router.push on Vercel/production).
      window.location.href = callbackUrl
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
        <h1 style={{ margin: '0 0 8px', fontSize: 24 }}>Sign in</h1>
        <p style={{ margin: '0 0 24px', color: '#666', fontSize: 14 }}>
          Use your email and password to access your dashboard.
        </p>
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
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4, color: '#555' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
            disabled={loading || googleLoading}
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#ddd' }} />
            <span style={{ fontSize: 12, color: '#666' }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#ddd' }} />
          </div>
          <button
            type="button"
            disabled={loading || googleLoading}
            onClick={() => {
              setError('')
              setGoogleLoading(true)
              signIn('google', { callbackUrl, redirect: true })
            }}
            style={{
              padding: 12,
              background: googleLoading ? '#ccc' : '#fff',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: googleLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
          </button>
        </form>
        <p style={{ marginTop: 20, fontSize: 13, color: '#666', textAlign: 'center' }}>
          <Link href="/forgot-password" style={{ color: '#666', marginRight: 8 }}>Forgot password?</Link>
          Don&apos;t have an account? <Link href="/signup" style={{ color: '#0070f3' }}>Sign up</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
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
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              width: '100%',
              maxWidth: 400,
            }}
          >
            <p style={{ margin: 0, color: '#666' }}>Loading…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
