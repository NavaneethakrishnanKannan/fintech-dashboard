'use client'

import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { DashboardCard } from '@/components/DashboardCard'

if (typeof window !== 'undefined') axios.defaults.withCredentials = true

type Advice = { insights: string[]; suggestions: string[]; _emptyReason?: string }
type Summary = { KPIs?: Record<string, number>; investments?: unknown[]; expenses?: unknown[]; incomes?: unknown[]; loans?: { name: string; emi: number; remainingPrincipal?: number; principal: number }[] }
type ZerodhaHoldings = {
  totalValue: number
  equityValue?: number
  mfValue?: number
  totalSipMonthly?: number
  bySymbol: { symbol: string; value: number; pnl: number }[]
  mfByFund?: { fund: string; value: number; pnl: number }[]
  sips?: { fund: string; instalment_amount: number; frequency: string }[]
}

type PendingAction = { intent: string; fields: Record<string, unknown>; reply: string; userMessage: string }

interface ISpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: { results?: { [i: number]: { [j: number]: { transcript?: string } } } }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
}

export default function AIAdvisorPage() {
  const [advice, setAdvice] = useState<Advice | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceError, setAdviceError] = useState<string | null>(null)

  const [summary, setSummary] = useState<Summary | null>(null)
  const [zerodhaHoldings, setZerodhaHoldings] = useState<ZerodhaHoldings | null>(null)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [listening, setListening] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const ttsStopRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    axios.get<Summary>('/api/summary').then((r) => setSummary(r.data)).catch(() => setSummary(null))
    axios.get<ZerodhaHoldings>('/api/zerodha/holdings').then((r) => setZerodhaHoldings(r.data)).catch(() => setZerodhaHoldings(null))
    axios.get<{ role: string; content: string }[]>('/api/chat/messages?limit=30').then((r) => {
      const list = Array.isArray(r.data) ? r.data : []
      setChatMessages(list.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const contextSummary = [
      summary?.KPIs && `Net worth ₹${Math.round(summary.KPIs.netWorth ?? 0).toLocaleString('en-IN')}, Investments ₹${Math.round(summary.KPIs.totalCurrent ?? 0).toLocaleString('en-IN')}, Monthly savings ₹${Math.round(summary.KPIs.monthlySavings ?? 0).toLocaleString('en-IN')}, Income ₹${Math.round(summary.KPIs.totalIncome ?? 0).toLocaleString('en-IN')}, Expenses (incl. EMI) ₹${Math.round((summary.KPIs as { totalExpensesIncludingEmi?: number }).totalExpensesIncludingEmi ?? 0).toLocaleString('en-IN')}.`,
      summary?.loans?.length && `Loans: ${summary.loans.map((l) => `${l.name} principal ₹${Math.round(l.principal).toLocaleString('en-IN')} outstanding ₹${Math.round((l.remainingPrincipal ?? l.principal)).toLocaleString('en-IN')} EMI ₹${Math.round(l.emi).toLocaleString('en-IN')}`).join('; ')}`,
      summary?.investments?.length && `Investments: ${(summary.investments as { name: string; buyPrice: number; profit: number }[]).map((i) => `${i.name} ₹${Math.round(i.buyPrice + (i.profit || 0)).toLocaleString('en-IN')}`).join(', ')}`,
      zerodhaHoldings && (() => {
        const parts = [`Zerodha portfolio (linked): ₹${Math.round(zerodhaHoldings.totalValue).toLocaleString('en-IN')}`]
        if (zerodhaHoldings.bySymbol?.length) parts.push(`Equity: ${zerodhaHoldings.bySymbol.map((x) => `${x.symbol} ₹${Math.round(x.value).toLocaleString('en-IN')}`).join(', ')}`)
        if (zerodhaHoldings.mfByFund?.length) parts.push(`MF (Coin): ${zerodhaHoldings.mfByFund.map((x) => `${x.fund} ₹${Math.round(x.value).toLocaleString('en-IN')}`).join('; ')}`)
        if (zerodhaHoldings.sips?.length) parts.push(`SIPs: ${zerodhaHoldings.sips.map((s) => `${s.fund} ₹${s.instalment_amount}/${s.frequency}`).join('; ')}`)
        if (zerodhaHoldings.totalSipMonthly) parts.push(`Total SIP ≈ ₹${Math.round(zerodhaHoldings.totalSipMonthly).toLocaleString('en-IN')}/month`)
        return parts.join('. ')
      })(),
      summary?.expenses?.length && `Expenses (recent): ${(summary.expenses as { category: string; amount: number }[]).slice(0, 5).map((e) => `${e.category} ₹${e.amount}`).join(', ')}`,
      summary?.incomes?.length && `Income: ${(summary.incomes as { category: string; amount: number }[]).map((i) => `${i.category} ₹${i.amount}`).join(', ')}`,
    ]
      .filter(Boolean)
      .join(' ')

  const fetchAdvice = async () => {
    try {
      setAdviceLoading(true)
      setAdviceError(null)
      const res = await axios.post<Advice>('/api/ai/advice')
      setAdvice(res.data)
    } catch (e: unknown) {
      const err = e && typeof e === 'object' && 'response' in e && (e as { response?: { data?: { error?: string } } }).response?.data?.error
      setAdviceError(typeof err === 'string' ? err : 'Failed to get advice')
    } finally {
      setAdviceLoading(false)
    }
  }

  const executeAction = async (action: PendingAction): Promise<string> => {
    const { intent, fields } = action
    const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) || 0 : 0)
    const str = (v: unknown) => (typeof v === 'string' ? v : String(v ?? ''))

    switch (intent) {
      case 'add_expense': {
        await axios.post('/api/expenses', {
          amount: num(fields.amount),
          category: str(fields.category) || 'Other',
          description: fields.description != null ? str(fields.description) : undefined,
          date: new Date().toISOString().slice(0, 10),
        })
        return `Done. Added ${str(fields.category) || 'expense'} expense ₹${num(fields.amount).toLocaleString('en-IN')}.`
      }
      case 'add_income': {
        await axios.post('/api/incomes', { amount: num(fields.amount), category: str(fields.category) || 'Salary' })
        return `Done. Added ${str(fields.category) || 'income'} ₹${num(fields.amount).toLocaleString('en-IN')}.`
      }
      case 'add_investment': {
        const buyPrice = num(fields.buyPrice ?? fields.investedAmount)
        await axios.post('/api/investments', {
          name: str(fields.name) || 'Investment',
          buyPrice,
          quantity: 1,
          type: (fields.type as string) || 'OTHER',
          symbol: fields.symbol != null ? str(fields.symbol) : undefined,
          profit: num(fields.profit),
          monthlySip: fields.monthlySip != null ? num(fields.monthlySip) : undefined,
        })
        return `Done. Added investment ${str(fields.name)} ₹${buyPrice.toLocaleString('en-IN')}.`
      }
      case 'add_loan': {
        await axios.post('/api/loans', {
          name: str(fields.name) || 'Loan',
          principal: num(fields.principal),
          emi: num(fields.emi),
          interest: fields.interest != null ? num(fields.interest) : undefined,
          tenure: fields.tenure != null ? num(fields.tenure) : undefined,
          totalTenureMonths: fields.totalTenureMonths != null ? num(fields.totalTenureMonths) : undefined,
          startDate: new Date().toISOString().slice(0, 10),
        })
        return `Done. Added loan ${str(fields.name)}.`
      }
      case 'add_goal': {
        await axios.post('/api/goals', {
          title: str(fields.title) || 'Goal',
          targetAmount: num(fields.targetAmount),
          currentAmount: fields.currentAmount != null ? num(fields.currentAmount) : 0,
          targetDate: fields.targetDate ? str(fields.targetDate) : undefined,
        })
        return `Done. Added goal ${str(fields.title)} ₹${num(fields.targetAmount).toLocaleString('en-IN')}.`
      }
      case 'remove_expense': {
        const { data: expenses } = await axios.get<{ id: string; category: string; amount: number }[]>('/api/expenses')
        const match = expenses?.find((e) => e.category === str(fields.category) && Number(e.amount) === num(fields.amount))
        if (!match) return `No expense found matching ${str(fields.category)} ₹${num(fields.amount)}.`
        await axios.delete(`/api/expenses/${match.id}`)
        return `Done. Deleted ${str(fields.category)} expense ₹${num(fields.amount).toLocaleString('en-IN')}.`
      }
      case 'subtract_expense': {
        const { data: expenses } = await axios.get<{ id: string; category: string; amount: number }[]>('/api/expenses')
        const inCategory = (expenses ?? []).filter((e) => e.category === str(fields.category))
        const toSubtract = num(fields.amount)
        const latest = inCategory[0]
        if (!latest) return `No ${str(fields.category)} expense found to reduce.`
        const current = Number(latest.amount)
        const newAmount = Math.max(0, current - toSubtract)
        if (newAmount === 0) await axios.delete(`/api/expenses/${latest.id}`)
        else await axios.patch(`/api/expenses/${latest.id}`, { amount: newAmount })
        return `Done. Reduced ${str(fields.category)} expense by ₹${toSubtract.toLocaleString('en-IN')}.`
      }
      default:
        return 'Action not supported.'
    }
  }

  const sendChat = async () => {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    setChatInput('')
    setChatMessages((m) => [...m, { role: 'user', content: msg }])
    setChatLoading(true)
    try {
      const parseRes = await axios.post<{ intent: string; fields: Record<string, unknown>; missing: string[]; reply: string }>('/api/chat/parse-command', { message: msg })
      const { intent, fields = {}, missing = [], reply } = parseRes.data

      if (intent !== 'chat' && reply && Array.isArray(missing) && missing.length === 0) {
        setChatLoading(false)
        setPendingAction({ intent, fields, reply, userMessage: msg })
        return
      }
      if (intent !== 'chat' && reply && Array.isArray(missing) && missing.length > 0) {
        setChatMessages((m) => [...m, { role: 'assistant', content: reply }])
        await axios.post('/api/chat/messages', { messages: [{ role: 'user', content: msg }, { role: 'assistant', content: reply }] }).catch(() => {})
        setChatLoading(false)
        return
      }

      const res = await axios.post<{ answer: string }>('/api/chat', {
        message: msg,
        contextSummary,
        history: chatMessages,
        provider: 'auto',
      })
      const answer = res.data?.answer ?? 'No response.'
      setChatMessages((m) => [...m, { role: 'assistant', content: answer }])
      await axios.post('/api/chat/messages', { messages: [{ role: 'user', content: msg }, { role: 'assistant', content: answer }] }).catch(() => {})
    } catch {
      const fallback = 'Sorry, I could not get a response. Please try again.'
      setChatMessages((m) => [...m, { role: 'assistant', content: fallback }])
      await axios.post('/api/chat/messages', { messages: [{ role: 'user', content: msg }, { role: 'assistant', content: fallback }] }).catch(() => {})
    } finally {
      setChatLoading(false)
    }
  }

  const onConfirmAction = async () => {
    if (!pendingAction || actionLoading) return
    setActionLoading(true)
    try {
      const successMsg = await executeAction(pendingAction)
      setChatMessages((m) => [...m, { role: 'assistant', content: successMsg }])
      await axios.post('/api/chat/messages', {
        messages: [
          { role: 'user', content: pendingAction.userMessage },
          { role: 'assistant', content: successMsg },
        ],
      }).catch(() => {})
      axios.get<Summary>('/api/summary').then((r) => setSummary(r.data)).catch(() => {})
    } catch {
      setChatMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Please try again or add from the dashboard.' }])
    } finally {
      setActionLoading(false)
      setPendingAction(null)
    }
  }

  const onCancelAction = () => {
    if (!pendingAction) return
    setChatMessages((m) => [...m, { role: 'assistant', content: 'Cancelled.' }])
    axios.post('/api/chat/messages', { messages: [{ role: 'user', content: pendingAction.userMessage }, { role: 'assistant', content: 'Cancelled.' }] }).catch(() => {})
    setPendingAction(null)
  }

  const stopTts = () => {
    ttsStopRef.current?.()
    ttsStopRef.current = null
    setPlayingId(null)
  }

  const playTts = async (content: string, index: number) => {
    if (playingId !== null) return
    const text = content.slice(0, 5000).trim()
    if (!text) return
    setPlayingId(index)

    const cleanup = () => {
      ttsStopRef.current = null
      setPlayingId(null)
    }

    try {
      const res = await axios.post<Blob>('/api/tts', { text }, { responseType: 'blob', validateStatus: () => true })
      if (res.status === 200 && res.data instanceof Blob && res.data.size > 0 && res.data.type?.startsWith('audio/')) {
        const url = URL.createObjectURL(res.data)
        const audio = new Audio(url)
        ttsStopRef.current = () => {
          audio.pause()
          audio.currentTime = 0
          URL.revokeObjectURL(url)
          cleanup()
        }
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { URL.revokeObjectURL(url); cleanup(); resolve() }
          audio.onerror = () => { cleanup(); reject() }
          audio.play().catch(() => { cleanup(); reject() })
        }).catch(() => {})
        return
      }
    } catch {
      // Server TTS not configured or failed
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-IN'
      u.rate = 0.9
      ttsStopRef.current = () => {
        window.speechSynthesis.cancel()
        cleanup()
      }
      await new Promise<void>((resolve) => {
        u.onend = () => { cleanup(); resolve() }
        u.onerror = () => { cleanup(); resolve() }
        window.speechSynthesis.speak(u)
      })
    }
    cleanup()
  }

  const startVoiceInput = () => {
    if (listening || !('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return
    const win = window as Window & { SpeechRecognition?: new () => ISpeechRecognition; webkitSpeechRecognition?: new () => ISpeechRecognition }
    const Recognition = win.SpeechRecognition ?? win.webkitSpeechRecognition
    if (!Recognition) return
    const rec = new Recognition()
    rec.continuous = false
    rec.interimResults = false
    rec.lang = 'en-IN'
    setListening(true)
    rec.onresult = (e: { results?: { [i: number]: { [j: number]: { transcript?: string } } } }) => {
      const text = e.results?.[0]?.[0]?.transcript
      if (text) {
        setChatInput((prev) => (prev ? `${prev} ${text}` : text))
        setTimeout(() => chatInputRef.current?.focus(), 0)
      }
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">AI Advisor</h1>

      <DashboardCard title="Chat">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Ask questions about your finances. The AI has context from your dashboard (investments, loans, income, expenses).
        </p>
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden flex flex-col max-h-[400px]">
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[200px]">
            {chatMessages.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Send a message to start (e.g. &quot;How is my savings rate?&quot; or &quot;Which loan should I pay first?&quot;).</p>
            )}
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={`text-sm p-2 rounded-lg max-w-[85%] ${m.role === 'user' ? 'ml-auto bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700/50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-xs text-gray-500 dark:text-gray-400">{m.role === 'user' ? 'You' : 'Assistant'}</span>
                  {m.role === 'assistant' && m.content && (
                    playingId === i ? (
                      <button
                        type="button"
                        onClick={stopTts}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                        title="Stop"
                        aria-label="Stop"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><rect x="5" y="5" width="10" height="10" rx="1"/></svg>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => playTts(m.content, i)}
                        disabled={playingId !== null}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                        title="Listen"
                        aria-label="Listen"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 0 0-1.196-.98l-10 2A1 1 0 0 0 6 5v9.114A1 5 0 1 0 8 14V6.434l8-1.6V15a1 1 0 0 0 2 0V3z"/></svg>
                      </button>
                    )
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {pendingAction && (
              <div className="text-sm p-2 rounded-lg max-w-[85%] bg-gray-100 dark:bg-gray-700/50">
                <span className="font-medium text-xs text-gray-500 dark:text-gray-400">Assistant</span>
                <p className="mt-0.5 whitespace-pre-wrap">{pendingAction.reply}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={onCancelAction}
                    disabled={actionLoading}
                    className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirmAction}
                    disabled={actionLoading}
                    className="rounded bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? '…' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
            {chatLoading && <p className="text-sm text-gray-500">Thinking…</p>}
            <div ref={chatEndRef} />
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); sendChat(); }}
            className="flex gap-2 p-2 border-t border-gray-200 dark:border-gray-600"
          >
            <button
              type="button"
              onClick={startVoiceInput}
              disabled={chatLoading || listening}
              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              title="Voice input"
              aria-label="Voice input"
            >
              {listening ? (
                <span className="text-xs text-red-600">●</span>
              ) : (
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7 4a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V4zm4 10.93A7.001 7.001 0 0 0 17 8a1 1 0 1 0-2 0A5 5 0 0 1 5 8a1 1 0 0 0-2 0 7.001 7.001 0 0 0 6 6.93V17H6a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07z" clipRule="evenodd"/></svg>
              )}
            </button>
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about your finances…"
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              disabled={chatLoading}
            />
            <button type="submit" disabled={chatLoading || !chatInput.trim()} className="rounded bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      </DashboardCard>

      <DashboardCard title="Structured advice">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Get one-off AI-generated insights and suggestions based on your data.
        </p>
        <button
          type="button"
          onClick={fetchAdvice}
          disabled={adviceLoading}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {adviceLoading ? 'Analyzing…' : 'Get AI advice'}
        </button>
        {adviceError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{adviceError}</p>}
        {advice?._emptyReason && <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{advice._emptyReason}</p>}
      </DashboardCard>

      {advice && (
        <>
          <DashboardCard title="Insights">
            <ul className="list-disc list-inside space-y-1">
              {advice.insights.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            {advice.insights.length === 0 && <p className="text-gray-500">No insights returned. {advice._emptyReason ?? 'Try again or add more financial data.'}</p>}
          </DashboardCard>
          <DashboardCard title="Suggestions">
            <ul className="list-disc list-inside space-y-1">
              {advice.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            {advice.suggestions.length === 0 && <p className="text-gray-500">No suggestions returned. {advice._emptyReason ?? 'Try again or add more financial data.'}</p>}
          </DashboardCard>
        </>
      )}
    </div>
  )
}
