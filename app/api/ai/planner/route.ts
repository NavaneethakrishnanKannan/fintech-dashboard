import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'
import { prisma } from '@/lib/prisma'
import { fetchKiteHoldings, fetchKiteMfHoldings, fetchKiteMfSips, zerodhaSummaryFromHoldings, zerodhaSummaryFromMfHoldings } from '@/lib/zerodha'

const KITE_API_KEY = process.env.KITE_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

export const maxDuration = 60

const PLANNER_SYSTEM = `You are a personal finance planner. Given the user's financial data below, suggest a monthly budget and fund allocation. Use Indian Rupee. Be specific.

Respond in two parts:

PART 1 - Short narrative (plain text, under 200 words): Briefly state the suggested total expenses, how much they can save per month, and the main allocation priorities. Use clear line breaks. No markdown.

PART 2 - A single JSON object on its own line at the very end of your response. No other text after it. Use this exact structure (numbers for amounts, not strings). In JSON use ONLY digits for numbers (no commas): e.g. 78810 not 78,810.
{"suggestedExpensesTotal":number,"monthlySavings":number,"budgetBreakdown":[{"category":"string","amount":number,"note":"string"}],"allocations":[{"purpose":"string","amount":number,"note":"string"}],"summary":"string"}

Rules for the JSON:
- CRITICAL: Available for expenses = income minus EMI. The user can only spend this much on non-EMI categories. The SUM of all budgetBreakdown amounts MUST NOT exceed (income − EMI). If income − EMI is small, suggest category amounts that fit within this ceiling; do not suggest more than they have.
- suggestedExpensesTotal: total suggested monthly expenses (excluding EMI). MUST be ≤ (income − EMI). Should be a target you recommend within what they can afford.
- monthlySavings: how much they can save per month = income minus suggestedExpensesTotal minus EMI. Must be ≥ 0.
- budgetBreakdown: You MUST include EVERY category that appears in the user's "By category" data—do not omit any (e.g. include Travel, Transport, Education, etc. if present). Use the exact same category names so the table can compare. Do NOT include EMI in budgetBreakdown (EMI is added separately). The SUM of budgetBreakdown MUST NOT exceed (income − EMI). FIXED: Do NOT suggest reducing Rent or Utilities—keep amount equal to user's current (note: "keep" or "fixed"). DISCRETIONARY: Suggest reducing Shopping, Entertainment, Transport, Travel where high. For Travel: suggest an amount (same or reduced) and a note (e.g. "reduce if possible" or "cap for trips"). OTHER: "Other" is a catch-all; suggest reducing and note "reduce if possible; often discretionary". For Food and Health, small adjustment only if needed to fit ceiling. Every category in the user's list must have one budgetBreakdown entry with amount and note.
- allocations: Split monthly savings across goals. SUM of allocation amounts MUST equal monthlySavings (or less). Prioritise Emergency fund and stated goals.
- summary: one sentence takeaway.`

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']

async function callGemini(prompt: string, signal: AbortSignal): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0, seed: 42 },
          }),
          signal,
        },
      )
      if (!res.ok) {
        const text = await res.text()
        if (res.status === 429 || text.includes('RESOURCE_EXHAUSTED') || text.includes('quota')) throw new Error(text)
        if (res.status === 404) continue
        throw new Error(text)
      }
      const json = await res.json()
      const candidate = json.candidates?.[0]
      const text = candidate?.content?.parts?.[0]?.text
      if (typeof text === 'string' && text.trim()) return text.trim()
      // Blocked, empty, or safety filter - try next model
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if ((msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) && GROQ_API_KEY) throw e
      if (msg.includes('404') || msg.includes('not found')) continue
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
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, max_tokens: 4096, temperature: 0 }),
    signal,
  })
  if (!res.ok) throw new Error(await res.text())
  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  return typeof content === 'string' ? content.trim() : ''
}

type StructuredPlan = {
  suggestedExpensesTotal: number
  monthlySavings: number
  budgetBreakdown: { category: string; amount: number; note?: string }[]
  allocations: { purpose: string; amount: number; note?: string }[]
  summary: string
}

