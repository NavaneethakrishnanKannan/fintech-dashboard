import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY

const PARSE_SYSTEM = `You are a command parser for a finance app. The user can either ask a question (chat), ADD an entry, or REMOVE/DELETE an expense.

Allowed ADD intents and their fields (use exactly these keys):
- add_expense: category (one of: Food, Rent, EMI, Travel, Shopping, Other), amount (number). Optional: description.
- add_income: category (one of: Salary, Bonus, Other), amount (number).
- add_investment: name (string), buyPrice or investedAmount (number). Optional: type (STOCK|MUTUAL_FUND|CHIT_FUND|OTHER), symbol, profit, monthlySip.
- add_loan: name (string), principal (number), emi (number). Optional: interest (number), tenure (months), totalTenureMonths.
- add_goal: title (string), targetAmount (number). Optional: currentAmount, targetDate (YYYY-MM-DD).

REMOVE/DELETE intent (deletes one expense entry that exactly matches category and amount):
- remove_expense: category, amount. Use when user clearly wants to DELETE one expense entry (e.g. "delete my 2000 food expense", "remove the 2k food entry").

SUBTRACT intent (reduces existing expense by amount in the database - the app will actually update the DB when user confirms):
- subtract_expense: category (one of: Food, Rent, EMI, Travel, Shopping, Other), amount (number). Required: both.
- Use subtract_expense whenever the user wants to REDUCE or SUBTRACT an amount from a category, regardless of extra words. Examples that MUST be subtract_expense:
  "subtract 2K food expense", "subtract 2k from food", "remove 2K from food expense", "reduce food by 2000",
  "try to get the latest value from the data and subtract 2K food expense", "get latest data and subtract 2k from food",
  "based on the data subtract 2000 from food", "take 2k off food", "deduct 2k from food expense",
  "get the latest value from the foot expense and remove 2K" (foot = Food typo), "from the food expense and remove 2k".
- Do NOT return "chat" for these. Returning "chat" only shows text and does NOT update the database. Only subtract_expense triggers the real DB update.

Amount rules: "2k" or "2000" or "2 thousand" = 2000. "5 lakh" or "5l" = 500000. "10k" = 10000. Always output numbers, not strings.
Category: use exact allowed values. If user says "food" or "foot" (typo) use "Food"; "salary" use "Salary".

Respond with ONLY a single JSON object, no markdown or extra text. Use this exact shape:
- If the user wants to ADD something: {"intent":"add_expense"|"add_income"|"add_investment"|"add_loan"|"add_goal","fields":{...},"missing":["field1"] or [],"reply":"Short confirmation message e.g. I'll add Food expense ₹2,000. Confirm?"}
- If the user wants to REMOVE (delete) an expense entry: {"intent":"remove_expense","fields":{"category":"Food","amount":2000},"missing":[],"reply":"I'll delete Food expense of ₹2,000. Confirm?"}
- If the user wants to SUBTRACT (reduce category by amount): {"intent":"subtract_expense","fields":{"category":"Food","amount":2000},"missing":[] or ["category"] or ["amount"],"reply":"I'll reduce Food expense by ₹2,000. Confirm?"}
- If the user is just asking or chatting: {"intent":"chat","reply":""}

List in "missing" any required field that was not mentioned. For remove_expense and subtract_expense both category and amount are required.
Critical: Any message that asks to subtract/reduce/deduct/remove an amount from a category (e.g. food) MUST get intent subtract_expense so the app can update the database. Do not return "chat" for "subtract X from food" or "get latest and subtract 2k food expense" - return subtract_expense with category "Food" and amount in numbers.
"reply" should be one short sentence. For add/remove/subtract intents, end with "Confirm?" or similar.`

function extractJson(text: string): object | null {
  const trimmed = text.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}') + 1
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end)) as object
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasGemini = !!GEMINI_API_KEY
  const hasGroq = !!GROQ_API_KEY
  if (!hasGemini && !hasGroq) {
    return NextResponse.json(
      { error: 'No AI provider configured.' },
      { status: 500 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const message = String(body.message ?? '').trim()
  if (!message) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 })
  }

  const prompt = `${PARSE_SYSTEM}\n\nUser message: ${message}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15_000)

  try {
    let rawAnswer: string
    if (hasGemini) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
          }),
          signal: controller.signal,
        },
      )
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      rawAnswer = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    } else {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: PARSE_SYSTEM },
            { role: 'user', content: `User message: ${message}` },
          ],
          max_tokens: 512,
          temperature: 0.1,
        }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      rawAnswer = json.choices?.[0]?.message?.content ?? '{}'
    }
    clearTimeout(timeoutId)
    const parsed = extractJson(rawAnswer)
    if (!parsed || typeof (parsed as any).intent !== 'string') {
      return NextResponse.json({
        intent: 'chat',
        reply: (parsed as any)?.reply ?? 'I didn’t understand. You can ask a question or say e.g. "Add ₹2,000 in Food expense".',
      })
    }
    const out = parsed as { intent: string; fields?: Record<string, unknown>; missing?: string[]; reply?: string }
    return NextResponse.json({
      intent: out.intent,
      fields: out.fields ?? {},
      missing: Array.isArray(out.missing) ? out.missing : [],
      reply: typeof out.reply === 'string' ? out.reply : '',
    })
  } catch (err) {
    clearTimeout(timeoutId)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { intent: 'chat', reply: '', error: message },
      { status: 500 },
    )
  }
}
