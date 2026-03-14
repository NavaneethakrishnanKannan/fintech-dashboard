import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'
import { fetchKiteHoldings, fetchKiteMfHoldings, fetchKiteMfSips, zerodhaSummaryFromHoldings, zerodhaSummaryFromMfHoldings } from '@/lib/zerodha'

const KITE_API_KEY = process.env.KITE_API_KEY

export const maxDuration = 60

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

const ADVICE_SYSTEM = `You are a personal finance advisor. Given the user's financial data below, output a JSON object and nothing else. No markdown, no code fence, no explanation before or after.
Required format exactly:
{"insights": ["observation 1", "observation 2", ...], "suggestions": ["tip 1", "tip 2", ...]}
- insights: 3-5 very brief observations (one short sentence each, e.g. "Savings rate 56%.", "EMI 26% of income.", "Zerodha portfolio ₹X."). No long sentences.
- suggestions: 3-5 short actionable tips (e.g. "Keep 6 months emergency fund.", "Increase SIP if possible.", "Review loan tenure."). You must always include both insights and suggestions.
When Zerodha portfolio data is provided in the data below, mention it in insights and tailor suggestions to equity/MF/SIPs. Use ₹ where relevant. Output only the single JSON object.`

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']

async function callGemini(prompt: string, signal: AbortSignal): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')
  let lastError: string | null = null
  for (const model of GEMINI_MODELS) {
    try {
      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal },
      )
      if (!res.ok) {
        lastError = await res.text()
        if (res.status === 404) continue
        throw new Error(lastError)
      }
      const json = await res.json()
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      const out = typeof text === 'string' ? text.trim() : ''
      if (out) return out
      const finishReason = json.candidates?.[0]?.finishReason
      if (finishReason) lastError = `finishReason: ${finishReason}`
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      if (lastError.includes('404') || lastError.includes('not found')) continue
      throw e
    }
  }
  return ''
}

async function callGroq(messages: { role: string; content: string }[], signal: AbortSignal): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, max_tokens: 2048 }),
    signal,
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  return typeof content === 'string' ? content.trim() : ''
}

function extractQuotedStrings(str: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < str.length) {
    const open = str.indexOf('"', i)
    if (open === -1) break
    let end = open + 1
    while (end < str.length) {
      const next = str.indexOf('"', end)
      if (next === -1) break
      let backslashes = 0
      let p = next - 1
      while (p >= 0 && str[p] === '\\') { backslashes++; p-- }
      if (backslashes % 2 === 0) {
        out.push(str.slice(open + 1, next).replace(/\\(.)/g, '$1'))
        end = next + 1
        break
      }
      end = next + 1
    }
    i = end
  }
  return out
}