function extractStructured(raw: string): { plan: string; structured: StructuredPlan | null } {
  const trimmed = raw.trim()
  let jsonStr = ''
  // Allow "PART 2 { "suggestedExpensesTotal"..." or "{\"suggestedExpensesTotal\"..."
  const keyIndex = trimmed.indexOf('"suggestedExpensesTotal"')
  const jsonStart = keyIndex >= 0 ? trimmed.slice(0, keyIndex).lastIndexOf('{') : -1
  if (keyIndex !== -1 && jsonStart >= 0) {
    let depth = 0
    let end = jsonStart
    for (let i = jsonStart; i < trimmed.length; i++) {
      if (trimmed[i] === '{') depth++
      else if (trimmed[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
    }
    jsonStr = trimmed.slice(jsonStart, end)
  }
  const planOnly = jsonStart > 0 ? trimmed.slice(0, jsonStart).trim() : trimmed
  if (!jsonStr) return { plan: planOnly, structured: null }
  // Remove commas inside numbers so "78,810" becomes 78810 (valid JSON)
  const noCommaNumbers = jsonStr.replace(/:(\s*)([\d,]+)(\s*[,}\]])/g, (_, s1, num, s2) => `:${s1}${num.replace(/,/g, '')}${s2}`)
  let repaired = noCommaNumbers
    .replace(/\],\s*\{\s*"purpose"/g, '], "allocations": [{"purpose"')
    .replace(/\}\s*,\s*"\s*\{\s*"category"/g, '"},{"category"') // fix "}, "{"category" typo in budgetBreakdown
  try {
    let structured = JSON.parse(repaired) as StructuredPlan
    if (typeof structured.suggestedExpensesTotal !== 'number' || typeof structured.monthlySavings !== 'number') {
      // JSON shape is wrong; still hide the JSON from the user and just return the narrative
      return { plan: planOnly, structured: null }
    }
    if (!Array.isArray(structured.budgetBreakdown)) structured.budgetBreakdown = []
    if (!Array.isArray(structured.allocations)) {
      const allocMatch = jsonStr.match(/\{"purpose"\s*:\s*"[^"]*"\s*,\s*"amount"\s*:\s*\d+/g)
      structured.allocations = allocMatch ? allocMatch.map((s) => {
        const purpose = s.match(/"purpose"\s*:\s*"([^"]*)"/)?.[1] ?? ''
        const amount = Number(s.match(/"amount"\s*:\s*(\d+)/)?.[1] ?? 0)
        return { purpose, amount }
      }) : []
    }
    return { plan: planOnly || trimmed, structured }
  } catch {
    try {
      const structured = JSON.parse(noCommaNumbers) as StructuredPlan
      if (typeof structured.suggestedExpensesTotal === 'number' && typeof structured.monthlySavings === 'number') {
        if (!Array.isArray(structured.budgetBreakdown)) structured.budgetBreakdown = []
        if (!Array.isArray(structured.allocations)) structured.allocations = []
        return { plan: planOnly, structured }
      }
    } catch {
      // ignore
    }
    // Parsing failed completely; never show raw JSON to the user, just the narrative part
    return { plan: planOnly, structured: null }
  }
}

