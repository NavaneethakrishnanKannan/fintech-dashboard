import { NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/getSession'

/** Allow long-running AI responses (e.g. SIP projection calculations). */
export const maxDuration = 60

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GROQ_API_KEY = process.env.GROQ_API_KEY
const MAX_HISTORY_TURNS = 10
const MAX_CONTEXT_CHARS = 12_000

const SYSTEM_PROMPT =
  'You are a respectful personal finance assistant. Reply in clear, natural English. Do not use greetings like "Namaste" or emojis. Give practical, conservative suggestions about investments, expenses, and loans. Never promise returns; talk in probabilities and risk. When explaining something, use short paragraphs or simple sentences, not markdown formatting or numbered/bold lists. When the user asks for thoughts, suggestions, or advice based on their data, use the financial context provided below to give specific, personalized points (e.g. which loan to prioritise, where to cut expenses, how their portfolio looks).'

function truncateContext(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) return text
  return text.slice(0, MAX_CONTEXT_CHARS) + '… [truncated]'
}

function buildFullPrompt(body: {
  contextSummary: string
  history: { role: string; content: string }[]
  message: string
}): string {
  const contextSummary = body.contextSummary
    ? truncateContext(String(body.contextSummary))
    : ''
  const history = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY_TURNS * 2)
    : []
  let text = SYSTEM_PROMPT
  if (contextSummary) {
    text += `\n\nUser financial context (use this when they ask for advice or suggestions): ${contextSummary}`
  }
  for (const m of history) {
    text += `\n\n${m.role === 'assistant' ? 'Assistant' : 'User'}: ${(m.content ?? '').slice(0, 4000)}`
  }
  text += `\n\nUser: ${body.message ?? ''}`
  return text
}

/** Build OpenAI-style messages for Groq. */
function buildGroqMessages(body: {
  contextSummary: string
  history: { role: string; content: string }[]
  message: string
}): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const contextSummary = body.contextSummary
    ? truncateContext(String(body.contextSummary))
    : ''
  const history = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY_TURNS * 2)
    : []
  const systemContent = contextSummary
    ? `${SYSTEM_PROMPT}\n\nUser financial context (use when they ask for advice): ${contextSummary}`
    : SYSTEM_PROMPT
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemContent },
  ]
  for (const m of history) {
    messages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: (m.content ?? '').slice(0, 4000),
    })
  }
  messages.push({ role: 'user', content: body.message ?? '' })
  return messages
}

async function callGemini(prompt: string, signal: AbortSignal): Promise<{ answer: string; provider: 'gemini' }> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set')
  const parts = [{ text: prompt }]
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
      signal,
    },
  )
  if (res.status === 429) {
    const err = new Error('RATE_LIMIT') as Error & { status: number }
    err.status = 429
    throw err
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini: ${text}`)
  }
  const json = await res.json()
  const candidate = json.candidates?.[0]
  const textPart = candidate?.content?.parts?.[0]?.text
  const answer =
    typeof textPart === 'string' && textPart.trim().length > 0
      ? textPart.trim()
      : candidate?.finishReason === 'MAX_TOKENS'
        ? 'Response was cut off due to length. Please ask a shorter follow-up.'
        : 'Sorry, I could not generate a response. Please try again.'
  return { answer, provider: 'gemini' }
}

async function callGroq(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  signal: AbortSignal,
): Promise<{ answer: string; provider: 'groq' }> {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set')
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages,
      max_tokens: 4096,
    }),
    signal,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Groq: ${text}`)
  }
  const json = await res.json()
  const content = json.choices?.[0]?.message?.content
  const answer =
    typeof content === 'string' && content.trim().length > 0
      ? content.trim()
      : 'Sorry, I could not generate a response. Please try again.'
  return { answer, provider: 'groq' }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const hasGemini = !!GEMINI_API_KEY
  const hasGroq = !!GROQ_API_KEY
  if (!hasGemini && !hasGroq) {
    return NextResponse.json(
      { error: 'No AI provider configured. Set GEMINI_API_KEY or GROQ_API_KEY.' },
      { status: 500 },
    )
  }

  const body = await req.json()
  const providerChoice = body.provider === 'groq' ? 'groq' : body.provider === 'gemini' ? 'gemini' : 'auto'

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90_000)
  const signal = controller.signal

  const run = async (): Promise<{ answer: string; provider: string }> => {
    if (providerChoice === 'gemini' && hasGemini) {
      const prompt = buildFullPrompt(body)
      return callGemini(prompt, signal)
    }
    if (providerChoice === 'groq' && hasGroq) {
      const messages = buildGroqMessages(body)
      return callGroq(messages, signal)
    }
    if (providerChoice === 'auto') {
      if (hasGemini) {
        try {
          const prompt = buildFullPrompt(body)
          return await callGemini(prompt, signal)
        } catch (e: unknown) {
          const is429 = e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 429
          const is5xx = e instanceof Error && /5\d{2}/.test(e.message)
          if (is429 || is5xx) {
            if (hasGroq) {
              const messages = buildGroqMessages(body)
              return await callGroq(messages, signal)
            }
          }
          throw e
        }
      }
      if (hasGroq) {
        const messages = buildGroqMessages(body)
        return await callGroq(messages, signal)
      }
    }
    throw new Error('No provider available')
  }

  try {
    const result = await run()
    clearTimeout(timeoutId)
    return NextResponse.json({ answer: result.answer, provider: result.provider })
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const message = err instanceof Error ? err.message : 'Unknown error'
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    const isRateLimit = err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 429
    if (isRateLimit) {
      return NextResponse.json(
        {
          error: 'Rate limit reached. Try again in a minute or choose Groq in the provider dropdown.',
          code: 'RATE_LIMIT',
        },
        { status: 429 },
      )
    }
    return NextResponse.json(
      {
        error: isTimeout
          ? 'The request took too long. Try again or a shorter question.'
          : 'Failed to call AI. Please try again or switch provider.',
        details: message,
      },
      { status: 500 },
    )
  }
}
