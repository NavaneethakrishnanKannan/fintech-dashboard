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
  const redirectTo = callbackUrl.startsWith('/') ? callbackUrl : '/dashboard'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl: redirectTo,
      })
      if (res?.error) {
        setError('Invalid email or password.')
        setLoading(false)
        return
      }
      window.location.href = redirectTo
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 px-8 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Sign in</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Use your email and password to access your dashboard.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full inline-flex justify-center items-center rounded-lg bg-blue-600 text-white text-sm font-semibold py-2.5 mt-1 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span>or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>
          <button
            type="button"
            disabled={loading || googleLoading}
            onClick={() => {
              setError('')
              setGoogleLoading(true)
              signIn('google', { callbackUrl: redirectTo, redirect: true })
            }}
            className="w-full inline-flex justify-center items-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold py-2.5 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-gray-600 dark:text-gray-400">
          <Link href="/forgot-password" className="hover:underline mr-2">
            Forgot password?
          </Link>
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-600 dark:text-blue-400 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-800 px-8 py-8">
            <p className="text-sm text-gray-600 dark:text-gray-300">Loading…</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