export async function POST() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { checkRateLimit } = await import('@/lib/rateLimit')
  const { ok } = checkRateLimit(userId)
  if (!ok) return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 })

  const [investments, expenses, incomes, loans, goals, zerodhaConn] = await Promise.all([
    prisma.investment.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.zerodhaConnection.findUnique({ where: { userId } }),
  ])

  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalEmi = loans.reduce((s, l) => s + Number(l.emi), 0)
  const byCategory: Record<string, number> = {}
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount)
  }
  const totalMonthlySip = investments.reduce((s, inv) => s + (Number(inv.monthlySip) || 0), 0)
  const monthlySavings = totalIncome - totalExpenses - totalEmi

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
      zerodhaLine = `Zerodha: portfolio ₹${Math.round(totalVal).toLocaleString('en-IN')}; SIPs ≈ ₹${Math.round(sipMonthly).toLocaleString('en-IN')}/month. `
    } catch {
      zerodhaLine = 'Zerodha linked but data unavailable. '
    }
  }

  const availableForExpenses = Math.max(0, totalIncome - totalEmi)
  const context = [
    `Income: ₹${Math.round(totalIncome).toLocaleString('en-IN')}`,
    `Loan EMIs: ₹${Math.round(totalEmi).toLocaleString('en-IN')} (${loans.map((l) => `${l.name} ₹${l.emi}`).join('; ')})`,
    `Available for monthly expenses (income − EMI only): ₹${Math.round(availableForExpenses).toLocaleString('en-IN')}. Your suggestedExpensesTotal and the SUM of budgetBreakdown must NOT exceed this.`,
    `Current expenses (total): ₹${Math.round(totalExpenses).toLocaleString('en-IN')}`,
    `By category: ${Object.entries(byCategory).map(([c, a]) => `${c} ₹${Math.round(a).toLocaleString('en-IN')}`).join(', ') || 'None'}`,
    `Current monthly savings (income − expenses − EMI): ₹${Math.round(monthlySavings).toLocaleString('en-IN')}`,
    `Existing SIP (from investments): ₹${Math.round(totalMonthlySip).toLocaleString('en-IN')}/month`,
    zerodhaLine,
    `Goals: ${goals.length ? goals.map((g) => `${g.title} target ₹${Math.round(Number(g.targetAmount)).toLocaleString('en-IN')}`).join('; ') : 'None'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = `${PLANNER_SYSTEM}\n\nUser financial data:\n${context}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 45000)
  const signal = controller.signal

  const groqMessages = [
    { role: 'system' as const, content: PLANNER_SYSTEM },
    { role: 'user' as const, content: `User financial data:\n${context}` },
  ]

  try {
    let raw = ''
    if (GEMINI_API_KEY) {
      try {
        raw = await callGemini(prompt, signal)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if ((msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) && GROQ_API_KEY) {
          raw = await callGroq(groqMessages, signal)
        } else {
          throw e
        }
      }
    }
    if ((!raw || !raw.trim()) && GROQ_API_KEY) raw = await callGroq(groqMessages, signal)

    clearTimeout(timeoutId)

    if (!GEMINI_API_KEY && !GROQ_API_KEY) {
      return NextResponse.json({ error: 'No AI provider configured' }, { status: 500 })
    }

    const expensesByCategory = Object.entries(byCategory).map(([category, amount]) => ({ category, amount: Math.round(amount) }))

    if (!raw || !raw.trim()) {
      return NextResponse.json({
        plan: 'Unable to generate a planner right now. Check your income, expenses, and goals are added, then try again.',
        current: {
          totalExpenses: Math.round(totalExpenses),
          totalEmi: Math.round(totalEmi),
          monthlySavings: Math.round(monthlySavings),
          income: Math.round(totalIncome),
          totalMonthlySip: Math.round(totalMonthlySip),
          expensesByCategory,
        },
      })
    }

    const { plan: planText, structured } = extractStructured(raw)
    const FIXED_CATEGORIES = ['rent', 'utilities']
    let clampedStructured = structured
    if (structured && availableForExpenses >= 0) {
      let breakdown = structured.budgetBreakdown.map((r) => ({ ...r }))
      const byCategoryLower: Record<string, number> = {}
      for (const [k, v] of Object.entries(byCategory)) {
        byCategoryLower[k.trim().toLowerCase()] = v
      }
      for (const row of breakdown) {
        const catLower = row.category.trim().toLowerCase()
        if (FIXED_CATEGORIES.includes(catLower) && byCategoryLower[catLower] != null) {
          row.amount = Math.round(Number(byCategoryLower[catLower]))
          row.note = row.note ? row.note.replace(/reduce|cap.*/i, 'keep (fixed)') : 'keep (fixed)'
        }
      }
      let breakdownSum = breakdown.reduce((s, r) => s + r.amount, 0)
      if (breakdownSum > availableForExpenses && breakdownSum > 0) {
        const fixedTotal = breakdown
          .filter((r) => FIXED_CATEGORIES.includes(r.category.trim().toLowerCase()))
          .reduce((s, r) => s + r.amount, 0)
        const discretionaryTotal = breakdownSum - fixedTotal
        const headroom = Math.max(0, availableForExpenses - fixedTotal)
        if (discretionaryTotal > 0 && headroom >= 0) {
          const scale = headroom / discretionaryTotal
          breakdown = breakdown.map((r) => {
            const isFixed = FIXED_CATEGORIES.includes(r.category.trim().toLowerCase())
            return { ...r, amount: isFixed ? r.amount : Math.round(r.amount * scale) }
          })
        } else {
          const scale = availableForExpenses / breakdownSum
          breakdown = breakdown.map((r) => ({ ...r, amount: Math.round(r.amount * scale) }))
        }
        breakdownSum = breakdown.reduce((s, r) => s + r.amount, 0)
        clampedStructured = {
          ...structured,
          budgetBreakdown: breakdown,
          suggestedExpensesTotal: Math.round(breakdownSum),
          monthlySavings: Math.max(0, Math.round(totalIncome - breakdownSum - totalEmi)),
        }
      } else if (structured.suggestedExpensesTotal > availableForExpenses) {
        clampedStructured = {
          ...structured,
          budgetBreakdown: breakdown,
          suggestedExpensesTotal: Math.round(Math.min(breakdownSum, availableForExpenses)),
          monthlySavings: Math.max(0, Math.round(totalIncome - availableForExpenses - totalEmi)),
        }
      } else {
        clampedStructured = { ...structured, budgetBreakdown: breakdown }
      }
    }
    return NextResponse.json({
      plan: planText,
      structured: clampedStructured ?? undefined,
      current: {
        totalExpenses: Math.round(totalExpenses),
        totalEmi: Math.round(totalEmi),
        monthlySavings: Math.round(monthlySavings),
        income: Math.round(totalIncome),
        totalMonthlySip: Math.round(totalMonthlySip),
        expensesByCategory,
      },
    })
  } catch (err) {
    clearTimeout(timeoutId)
    const expensesByCategoryFallback = Object.entries(byCategory).map(([category, amount]) => ({ category, amount: Math.round(amount) }))
    return NextResponse.json({
      plan: 'The planner could not be generated right now. Please try again in a moment.',
      structured: undefined,
      current: {
        totalExpenses: Math.round(totalExpenses),
        totalEmi: Math.round(totalEmi),
        monthlySavings: Math.round(monthlySavings),
        income: Math.round(totalIncome),
        totalMonthlySip: Math.round(totalMonthlySip),
        expensesByCategory: expensesByCategoryFallback,
      },
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
