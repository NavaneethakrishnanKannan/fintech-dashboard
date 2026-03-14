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

PART 2 - A single JSON object on its own line at the very end of your response. No other text after it. Use this exact structure (numbers for amounts, not strings):
{"suggestedExpensesTotal":number,"monthlySavings":number,"budgetBreakdown":[{"category":"string","amount":number,"note":"string"}],"allocations":[{"purpose":"string","amount":number,"note":"string"}],"summary":"string"}

Rules for the JSON:
- suggestedExpensesTotal: total suggested monthly expenses (excluding EMI). Should be a target you recommend, not just their current total.
- monthlySavings: how much they can save per month if they follow the budget (income minus suggestedExpensesTotal minus EMI).
- budgetBreakdown: Use the SAME category names as in the user's "By category" data so the table can compare. Do NOT include EMI in budgetBreakdown (EMI is added separately). Recommend REDUCTIONS where spending is high or discretionary (e.g. Shopping, Other), but do NOT reduce any category to zero—keep realistic amounts (e.g. if they spend on Travel, suggest a lower Travel amount, not ₹0). Keep or slightly adjust essentials (Rent, Food, Health). Short note per category (e.g. "reduce by 20%", "cap 5% of income").
- allocations: This is how the user should SPLIT their monthly savings across goals. Suggested monthly savings = income minus suggestedExpensesTotal minus EMI. The SUM of all allocation amounts MUST equal this number (or less). E.g. if they save ₹18,800/month, suggest allocations that add up to 18800 (e.g. Emergency 8000, Car 5000, Other 3800, Misc 2000). Each amount = rupees to set aside per month for that purpose. Do not suggest totals that exceed their monthly savings. Prioritise Emergency fund and their stated goals (e.g. car), then other/misc.
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
            generationConfig: { maxOutputTokens: 2048, temperature: 0, seed: 42 },
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
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (typeof text === 'string' && text.trim()) return text.trim()
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
    body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, max_tokens: 2048, temperature: 0 }),
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
  if (!jsonStr) return { plan: trimmed, structured: null }
  let repaired = jsonStr
    .replace(/\],\s*\{\s*"purpose"/g, '], "allocations": [{"purpose"')
    .replace(/\}\s*,\s*"\s*\{\s*"category"/g, '"},{"category"') // fix "}, "{"category" typo in budgetBreakdown
  try {
    let structured = JSON.parse(repaired) as StructuredPlan
    const plan = jsonStart > 0 ? trimmed.slice(0, jsonStart).trim() : trimmed
    if (typeof structured.suggestedExpensesTotal !== 'number' || typeof structured.monthlySavings !== 'number') return { plan: trimmed, structured: null }
    if (!Array.isArray(structured.budgetBreakdown)) structured.budgetBreakdown = []
    if (!Array.isArray(structured.allocations)) {
      const allocMatch = jsonStr.match(/\{"purpose"\s*:\s*"[^"]*"\s*,\s*"amount"\s*:\s*\d+/g)
      structured.allocations = allocMatch ? allocMatch.map((s) => {
        const purpose = s.match(/"purpose"\s*:\s*"([^"]*)"/)?.[1] ?? ''
        const amount = Number(s.match(/"amount"\s*:\s*(\d+)/)?.[1] ?? 0)
        return { purpose, amount }
      }) : []
    }
    return { plan: plan || trimmed, structured }
  } catch {
    try {
      const structured = JSON.parse(jsonStr) as StructuredPlan
      if (typeof structured.suggestedExpensesTotal === 'number' && typeof structured.monthlySavings === 'number') {
        if (!Array.isArray(structured.budgetBreakdown)) structured.budgetBreakdown = []
        if (!Array.isArray(structured.allocations)) structured.allocations = []
        return { plan: trimmed.slice(0, jsonStart).trim(), structured }
      }
    } catch {
      // ignore
    }
    return { plan: trimmed, structured: null }
  }
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

  const context = [
    `Income: ₹${Math.round(totalIncome).toLocaleString('en-IN')}`,
    `Current expenses (total): ₹${Math.round(totalExpenses).toLocaleString('en-IN')}`,
    `By category: ${Object.entries(byCategory).map(([c, a]) => `${c} ₹${Math.round(a).toLocaleString('en-IN')}`).join(', ') || 'None'}`,
    `Loan EMIs: ₹${Math.round(totalEmi).toLocaleString('en-IN')} (${loans.map((l) => `${l.name} ₹${l.emi}`).join('; ')})`,
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
    return NextResponse.json({
      plan: planText,
      structured: structured ?? undefined,
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
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: 'Planner failed', details: message }, { status: 500 })
  }
}