function extractStringArraysFromTruncatedJson(text: string): { insights: string[]; suggestions: string[] } {
  const insights: string[] = []
  const suggestions: string[] = []
  const trimmed = text.trim()
  const insightsIdx = trimmed.search(/"insights"\s*:\s*\[/i)
  if (insightsIdx !== -1) {
    const start = trimmed.indexOf('[', insightsIdx) + 1
    const suggIdx = trimmed.search(/"suggestions"\s*:\s*\[/i)
    const end = suggIdx > start ? trimmed.indexOf('[', suggIdx) - 1 : trimmed.length
    const slice = trimmed.slice(start, end)
    insights.push(...extractQuotedStrings(slice))
  }
  const suggIdx = trimmed.search(/"suggestions"\s*:\s*\[/i)
  if (suggIdx !== -1) {
    const start = trimmed.indexOf('[', suggIdx) + 1
    const slice = trimmed.slice(start)
    suggestions.push(...extractQuotedStrings(slice))
  }
  return { insights, suggestions }
}

function parseStructuredResponse(text: string): { insights: string[]; suggestions: string[]; _raw?: string } {
  const result = { insights: [] as string[], suggestions: [] as string[] }
  if (!text || typeof text !== 'string') return result

  let parsed: { insights?: unknown; suggestions?: unknown } | null = null
  const trimmed = text.trim()

  const tryParse = (str: string) => {
    try {
      return JSON.parse(str) as { insights?: unknown; suggestions?: unknown }
    } catch {
      return null
    }
  }

  parsed = tryParse(trimmed)
  if (!parsed) {
    const withoutMarkdown = trimmed.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
    parsed = tryParse(withoutMarkdown)
  }
  if (!parsed) {
    const first = trimmed.indexOf('{')
    const last = trimmed.lastIndexOf('}')
    if (first !== -1 && last > first) parsed = tryParse(trimmed.slice(first, last + 1))
  }

  if (parsed) {
    const insightsArr = Array.isArray(parsed.insights) ? parsed.insights : Array.isArray((parsed as Record<string, unknown>).Insights) ? (parsed as Record<string, unknown>).Insights : []
    const suggestionsArr = Array.isArray(parsed.suggestions) ? parsed.suggestions : Array.isArray((parsed as Record<string, unknown>).Suggestions) ? (parsed as Record<string, unknown>).Suggestions : []
    result.insights = (insightsArr as unknown[]).filter((x): x is string => typeof x === 'string')
    result.suggestions = (suggestionsArr as unknown[]).filter((x): x is string => typeof x === 'string')
  }

  if (result.insights.length === 0 && result.suggestions.length === 0 && trimmed.includes('"insights"')) {
    const extracted = extractStringArraysFromTruncatedJson(trimmed)
    result.insights = extracted.insights
    result.suggestions = extracted.suggestions
  }
  return result
}

export async function POST() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [investments, expenses, incomes, loans, goals, zerodhaConn] = await Promise.all([
    prisma.investment.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.zerodhaConnection.findUnique({ where: { userId } }),
  ])

  let zerodhaLine = ''
  if (KITE_API_KEY && zerodhaConn) {
    try {
      const [equityRes, mfRes, sipsRes] = await Promise.all([
        fetchKiteHoldings(KITE_API_KEY, zerodhaConn.accessToken).catch(() => ({ data: [] })),
        fetchKiteMfHoldings(KITE_API_KEY, zerodhaConn.accessToken).catch(() => ({ data: [] })),
        fetchKiteMfSips(KITE_API_KEY, zerodhaConn.accessToken).catch(() => ({ data: [] })),
      ])
      const equitySummary = zerodhaSummaryFromHoldings(equityRes.data ?? [])
      const mfSummary = zerodhaSummaryFromMfHoldings(mfRes.data ?? [])
      const sips = Array.isArray(sipsRes.data) ? sipsRes.data.filter((s: { status?: string }) => s.status === 'ACTIVE') : []
      const totalVal = equitySummary.totalValue + mfSummary.totalValue
      const sipMonthly = sips.reduce((sum: number, s: { instalment_amount?: number; frequency?: string }) => {
        const amt = s.instalment_amount || 0
        if (s.frequency === 'monthly') return sum + amt
        if (s.frequency === 'weekly') return sum + amt * 4.33
        if (s.frequency === 'quarterly') return sum + amt / 3
        return sum
      }, 0)
      const parts = [`Zerodha portfolio: ₹${Math.round(totalVal).toLocaleString('en-IN')}`]
      if (equitySummary.bySymbol.length) parts.push(`Equity: ${equitySummary.bySymbol.map((x) => `${x.symbol} ₹${Math.round(x.value).toLocaleString('en-IN')}`).join(', ')}`)
      if (mfSummary.byFund.length) parts.push(`MF: ${mfSummary.byFund.map((x) => `${x.fund} ₹${Math.round(x.value).toLocaleString('en-IN')}`).join('; ')}`)
      if (sips.length) parts.push(`SIPs: ${sips.map((s: { fund: string; instalment_amount: number; frequency: string }) => `${s.fund} ₹${s.instalment_amount}/${s.frequency}`).join('; ')}`)
      if (sipMonthly > 0) parts.push(`SIP ≈ ₹${Math.round(sipMonthly).toLocaleString('en-IN')}/month`)
      zerodhaLine = parts.join('. ')
    } catch {
      zerodhaLine = 'Zerodha: linked but data unavailable (token may have expired).'
    }
  }

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalEmi = loans.reduce((s, l) => s + Number(l.emi), 0)
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses - totalEmi) / totalIncome) * 100 : 0
  const totalInvested = investments.reduce((s, inv) => s + inv.quantity * inv.buyPrice, 0)
  const totalCurrent = investments.reduce((s, inv) => {
    const v = inv.currentPrice != null ? inv.quantity * inv.currentPrice : inv.buyPrice + inv.profit
    return s + v
  }, 0)
  const emiToIncome = totalIncome > 0 ? (totalEmi / totalIncome) * 100 : 0

  const context = [
    `Income: ₹${Math.round(totalIncome).toLocaleString('en-IN')}`,
    `Expenses: ₹${Math.round(totalExpenses).toLocaleString('en-IN')}`,
    `Loan EMIs: ₹${Math.round(totalEmi).toLocaleString('en-IN')} (${emiToIncome.toFixed(0)}% of income)`,
    `Savings rate: ${savingsRate.toFixed(1)}%`,
    `Manual investments: ${investments.length} holdings, invested ₹${Math.round(totalInvested).toLocaleString('en-IN')}, current ₹${Math.round(totalCurrent).toLocaleString('en-IN')}`,
    zerodhaLine ? (zerodhaLine.startsWith('Zerodha: linked') ? zerodhaLine : `Zerodha (use in advice): ${zerodhaLine}`) : null,
    `Loans: ${loans.length}, ${loans.map((l) => `${l.name} EMI ₹${l.emi}`).join('; ')}`,
    `Goals: ${goals.length}, ${goals.map((g) => `${g.title} ₹${g.targetAmount}`).join('; ')}`,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = `${ADVICE_SYSTEM}\n\nUser financial data:\n${context}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000)
  const signal = controller.signal

  const groqMessages = [
      { role: 'system' as const, content: ADVICE_SYSTEM },
      { role: 'user' as const, content: `User financial data:\n${context}` },
    ]
  try {
    let raw: string = ''
    if (GEMINI_API_KEY) {
      try {
        raw = await callGemini(prompt, signal)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')
        if (is429 && GROQ_API_KEY) {
          try {
            raw = await callGroq(groqMessages, signal)
          } catch (groqErr) {
            console.warn('[ai/advice] Groq fallback failed:', groqErr instanceof Error ? groqErr.message : groqErr)
            throw e
          }
        } else {
          throw e
        }
      }
    }
    if ((!raw || !raw.trim()) && GROQ_API_KEY) {
      try {
        raw = await callGroq(groqMessages, signal)
      } catch (e) {
        if (!GEMINI_API_KEY) throw e
        console.warn('[ai/advice] Groq fallback failed:', e instanceof Error ? e.message : e)
      }
    }
    if (!GEMINI_API_KEY && !GROQ_API_KEY) {
      return NextResponse.json({ error: 'No AI provider configured' }, { status: 500 })
    }
    clearTimeout(timeoutId)
    const structured = parseStructuredResponse(raw)
    const isEmpty = structured.insights.length === 0 && structured.suggestions.length === 0
    if (isEmpty) {
      if (raw) console.warn('[ai/advice] Parsed empty. Raw length:', raw.length, 'preview:', raw.slice(0, 300))
      else console.warn('[ai/advice] No text from AI (empty or blocked). Check GEMINI_API_KEY and model availability.')
    }
    if (isEmpty && context.trim().length > 10) {
      structured.insights = ['Your financial snapshot was received but the AI could not generate structured advice this time.']
      structured.suggestions = ['Try "Get AI advice" again in a moment, or use the Chat above to ask specific questions.']
    }
    if (structured.insights.length > 0 && structured.suggestions.length === 0) {
      structured.suggestions = ['Review allocation across equity and debt.', 'Keep 6 months expenses as emergency fund.', 'Revisit goals and SIP amounts periodically.']
    }
    return NextResponse.json({
      insights: structured.insights,
      suggestions: structured.suggestions,
      ...(isEmpty && !structured.insights.length && {
        _emptyReason: raw
          ? 'AI response could not be parsed as insights/suggestions. Try again.'
          : 'AI returned no text (possible safety filter or no API key). Check server logs and .env.',
      }),
    })
  } catch (err) {
    clearTimeout(timeoutId)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'AI advice failed', details: message }, { status: 500 })
  }
}
