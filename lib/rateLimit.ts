/**
 * Simple in-memory rate limiter for AI routes.
 * For multi-instance deployments consider Redis/Vercel KV.
 */

const windowMs = 60 * 1000
const maxPerWindow = 15
const store = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(userId: string): { ok: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(userId)
  if (!entry) {
    store.set(userId, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: maxPerWindow - 1 }
  }
  if (now > entry.resetAt) {
    entry.count = 1
    entry.resetAt = now + windowMs
    return { ok: true, remaining: maxPerWindow - 1 }
  }
  entry.count++
  const remaining = Math.max(0, maxPerWindow - entry.count)
  return { ok: entry.count <= maxPerWindow, remaining }
}
