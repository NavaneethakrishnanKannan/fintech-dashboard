
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

// Ensure session cookie is sent with same-origin API requests (fixes 401 on Vercel etc.)
if (typeof window !== 'undefined') {
  axios.defaults.withCredentials = true
}
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts'

type Investment = {
  id: string
  type: string
  symbol: string | null
  name: string
  quantity: number
  buyPrice: number
  profit: number
  buyDate: string
  monthlySip?: number | null
}

type Expense = {
  id: string
  amount: number
  category: string
  description?: string | null
  date?: string
}

type Income = {
  id: string
  amount: number
  category: string
  date?: string
}

type Loan = {
  id: string
  name: string
  principal: number
  interest: number
  tenure: number
  totalTenureMonths: number | null
  emi: number
  startDate?: string
  /** Outstanding principal after months paid (from API). */
  remainingPrincipal?: number
}

type SummaryResponse = {
  investments: Investment[]
  expenses: Expense[]
  incomes: Income[]
  loans: Loan[]
  KPIs: {
    totalInvested: number
    totalCurrent: number
    totalIncome: number
    totalExpenses: number
    totalLoanEmi: number
    totalExpensesIncludingEmi: number
    monthlySavings: number
    totalLoanPrincipal: number
    totalHomeAssetValue: number
    netWorth: number
  }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#845EF7']

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/dashboard')
    }
  }, [status, router])

  const [newInvestment, setNewInvestment] = useState({
    type: 'STOCK',
    symbol: '',
    name: '',
    investedAmount: '',
    profit: '',
    monthlySip: '',
  })

  const [newExpense, setNewExpense] = useState({
    category: 'Food',
    amount: '',
  })

  const [newIncome, setNewIncome] = useState({
    category: 'Salary',
    amount: '',
  })

  const [newLoan, setNewLoan] = useState({
    name: '',
    principal: '',
    interest: '',
    monthsPaid: '',
    totalTenureMonths: '',
    emi: '',
  })

  const [chatInput, setChatInput] = useState('')
  type CommandCard = {
    intent: string
    fields: Record<string, unknown>
    missing: string[]
    reply: string
  }
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string; provider?: string; commandCard?: CommandCard; confirmed?: boolean; cancelled?: boolean }[]
  >([])
  const [confirmingCommandIdx, setConfirmingCommandIdx] = useState<number | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatProvider, setChatProvider] = useState<'auto' | 'gemini' | 'groq'>('auto')
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'ta-IN'>('en-IN')
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [ttsSupported, setTtsSupported] = useState(false)
  const [ttsPremiumAvailable, setTtsPremiumAvailable] = useState(false)
  const voiceRecognitionRef = useRef<{ abort(): void } | null>(null)
  const [speakingMessageIdx, setSpeakingMessageIdx] = useState<number | null>(null)
  const [autoSpeakResponse, setAutoSpeakResponse] = useState(false)
  const speechSynthRef = useRef<SpeechSynthesis | null>(null)
  const premiumAudioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null)

  const getPreferredVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null
    const voices = window.speechSynthesis.getVoices()
    const langPrefix = voiceLang.split('-')[0]
    const forLang = (v: SpeechSynthesisVoice) =>
      v.lang.startsWith(langPrefix) || v.lang.startsWith(langPrefix + '-')
    const googleFemale = voices.find(
      (v) => forLang(v) && /google/i.test(v.name) && /female|woman|zira|samantha|karen|victoria/i.test(v.name)
    )
    if (googleFemale) return googleFemale
    const googleAny = voices.find((v) => forLang(v) && /google/i.test(v.name))
    if (googleAny) return googleAny
    const female = voices.find(
      (v) => forLang(v) && /female|woman|zira|samantha|karen|victoria/i.test(v.name)
    )
    if (female) return female
    const anyForLang = voices.find(forLang)
    return anyForLang || null
  }

  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(
    null,
  )
  const [projectionYears, setProjectionYears] = useState(15)
  const [projectionRatePct, setProjectionRatePct] = useState(12)
  const [predictionExplanation, setPredictionExplanation] = useState<string | null>(
    null,
  )
  const [predictionLoading, setPredictionLoading] = useState(false)

  const [editInvestment, setEditInvestment] = useState<Investment | null>(null)
  const [editInvestmentForm, setEditInvestmentForm] = useState({
    type: 'STOCK',
    symbol: '',
    name: '',
    investedAmount: '',
    profit: '',
    buyDate: '',
    monthlySip: '',
  })

  const [payoffModalLoan, setPayoffModalLoan] = useState<Loan | null>(null)
  const [payoffExtraEmi, setPayoffExtraEmi] = useState('')
  const [payoffLumpSum, setPayoffLumpSum] = useState('')
  const [payoffAdvice, setPayoffAdvice] = useState<string | null>(null)
  const [payoffAdviceLoading, setPayoffAdviceLoading] = useState(false)

  const [editIncome, setEditIncome] = useState<Income | null>(null)
  const [editIncomeForm, setEditIncomeForm] = useState({ category: 'Salary', amount: '' })
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [editExpenseForm, setEditExpenseForm] = useState({ category: 'Food', amount: '', description: '' })
  const [goals, setGoals] = useState<{ id: string; title: string; targetAmount: number; currentAmount: number; targetDate: string | null }[]>([])
  const [newGoal, setNewGoal] = useState({ title: '', targetAmount: '', currentAmount: '0', targetDate: '' })
  const [showIncomeListModal, setShowIncomeListModal] = useState(false)
  const [showExpenseListModal, setShowExpenseListModal] = useState(false)
  const [showGoalsListModal, setShowGoalsListModal] = useState(false)
  const [editGoal, setEditGoal] = useState<{ id: string; title: string; targetAmount: number; currentAmount: number; targetDate: string | null } | null>(null)
  const [editGoalForm, setEditGoalForm] = useState({ title: '', targetAmount: '', currentAmount: '', targetDate: '' })
  const [editLoan, setEditLoan] = useState<Loan | null>(null)
  const [editLoanForm, setEditLoanForm] = useState({
    name: '',
    principal: '',
    interest: '',
    monthsPaid: '',
    totalTenureMonths: '',
    emi: '',
    startDate: '',
  })
  const [updateLoanLoading, setUpdateLoanLoading] = useState(false)
  const [showSavingsDetails, setShowSavingsDetails] = useState(false)

  const [homePredictionModalLoan, setHomePredictionModalLoan] = useState<Loan | null>(null)
  const [homeAppreciationYears, setHomeAppreciationYears] = useState(15)
  const [homeAppreciationRatePct, setHomeAppreciationRatePct] = useState(6)
  const [homePredictionExplanation, setHomePredictionExplanation] = useState<string | null>(null)
  const [homePredictionLoading, setHomePredictionLoading] = useState(false)

  const loadSummary = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await axios.get<SummaryResponse>('/api/summary')
      setSummary(res.data)
    } catch (e: any) {
      if (e?.response?.status === 401) {
        setToast('Session expired. Redirecting to sign in…')
        setTimeout(() => router.push('/login?callbackUrl=/dashboard'), 1500)
        return
      }
      setError(e?.message ?? 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const loadChatHistory = async () => {
    try {
      const res = await axios.get<{ id: string; role: string; content: string }[]>('/api/chat/messages?limit=30')
      const list = Array.isArray(res.data) ? res.data : []
      setChatMessages(list.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })))
    } catch {
      // ignore; keep empty chat
    }
  }

  useEffect(() => {
    if (status === 'authenticated') loadChatHistory()
  }, [status])

  useEffect(() => {
    try {
      const s = localStorage.getItem('wealth_chat_provider')
      if (s === 'gemini' || s === 'groq') setChatProvider(s)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('wealth_chat_provider', chatProvider)
    } catch {
      // ignore
    }
  }, [chatProvider])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setVoiceSupported(
      typeof (window as any).SpeechRecognition === 'function' ||
      typeof (window as any).webkitSpeechRecognition === 'function'
    )
    setTtsSupported(!!window.speechSynthesis)
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices()
      }
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    axios.get<{ available?: boolean }>('/api/tts/status').then((r) => {
      setTtsPremiumAvailable(!!r.data?.available)
    }).catch(() => setTtsPremiumAvailable(false))
  }, [status])

  useEffect(() => {
    try {
      const s = localStorage.getItem('wealth_voice_lang')
      if (s === 'ta-IN' || s === 'en-IN') setVoiceLang(s)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('wealth_voice_lang', voiceLang)
    } catch {
      // ignore
    }
  }, [voiceLang])

  const startVoiceInput = () => {
    if (!voiceSupported || voiceListening) return
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = voiceLang
    recognition.onresult = (e: { results: Iterable<{ [i: number]: { transcript: string } }> }) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      if (transcript) void handleChatSend(transcript)
    }
    recognition.onend = () => {
      setVoiceListening(false)
      voiceRecognitionRef.current = null
    }
    recognition.onerror = () => {
      setVoiceListening(false)
      voiceRecognitionRef.current = null
    }
    voiceRecognitionRef.current = recognition
    recognition.start()
    setVoiceListening(true)
  }

  const stopVoiceInput = () => {
    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.abort()
      voiceRecognitionRef.current = null
    }
    setVoiceListening(false)
  }

  const stripMarkdownForSpeech = (text: string): string => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/__/g, '')
      .replace(/_/g, '')
      .trim()
  }

  const speakWithBrowserTTS = (plainText: string, messageIdx: number) => {
    const synth = window.speechSynthesis
    speechSynthRef.current = synth
    synth.cancel()
    const preferred = getPreferredVoice()
    const sentences = plainText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    const chunks = sentences.length > 0 ? sentences : [plainText]
    let i = 0
    const speakNext = () => {
      if (i >= chunks.length) {
        setSpeakingMessageIdx(null)
        return
      }
      const utterance = new SpeechSynthesisUtterance(chunks[i])
      utterance.lang = voiceLang
      utterance.rate = 0.85
      utterance.pitch = 1.02
      if (preferred) utterance.voice = preferred
      utterance.onend = () => {
        i += 1
        speakNext()
      }
      utterance.onerror = () => setSpeakingMessageIdx(null)
      synth.speak(utterance)
    }
    speakNext()
  }

  const speakResponse = (text: string, messageIdx: number) => {
    if (typeof window === 'undefined') return
    const plainText = stripMarkdownForSpeech(text)
    if (!plainText.trim()) return
    setSpeakingMessageIdx(messageIdx)
    if (ttsPremiumAvailable) {
      if (premiumAudioRef.current) {
        premiumAudioRef.current.audio.pause()
        URL.revokeObjectURL(premiumAudioRef.current.url)
        premiumAudioRef.current = null
      }
      axios
        .post('/api/tts', { text: plainText, lang: voiceLang }, { responseType: 'blob' })
        .then((res) => {
          const url = URL.createObjectURL(res.data as Blob)
          const audio = new Audio(url)
          premiumAudioRef.current = { audio, url }
          audio.onended = () => {
            if (premiumAudioRef.current?.url === url) {
              URL.revokeObjectURL(url)
              premiumAudioRef.current = null
            }
            setSpeakingMessageIdx(null)
          }
          audio.onerror = () => {
            setSpeakingMessageIdx(null)
            if (premiumAudioRef.current?.url === url) {
              URL.revokeObjectURL(url)
              premiumAudioRef.current = null
            }
          }
          audio.play()
        })
        .catch(() => {
          if (window.speechSynthesis) speakWithBrowserTTS(plainText, messageIdx)
          else setSpeakingMessageIdx(null)
        })
      return
    }
    if (window.speechSynthesis) speakWithBrowserTTS(plainText, messageIdx)
    else setSpeakingMessageIdx(null)
  }

  const stopSpeaking = () => {
    if (premiumAudioRef.current) {
      premiumAudioRef.current.audio.pause()
      premiumAudioRef.current.audio.currentTime = 0
      URL.revokeObjectURL(premiumAudioRef.current.url)
      premiumAudioRef.current = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setSpeakingMessageIdx(null)
  }

  const loadGoals = async () => {
    try {
      const res = await axios.get<{ id: string; title: string; targetAmount: number; currentAmount: number; targetDate: string | null }[]>('/api/goals')
      setGoals(Array.isArray(res.data) ? res.data : [])
    } catch {
      setGoals([])
    }
  }
  useEffect(() => {
    if (status === 'authenticated') loadGoals()
  }, [status])

  const handleDeleteLoan = async (id: string) => {
    try {
      await axios.delete(`/api/loans/${id}`)
      await loadSummary()
    } catch (e: any) {
      setToast(e?.response?.data?.error ?? 'Failed to delete loan')
    }
  }

  const handleDeleteIncome = async (id: string) => {
    try {
      await axios.delete(`/api/incomes/${id}`)
      if (editIncome?.id === id) setEditIncome(null)
      await loadSummary()
    } catch (e: any) {
      setToast(e?.response?.data?.error ?? 'Failed to delete income')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    try {
      await axios.delete(`/api/expenses/${id}`)
      if (editExpense?.id === id) setEditExpense(null)
      await loadSummary()
    } catch (e: any) {
      setToast(e?.response?.data?.error ?? 'Failed to delete expense')
    }
  }

  const openEditIncomeModal = (inc: Income) => {
    setEditIncome(inc)
    setEditIncomeForm({ category: inc.category, amount: String(inc.amount) })
  }
  const handleUpdateIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editIncome) return
    await axios.patch(`/api/incomes/${editIncome.id}`, { category: editIncomeForm.category, amount: Number(editIncomeForm.amount) })
    await loadSummary()
    setEditIncome(null)
  }

  const openEditExpenseModal = (exp: Expense) => {
    setEditExpense(exp)
    setEditExpenseForm({
      category: exp.category,
      amount: String(exp.amount),
      description: exp.description ?? '',
    })
  }
  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editExpense) return
    await axios.patch(`/api/expenses/${editExpense.id}`, {
      category: editExpenseForm.category,
      amount: Number(editExpenseForm.amount),
      description: editExpenseForm.description || null,
    })
    await loadSummary()
    setEditExpense(null)
  }

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    await axios.post('/api/goals', {
      title: newGoal.title || 'Goal',
      targetAmount: Number(newGoal.targetAmount) || 0,
      currentAmount: Number(newGoal.currentAmount) || 0,
      targetDate: newGoal.targetDate ? new Date(newGoal.targetDate).toISOString() : null,
    })
    setNewGoal({ title: '', targetAmount: '', currentAmount: '0', targetDate: '' })
    await loadGoals()
  }

  const handleDeleteGoal = async (id: string) => {
    await axios.delete(`/api/goals/${id}`)
    await loadGoals()
  }

  const openEditGoalModal = (g: { id: string; title: string; targetAmount: number; currentAmount: number; targetDate: string | null }) => {
    setEditGoal(g)
    setEditGoalForm({
      title: g.title,
      targetAmount: String(g.targetAmount),
      currentAmount: String(g.currentAmount),
      targetDate: g.targetDate ? new Date(g.targetDate).toISOString().slice(0, 10) : '',
    })
  }
  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editGoal) return
    await axios.patch(`/api/goals/${editGoal.id}`, {
      title: editGoalForm.title || 'Goal',
      targetAmount: Number(editGoalForm.targetAmount) || 0,
      currentAmount: Number(editGoalForm.currentAmount) || 0,
      targetDate: editGoalForm.targetDate ? new Date(editGoalForm.targetDate).toISOString() : null,
    })
    await loadGoals()
    setEditGoal(null)
  }

  const handleAddInvestment = async (e: React.FormEvent) => {
    e.preventDefault()
    await axios.post('/api/investments', {
      type: newInvestment.type,
      symbol: newInvestment.symbol,
      name: newInvestment.name,
      buyPrice: Number(newInvestment.investedAmount),
      profit: Number(newInvestment.profit || 0),
      buyDate: new Date().toISOString(),
      monthlySip: newInvestment.monthlySip ? Number(newInvestment.monthlySip) : null,
    })
    setNewInvestment({
      type: 'STOCK',
      symbol: '',
      name: '',
      investedAmount: '',
      profit: '',
      monthlySip: '',
    })
    await loadSummary()
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    await axios.post('/api/expenses', {
      category: newExpense.category,
      amount: Number(newExpense.amount),
    })
    setNewExpense({
      category: 'Food',
      amount: '',
    })
    await loadSummary()
  }

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    await axios.post('/api/incomes', {
      category: newIncome.category,
      amount: Number(newIncome.amount),
    })
    setNewIncome({
      category: 'Salary',
      amount: '',
    })
    await loadSummary()
  }

  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    const totalMonths = newLoan.totalTenureMonths ? Number(newLoan.totalTenureMonths) : null
    const monthsPaidNum = newLoan.monthsPaid ? Number(newLoan.monthsPaid) : 0
    const tenure = totalMonths != null ? totalMonths - monthsPaidNum : 0
    await axios.post('/api/loans', {
      name: newLoan.name,
      principal: Number(newLoan.principal),
      interest: Number(newLoan.interest),
      tenure,
      totalTenureMonths: totalMonths,
      emi: Number(newLoan.emi),
      startDate: new Date().toISOString(),
    })
    setNewLoan({
      name: '',
      principal: '',
      interest: '',
      monthsPaid: '',
      totalTenureMonths: '',
      emi: '',
    })
    await loadSummary()
  }

  const handleDeleteInvestment = async (id: string) => {
    await axios.delete(`/api/investments?id=${id}`)
    if (selectedInvestmentId === id) {
      setSelectedInvestmentId(null)
    }
    await loadSummary()
  }

  const openEditInvestmentModal = (inv: Investment) => {
    setEditInvestment(inv)
    const d = inv.buyDate ? new Date(inv.buyDate) : new Date()
    setEditInvestmentForm({
      type: inv.type,
      symbol: inv.symbol ?? '',
      name: inv.name,
      investedAmount: String(inv.buyPrice),
      profit: String(inv.profit),
      buyDate: d.toISOString().slice(0, 10),
      monthlySip: inv.monthlySip != null ? String(inv.monthlySip) : '',
    })
  }

  const closeEditInvestmentModal = () => {
    setEditInvestment(null)
  }

  const handleUpdateInvestment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editInvestment) return
    await axios.patch(`/api/investments/${editInvestment.id}`, {
      type: editInvestmentForm.type,
      symbol: editInvestmentForm.symbol || null,
      name: editInvestmentForm.name,
      buyPrice: Number(editInvestmentForm.investedAmount),
      profit: Number(editInvestmentForm.profit || 0),
      buyDate: editInvestmentForm.buyDate
        ? new Date(editInvestmentForm.buyDate).toISOString()
        : new Date().toISOString(),
      monthlySip: editInvestmentForm.monthlySip ? Number(editInvestmentForm.monthlySip) : null,
    })
    await loadSummary()
    closeEditInvestmentModal()
  }

  const openPayoffModal = (loan: Loan) => {
    setPayoffModalLoan(loan)
    setPayoffExtraEmi('')
    setPayoffLumpSum('')
    setPayoffAdvice(null)
  }

  const closePayoffModal = () => {
    setPayoffModalLoan(null)
    setPayoffAdvice(null)
  }

  const isHomeLoan = (loan: Loan) => loan.name.toLowerCase().includes('home')

  const openHomePredictionModal = (loan: Loan) => {
    setHomePredictionModalLoan(loan)
    setHomePredictionExplanation(null)
  }

  const closeHomePredictionModal = () => {
    setHomePredictionModalLoan(null)
  }

  const handleGetHomePrediction = async () => {
    if (!homePredictionModalLoan) return
    setHomePredictionLoading(true)
    setHomePredictionExplanation(null)
    const value = homePredictionModalLoan.principal
    const message = `
I have a home (property) that I am treating as an appreciating asset. My current estimated property value is ₹${Math.round(value).toLocaleString('en-IN')} (based on my home loan amount).

I want to understand how this asset might grow in value over time. Assume annual appreciation of around ${homeAppreciationRatePct}% per year for the next ${homeAppreciationYears} years (typical range for real estate in India can be 5–7% or more in some areas, but it is not guaranteed).

In 3–5 plain sentences: (1) Give a brief prediction of how my property value might look after ${homeAppreciationYears} years at roughly ${homeAppreciationRatePct}% annual appreciation. (2) Mention that this is only an approximate scenario and depends on location, market, and maintenance. (3) One practical tip (e.g. how to think about home equity, or when to reassess). Use simple paragraphs, no markdown or bullet headings.
    `.trim()
    try {
      const res = await axios.post('/api/chat', { message })
      setHomePredictionExplanation(res.data.answer)
    } catch (e: any) {
      setHomePredictionExplanation('Unable to load prediction. Please try again.')
    } finally {
      setHomePredictionLoading(false)
    }
  }

  const openEditLoanModal = (loan: Loan) => {
    setEditLoan(loan)
    const monthsPaid =
      loan.totalTenureMonths != null
        ? String(loan.totalTenureMonths - loan.tenure)
        : ''
    const start = loan.startDate ? new Date(loan.startDate) : new Date()
    setEditLoanForm({
      name: loan.name,
      principal: String(loan.principal),
      interest: String(loan.interest),
      monthsPaid,
      totalTenureMonths: loan.totalTenureMonths != null ? String(loan.totalTenureMonths) : '',
      emi: String(loan.emi),
      startDate: start.toISOString().slice(0, 10),
    })
  }

  const closeEditLoanModal = () => {
    setEditLoan(null)
  }

  const handleUpdateLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editLoan) return
    setUpdateLoanLoading(true)
    try {
      const totalMonths = editLoanForm.totalTenureMonths
        ? Number(editLoanForm.totalTenureMonths)
        : null
      const monthsPaidNum = editLoanForm.monthsPaid ? Number(editLoanForm.monthsPaid) : null
      const tenure =
        totalMonths != null && monthsPaidNum != null
          ? totalMonths - monthsPaidNum
          : editLoan.tenure
      await axios.patch(`/api/loans/${editLoan.id}`, {
        name: editLoanForm.name,
        principal: Number(editLoanForm.principal),
        interest: Number(editLoanForm.interest),
        tenure,
        totalTenureMonths: totalMonths,
        emi: Number(editLoanForm.emi),
        startDate: editLoanForm.startDate ? new Date(editLoanForm.startDate).toISOString() : undefined,
      })
      await loadSummary()
      closeEditLoanModal()
    } finally {
      setUpdateLoanLoading(false)
    }
  }

  const handleGetPayoffAdvice = async () => {
    if (!payoffModalLoan) return
    setPayoffAdviceLoading(true)
    setPayoffAdvice(null)

    const extraEmiNum = payoffExtraEmi ? Number(payoffExtraEmi) : 0
    const lumpSumNum = payoffLumpSum ? Number(payoffLumpSum) : 0

    const message = `
This is a loan. I want smart payoff advice.

Loan name: ${payoffModalLoan.name}
Principal outstanding: ₹${Math.round(payoffModalLoan.remainingPrincipal ?? payoffModalLoan.principal)}
Current EMI: ₹${Math.round(payoffModalLoan.emi)} per month
Interest rate: ${payoffModalLoan.interest}% per year
Remaining tenure: ${payoffModalLoan.tenure} months

${extraEmiNum > 0 ? `I can pay an extra ₹${Math.round(extraEmiNum)} per month (on top of my EMI).` : 'I have not entered any extra monthly payment.'}
${lumpSumNum > 0 ? `I can make a one-time prepayment of ₹${Math.round(lumpSumNum)}.` : 'I have not entered any one-time prepayment.'}

Give me clear, respectful advice in plain English (no markdown, no bullet headings). Cover: (1) How I can close this loan in fewer years and roughly how much interest I can save. (2) If I can pay extra EMI or a lump sum, how that changes the timeline and interest. (3) One or two practical tips (e.g. when to prepay, what to prioritise). If you need more information from me to personalise the plan, ask briefly at the end. Keep it concise.
    `.trim()

    try {
      const res = await axios.post('/api/chat', { message })
      setPayoffAdvice(res.data.answer)
    } catch (e: any) {
      setPayoffAdvice(
        'Unable to load payoff advice right now. Please try again later.',
      )
    } finally {
      setPayoffAdviceLoading(false)
    }
  }

  const handlePredictInvestment = async (inv: {
    id: string
    name: string
    symbol: string | null
    invested: number
    currentValue: number
    profit: number
  }) => {
    setSelectedInvestmentId(inv.id)
    setPredictionLoading(true)
    setPredictionExplanation(null)

    const message = `
I have an investment and I want a short explanation and projection.

Symbol: ${inv.symbol ?? 'N/A'}
Name (may be incomplete): ${inv.name}
Invested amount: ₹${Math.round(inv.invested)}
Current value: ₹${Math.round(inv.currentValue)}
Current profit: ₹${Math.round(inv.profit)}
Projection horizon: ${projectionYears} years
Assumed annual return: ${projectionRatePct}%.

First, infer a likely full stock or fund name from the symbol and name (Indian markets) and briefly say what type of asset it is. Then, in 3–5 plain sentences, explain my current position (how much I invested, current value, profit or loss) and what this position might look like after about ${projectionYears} years at roughly ${projectionRatePct}% annual return, making it clear that this is only an approximate scenario and not guaranteed. Use simple paragraphs and sentences, not markdown, headings, or numbered lists.
    `.trim()

    try {
      const res = await axios.post('/api/chat', {
        message,
      })
      setPredictionExplanation(res.data.answer)
    } catch (e: any) {
      setPredictionExplanation(
        'Sorry, I could not fetch an AI explanation right now. Please try again in a bit.',
      )
    } finally {
      setPredictionLoading(false)
    }
  }

  const COMMAND_INTENTS = ['add_expense', 'add_income', 'add_investment', 'add_loan', 'add_goal', 'remove_expense', 'subtract_expense', 'update_loan'] as const

  const EXPENSE_CATEGORIES = 'food|foot|rent|emi|travel|shopping|other'
  const categoryMap: Record<string, string> = { food: 'Food', foot: 'Food', rent: 'Rent', emi: 'EMI', travel: 'Travel', shopping: 'Shopping', other: 'Other' }

  function parseAmount(match: RegExpMatchArray): number {
    let amt = Number(match[1]) || 0
    const suffix = (match[2] || '').toLowerCase()
    if (suffix === 'k' || suffix === 'thousand') amt *= 1000
    else if (suffix === 'l' || suffix === 'lakh') amt *= 100000
    return amt
  }

  // Detect "add X in/to category" for expense (runs early so we show confirm card and update DB)
  function detectAddExpense(message: string): { intent: 'add_expense'; fields: { category: string; amount: number }; missing: string[]; reply: string } | null {
    const lower = message.toLowerCase()
    const addMatch =
      lower.match(new RegExp(`add\\s*(?:₹?\\s*)?(\\d+(?:\\.\\d+)?)\\s*(k|thousand|lakh|l)?\\s*(?:in|to|for)\\s*(?:the\\s*)?(${EXPENSE_CATEGORIES})(?:\\s*expense)?`, 'i'))
      ?? lower.match(new RegExp(`add\\s*(?:₹?\\s*)?(\\d+(?:\\.\\d+)?)\\s*(k|thousand|lakh|l)?\\s*(?:in|to|for)?\\s*(?:the\\s*)?(${EXPENSE_CATEGORIES})`, 'i'))
    if (!addMatch) return null
    const amt = parseAmount(addMatch)
    if (amt <= 0) return null
    const catRaw = (addMatch[3] || 'other').toLowerCase()
    const category = categoryMap[catRaw] ?? 'Other'
    return { intent: 'add_expense', fields: { category, amount: amt }, missing: [], reply: `I'll add ${category} expense ₹${amt.toLocaleString('en-IN')}. Confirm?` }
  }

  // Detect "subtract X from category" in message (runs first so we never send these to chat-only flow)
  function detectSubtractExpense(message: string): { intent: 'subtract_expense'; fields: { category: string; amount: number }; missing: string[]; reply: string } | null {
    const lower = message.toLowerCase()
    const actionWords = 'subtract|reduce|remove|deduct|cut|drop|take\\s+off|slash|trim|lower'
    let subtractMatch: RegExpMatchArray | null =
      lower.match(new RegExp(`(?:${actionWords})\\s*(?:₹?\\s*)?(\\d+(?:\\.\\d+)?)\\s*(k|thousand|lakh|l)?\\s*(?:from\\s*)?(?:the\\s*)?(${EXPENSE_CATEGORIES})(?:\\s*expense)?`, 'i'))
      ?? lower.match(new RegExp(`(?:${actionWords})\\s*(?:₹?\\s*)?(\\d+(?:\\.\\d+)?)\\s*(k|thousand|lakh|l)?\\s*(?:from\\s*)?(?:the\\s*)?(${EXPENSE_CATEGORIES})`, 'i'))
    if (!subtractMatch && new RegExp(EXPENSE_CATEGORIES).test(lower)) {
      const amountMatch = lower.match(new RegExp(`(?:${actionWords})\\s*(?:₹?\\s*)?(\\d+(?:\\.\\d+)?)\\s*(k|thousand|lakh|l)?(?:\\s|$|,)`, 'i'))
      const catMatch = lower.match(new RegExp(`(?:from\\s*the\\s*)?(${EXPENSE_CATEGORIES})(?:\\s*expense)?`, 'i'))
      if (amountMatch && catMatch) subtractMatch = [null as any, amountMatch[1], amountMatch[2] || '', catMatch[1]]
    }
    if (!subtractMatch) return null
    const amt = parseAmount(subtractMatch)
    const catRaw = (subtractMatch[3] || 'food').toLowerCase()
    const category = categoryMap[catRaw] ?? 'Food'
    if (amt <= 0) return null
    return { intent: 'subtract_expense', fields: { category, amount: amt }, missing: [], reply: `I'll reduce ${category} expense by ₹${amt.toLocaleString('en-IN')}. Confirm?` }
  }

  // Many ways to say "add X" / "update loan" — show card so chat never steals these
  const ADD_LOAN_PHRASES = [
    /(?:want\s+to|would\s+like\s+to|need\s+to|can\s+you|could\s+you|please|let\s+me|i\s+need\s+to)\s+add\s+(?:a\s+)?(?:new\s+)?(?:one\s+more\s+)?(?:my\s+)?(?:another\s+)?loan\b/i,
    /\badd\s+(?:a\s+)?(?:new\s+)?(?:one\s+more\s+|my\s+|another\s+)?loan\b/i,
    /\bcreate\s+(?:a\s+)?(?:new\s+)?loan\b/i,
    /\brecord\s+(?:a\s+)?(?:new\s+)?loan\b/i,
    /\bnew\s+loan\b/i,
    /\benter\s+(?:a\s+)?loan\b/i,
    /\bregister\s+(?:a\s+)?loan\b/i,
    /\bi\s+have\s+a\s+loan\s+to\s+add\b/i,
  ]
  const ADD_GOAL_PHRASES = [
    /(?:want\s+to|would\s+like\s+to|need\s+to|can\s+you|could\s+you|please|let\s+me|i\s+need\s+to)\s+add\s+(?:a\s+)?(?:new\s+)?(?:my\s+)?(?:one\s+more\s+)?(?:another\s+)?goal\b/i,
    /\badd\s+(?:a\s+)?(?:new\s+)?(?:my\s+|one\s+more\s+|another\s+)?goal\b/i,
    /\bcreate\s+(?:a\s+)?(?:new\s+)?goal\b/i,
    /\bset\s+(?:a\s+)?(?:new\s+)?(?:my\s+)?goal\b/i,
    /\brecord\s+(?:a\s+)?(?:new\s+)?goal\b/i,
    /\bnew\s+goal\b/i,
    /\benter\s+(?:a\s+)?goal\b/i,
    /\bi\s+want\s+to\s+set\s+a\s+goal\b/i,
  ]
  const ADD_EXPENSE_PHRASES = [
    /(?:want\s+to|need\s+to|can\s+you|please|let\s+me)\s+add\s+(?:a\s+)?(?:new\s+)?(?:an\s+)?expense\b/i,
    /\badd\s+(?:a\s+)?(?:new\s+)?(?:an\s+)?expense\b/i,
    /\bcreate\s+(?:a\s+)?(?:new\s+)?expense\b/i,
    /\brecord\s+(?:an?\s+)?expense\b/i,
    /\blog\s+(?:an?\s+)?expense\b/i,
    /\bnew\s+expense\b/i,
    /\benter\s+(?:an?\s+)?expense\b/i,
  ]
  const ADD_INCOME_PHRASES = [
    /(?:want\s+to|need\s+to|can\s+you|please|let\s+me)\s+add\s+(?:a\s+)?(?:new\s+)?(?:my\s+)?income\b/i,
    /\badd\s+(?:a\s+)?(?:new\s+)?(?:my\s+)?income\b/i,
    /\bcreate\s+(?:a\s+)?(?:new\s+)?income\b/i,
    /\brecord\s+(?:my\s+)?income\b/i,
    /\bnew\s+income\b/i,
    /\benter\s+(?:my\s+)?income\b/i,
  ]
  const ADD_INVESTMENT_PHRASES = [
    /(?:want\s+to|need\s+to|can\s+you|please|let\s+me)\s+add\s+(?:a\s+)?(?:new\s+)?(?:an\s+)?investment\b/i,
    /\badd\s+(?:a\s+)?(?:new\s+)?(?:an\s+)?investment\b/i,
    /\bcreate\s+(?:a\s+)?(?:new\s+)?investment\b/i,
    /\brecord\s+(?:an?\s+)?investment\b/i,
    /\bnew\s+investment\b/i,
    /\benter\s+(?:an?\s+)?investment\b/i,
    /\badd\s+(?:a\s+)?(?:new\s+)?(?:mutual\s+fund|stock|fund)\b/i,
  ]
  const UPDATE_LOAN_PHRASES = [
    /\bupdate\s+(?:my\s+)?loan\b/i,
    /\bchange\s+(?:my\s+)?loan\b/i,
    /\bedit\s+(?:my\s+)?loan\b/i,
    /\bmodify\s+(?:my\s+)?loan\b/i,
    /\bcorrect\s+(?:my\s+)?loan\b/i,
    /\bi\s+want\s+to\s+update\s+(?:my\s+)?loan\b/i,
  ]

  function detectGenericAdd(message: string): { intent: string; fields: Record<string, unknown>; missing: string[]; reply: string } | null {
    const lower = message.toLowerCase().trim()
    const checks: { patterns: RegExp[]; intent: string; missing: string[]; reply: string }[] = [
      { patterns: ADD_LOAN_PHRASES, intent: 'add_loan', missing: ['name', 'principal', 'emi'], reply: 'To add a loan, provide name, principal and EMI. Click Edit to fill the form, or reply with details.' },
      { patterns: ADD_EXPENSE_PHRASES, intent: 'add_expense', missing: ['category', 'amount'], reply: 'To add an expense, provide category and amount. Click Edit to fill the form, or reply with details.' },
      { patterns: ADD_INCOME_PHRASES, intent: 'add_income', missing: ['category', 'amount'], reply: 'To add income, provide category and amount. Click Edit to fill the form, or reply with details.' },
      { patterns: ADD_INVESTMENT_PHRASES, intent: 'add_investment', missing: ['name', 'buyPrice'], reply: 'To add an investment, provide name and amount invested. Click Edit to fill the form, or reply with details.' },
      { patterns: ADD_GOAL_PHRASES, intent: 'add_goal', missing: ['title', 'targetAmount'], reply: 'To add a goal, provide title and target amount. Click Edit to fill the form, or reply with details.' },
    ]
    for (const { patterns, intent, missing, reply } of checks) {
      if (patterns.some((p) => p.test(lower))) return { intent, fields: {}, missing, reply }
    }
    return null
  }

  function detectUpdateLoan(message: string): { intent: 'update_loan'; fields: Record<string, unknown>; missing: string[]; reply: string } | null {
    const lower = message.toLowerCase().trim()
    if (UPDATE_LOAN_PHRASES.some((p) => p.test(lower))) {
      return { intent: 'update_loan', fields: {}, missing: [], reply: 'Click Edit to open the loans section and choose which loan to update.' }
    }
    return null
  }

  // When user sends a follow-up message replying to an open command card (with missing fields), try to parse and complete it
  function tryCompleteCommandCard(
    card: { intent: string; fields: Record<string, unknown>; missing: string[]; reply: string },
    userMessage: string,
  ): { intent: string; fields: Record<string, unknown>; missing: string[]; reply: string } | null {
    const lower = userMessage.trim()
    const merged = { ...card.fields }
    let missing = [...(card.missing || [])]
    if (card.intent === 'add_goal') {
      // e.g. "for buying a car target amount is 10 lakh", "10 lakh for buying a car", "to buy a car" (title only)
      const amountMatch = lower.match(/(\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)\b/i)
      const targetAmount = amountMatch ? parseAmount(amountMatch) : (merged.targetAmount as number) || 0
      if (targetAmount > 0) merged.targetAmount = targetAmount
      const forTitleMatch = lower.match(/(?:for|goal|title)\s*[:\s]?\s*(.+?)\s+target\s+(?:amount\s+)?(?:is\s+)?\d/i)
      const afterTargetMatch = lower.match(/target\s+(?:amount\s+)?(?:is\s+)?(?:\d[\d,.\s]*(?:k|lakh|l)?)\s*(?:for|:)\s*(.+?)(?:\s*$|\.)/i)
      const beforeTargetMatch = lower.match(/(.+?)\s+target\s+(?:amount\s+)?(?:is\s+)?(\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)?/i)
      // "10 lakh for buying a car" or "target mod is 10 lakh for buying a car"
      const amountForTitleMatch = lower.match(/(?:\d+(?:\.\d+)?\s*(?:k|thousand|lakh|l)\s+)?for\s+(.+?)\s*$/i)
      let title = (forTitleMatch?.[1] ?? afterTargetMatch?.[1] ?? amountForTitleMatch?.[1] ?? beforeTargetMatch?.[1] ?? '').trim()
      if (!title) {
        const amtPart = lower.match(/(.+?)\s+(\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)?\s*$/)
        if (amtPart) {
          title = amtPart[1]
            .replace(/\s+with\s+the\s+amount\s+of\s*$/i, '')
            .replace(/\s+amount\s+is\s*$/i, '')
            .replace(/\s+target\s+(?:amount\s+)?(?:is\s+)?\s*$/i, '')
            .replace(/\s+(?:of|is)\s*$/i, '')
            .replace(/\b(?:target|mod|lakh|rupees?|rs\.?)\b/gi, '')
            .trim()
        }
      }
      // When only title is missing, treat the whole message as title (e.g. "to buy a car")
      const onlyMissingTitle = (card.missing?.length === 1 && card.missing?.includes('title')) || ((card.missing?.length ?? 0) > 0 && !amountMatch && merged.targetAmount && Number(merged.targetAmount) > 0)
      if (!title && onlyMissingTitle && lower.length > 0 && lower.length < 120) {
        title = lower.replace(/^\s*(?:to|for|goal\s*[:\s]*)\s*/i, '').replace(/\s*\.\s*$/, '').trim()
      }
      if (title) {
        if (title.toLowerCase().startsWith('for ')) title = title.slice(4).trim()
        merged.title = title.replace(/\s+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
      }
      missing = []
      if (!merged.title || (merged.title as string) === '') missing.push('title')
      if (!merged.targetAmount || Number(merged.targetAmount) <= 0) missing.push('targetAmount')
      // Allow updating card even when it was already complete (e.g. user correcting the title)
      const prevMissingLen = card.missing?.length ?? 0
      const hadMissing = prevMissingLen > 0
      const improved = hadMissing ? missing.length < prevMissingLen : (!!title && title !== (card.fields.title as string)) || (targetAmount > 0 && targetAmount !== Number(card.fields.targetAmount))
      if (!improved && hadMissing && missing.length === prevMissingLen) return null
      const reply =
        missing.length === 0
          ? `I'll add goal "${merged.title}" with target ₹${Number(merged.targetAmount).toLocaleString('en-IN')}. Confirm?`
          : `Still need: ${missing.join(', ')}. Click Edit or reply with details.`
      return { intent: card.intent, fields: merged, missing, reply }
    }
    if (card.intent === 'add_loan') {
      const nameMatch = lower.match(/(?:name|loan)\s*[:\s]?\s*([a-z\s]+?)(?:\s+principal|\s+amount|\s+emi|$)/i)
      const principalMatch = lower.match(/(?:principal|amount)\s*[:\s]?\s*(\d[\d,.\s]*)\s*(k|lakh|l)?/i)
      const emiMatch = lower.match(/emi\s*[:\s]?\s*(\d[\d,.\s]*)\s*(k|lakh|l)?/i)
      if (nameMatch?.[1]?.trim()) merged.name = nameMatch[1].trim().replace(/\s+/g, ' ')
      if (principalMatch) {
        const amt = parseAmount([null as any, principalMatch[1].replace(/\s/g, ''), principalMatch[2] || ''])
        if (amt > 0) merged.principal = amt
      }
      if (emiMatch) {
        const amt = parseAmount([null as any, emiMatch[1].replace(/\s/g, ''), emiMatch[2] || ''])
        if (amt > 0) merged.emi = amt
      }
      missing = []
      if (!merged.name || String(merged.name).trim() === '') missing.push('name')
      if (!merged.principal || Number(merged.principal) <= 0) missing.push('principal')
      if (!merged.emi || Number(merged.emi) <= 0) missing.push('emi')
      if (missing.length === (card.missing?.length ?? 0)) return null
      const reply = missing.length === 0 ? `I'll add loan "${merged.name}". Confirm?` : `Still need: ${missing.join(', ')}. Click Edit or reply with details.`
      return { intent: card.intent, fields: merged, missing, reply }
    }
    if (card.intent === 'add_expense' || card.intent === 'add_income') {
      const catMatch = lower.match(/(?:category|type)\s*[:\s]?\s*(food|rent|emi|travel|shopping|other|salary|bonus)/i)
      const amtMatch = lower.match(/(?:amount|rs\.?|₹)\s*[:\s]?\s*(\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)?/i) ?? lower.match(/(\d+(?:\.\d+)?)\s*(k|thousand|lakh|l)?\s*(?:rupees?|rs\.?|₹)?/i)
      if (catMatch) merged.category = categoryMap[catMatch[1].toLowerCase()] ?? catMatch[1]
      if (amtMatch) {
        const amt = parseAmount(amtMatch)
        if (amt > 0) merged.amount = amt
      }
      missing = []
      if (!merged.category) missing.push('category')
      if (!merged.amount || Number(merged.amount) <= 0) missing.push('amount')
      if (missing.length === (card.missing?.length ?? 0)) return null
      const reply = missing.length === 0 ? `I'll add ${card.intent === 'add_expense' ? 'expense' : 'income'} ${merged.category} ₹${Number(merged.amount).toLocaleString('en-IN')}. Confirm?` : `Still need: ${missing.join(', ')}. Click Edit or reply with details.`
      return { intent: card.intent, fields: merged, missing, reply }
    }
    if (card.intent === 'add_investment') {
      const nameMatch = lower.match(/(?:name|fund|stock)\s*[:\s]?\s*([a-z0-9\s]+?)(?:\s+amount|\s+invested|$)/i)
      const amtMatch = lower.match(/(?:amount|invested|rs\.?|₹)\s*[:\s]?\s*(\d+(?:\.\d+)?)\s*(k|lakh|l)?/i) ?? lower.match(/(\d+(?:\.\d+)?)\s*(k|lakh|l)?/i)
      if (nameMatch?.[1]?.trim()) merged.name = nameMatch[1].trim().replace(/\s+/g, ' ')
      if (amtMatch) {
        const amt = parseAmount(amtMatch)
        if (amt > 0) merged.buyPrice = amt
      }
      missing = []
      if (!merged.name || String(merged.name).trim() === '') missing.push('name')
      if (!merged.buyPrice && !merged.investedAmount) missing.push('buyPrice')
      else if (merged.buyPrice) merged.investedAmount = merged.buyPrice
      if (missing.length === (card.missing?.length ?? 0)) return null
      const reply = missing.length === 0 ? `I'll add investment "${merged.name}" ₹${Number(merged.buyPrice ?? merged.investedAmount).toLocaleString('en-IN')}. Confirm?` : `Still need: ${missing.join(', ')}. Click Edit or reply with details.`
      return { intent: card.intent, fields: merged, missing, reply }
    }
    return null
  }

  const handleChatSend = async (voiceMessage?: string) => {
    const userMessage = (voiceMessage ?? chatInput.trim()).trim()
    if (!userMessage || !summary) return
    if (!voiceMessage) setChatInput('')

    // If last message was an open command card (not yet confirmed/cancelled), try to complete or correct it with this message
    const lastMsg = chatMessages[chatMessages.length - 1]
    if (lastMsg?.role === 'assistant' && lastMsg.commandCard && !lastMsg.confirmed && !lastMsg.cancelled) {
      const completed = tryCompleteCommandCard(lastMsg.commandCard, userMessage)
      if (completed) {
        setChatMessages((m) => [
          ...m,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: completed.reply, commandCard: completed },
        ])
        setChatLoading(false)
        return
      }
    }

    setChatMessages((m) => [...m, { role: 'user', content: userMessage }])
    setChatLoading(true)

    // Run command detection FIRST so we show confirm card and update DB; parser is fallback
    const subtractCmd = detectSubtractExpense(userMessage)
    if (subtractCmd) {
      setChatMessages((m) => [...m, { role: 'assistant', content: subtractCmd.reply, commandCard: subtractCmd }])
      setChatLoading(false)
      return
    }
    const addExpenseCmd = detectAddExpense(userMessage)
    if (addExpenseCmd) {
      setChatMessages((m) => [...m, { role: 'assistant', content: addExpenseCmd.reply, commandCard: addExpenseCmd }])
      setChatLoading(false)
      return
    }
    const genericAddCmd = detectGenericAdd(userMessage)
    if (genericAddCmd) {
      setChatMessages((m) => [...m, { role: 'assistant', content: genericAddCmd.reply, commandCard: genericAddCmd }])
      setChatLoading(false)
      return
    }
    const updateLoanCmd = detectUpdateLoan(userMessage)
    if (updateLoanCmd) {
      setChatMessages((m) => [...m, { role: 'assistant', content: updateLoanCmd.reply, commandCard: updateLoanCmd }])
      setChatLoading(false)
      return
    }

    try {
      const parseRes = await axios.post<{ intent: string; fields?: Record<string, unknown>; missing?: string[]; reply?: string }>(
        '/api/chat/parse-command',
        { message: userMessage },
      )
      const intent = String(parseRes.data?.intent ?? 'chat')
      const fields = parseRes.data?.fields ?? {}
      const missing = Array.isArray(parseRes.data?.missing) ? parseRes.data.missing : []
      const reply = String(parseRes.data?.reply ?? '')

      if (COMMAND_INTENTS.includes(intent as any)) {
        setChatMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: reply || 'Confirm?',
            commandCard: { intent, fields, missing, reply: reply || 'Confirm?' },
          },
        ])
        setChatLoading(false)
        return
      }
    } catch (_) {
      // fall through to normal chat
    }

    const k = summary.KPIs
    const contextParts: string[] = [
      `Summary: Net worth ₹${Math.round(Number(k.netWorth) || 0).toLocaleString('en-IN')}, Investments (current) ₹${Math.round(Number(k.totalCurrent) || 0).toLocaleString('en-IN')}, Monthly savings ₹${Math.round(Number(k.monthlySavings) || 0).toLocaleString('en-IN')}, Income ₹${Math.round(Number(k.totalIncome) || 0).toLocaleString('en-IN')}, Total expenses (incl. loan EMIs) ₹${Math.round(Number(k.totalExpensesIncludingEmi) || (Number(k.totalExpenses) || 0) + (Number(k.totalLoanEmi) || 0)).toLocaleString('en-IN')}, Loan EMIs ₹${Math.round(Number(k.totalLoanEmi) || 0).toLocaleString('en-IN')}, Outstanding loans ₹${Math.round(Number(k.totalLoanPrincipal) || 0).toLocaleString('en-IN')}${k.totalHomeAssetValue > 0 ? `, Home asset (est.) ₹${Math.round(Number(k.totalHomeAssetValue) || 0).toLocaleString('en-IN')}` : ''}.`,
      `Loans (${summary.loans.length}): ${summary.loans.map((l) => `${l.name} principal ₹${Math.round(l.principal).toLocaleString('en-IN')} outstanding ₹${Math.round(l.remainingPrincipal ?? l.principal).toLocaleString('en-IN')} EMI ₹${Math.round(l.emi).toLocaleString('en-IN')} ${l.interest}% ${l.tenure}mo left`).join('; ') || 'None'}.`,
      `Investments (${summary.investments.length}): ${summary.investments.map((inv) => {
        const base = `${inv.name} invested ₹${Math.round(inv.buyPrice).toLocaleString('en-IN')} current ₹${Math.round(inv.buyPrice + inv.profit).toLocaleString('en-IN')} profit ₹${Math.round(inv.profit).toLocaleString('en-IN')}`
        const sip = inv.monthlySip != null && inv.monthlySip > 0 ? ` monthly SIP ₹${Math.round(inv.monthlySip).toLocaleString('en-IN')}` : ''
        return base + sip
      }).join('; ') || 'None'}.`,
      `Expenses: ${summary.expenses.map((e) => `${e.category} ₹${Math.round(e.amount).toLocaleString('en-IN')}`).join(', ') || 'None'}.`,
      `Income: ${summary.incomes.map((i) => `${i.category} ₹${Math.round(i.amount).toLocaleString('en-IN')}`).join(', ') || 'None'}.`,
    ]
    const contextSummary = contextParts.join(' ')
    const history = chatMessages.slice(-20)

    try {
      await axios.post('/api/chat/messages', { messages: [{ role: 'user', content: userMessage }] })
      const res = await axios.post('/api/chat', {
        message: userMessage,
        contextSummary,
        history,
        provider: chatProvider,
      })
      const answer = res.data.answer ?? 'Sorry, I could not generate a response.'
      const provider = res.data.provider
      const newMessageIdx = chatMessages.length + 1
      setChatMessages((m) => [...m, { role: 'assistant', content: answer, provider }])
      await axios.post('/api/chat/messages', { messages: [{ role: 'assistant', content: answer }] })
      if (autoSpeakResponse && typeof window !== 'undefined' && window.speechSynthesis) {
        setTimeout(() => speakResponse(answer, newMessageIdx), 300)
      }
    } catch (e: any) {
      setChatMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: e?.response?.data?.error ?? 'Sorry, I could not reach the AI service. Please try again.',
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  const handleCommandConfirm = async (msgIdx: number) => {
    const msg = chatMessages[msgIdx]
    const card = msg?.commandCard
    if (!card || msg.confirmed || msg.cancelled) return
    const intent = card.intent
    if (intent === 'update_loan') return // update_loan has no Confirm action; user uses Edit
    const f = card.fields

    setConfirmingCommandIdx(msgIdx)
    const num = (v: unknown) => (typeof v === 'number' ? v : Number(String(v).replace(/,/g, '')) || 0)
    const str = (v: unknown) => (v != null ? String(v) : '')

    try {
      if (intent === 'add_expense') {
        await axios.post('/api/expenses', {
          category: str(f.category) || 'Other',
          amount: num(f.amount),
        })
      } else if (intent === 'add_income') {
        await axios.post('/api/incomes', {
          category: str(f.category) || 'Salary',
          amount: num(f.amount),
        })
      } else if (intent === 'add_investment') {
        const buyPrice = num(f.buyPrice ?? f.investedAmount)
        await axios.post('/api/investments', {
          type: (str(f.type) || 'STOCK').toUpperCase().replace(/\s/g, '_') || 'STOCK',
          symbol: str(f.symbol),
          name: str(f.name) || 'Investment',
          buyPrice,
          profit: num(f.profit),
          buyDate: new Date().toISOString(),
          monthlySip: f.monthlySip != null ? num(f.monthlySip) : null,
        })
      } else if (intent === 'add_loan') {
        const tenure = f.tenure != null ? num(f.tenure) : (f.totalTenureMonths != null ? num(f.totalTenureMonths) : 60)
        await axios.post('/api/loans', {
          name: str(f.name) || 'Loan',
          principal: num(f.principal),
          interest: num(f.interest) ?? 10,
          tenure,
          totalTenureMonths: f.totalTenureMonths != null ? num(f.totalTenureMonths) : null,
          emi: num(f.emi),
          startDate: new Date().toISOString(),
        })
      } else if (intent === 'add_goal') {
        await axios.post('/api/goals', {
          title: str(f.title) || 'Goal',
          targetAmount: num(f.targetAmount),
          currentAmount: num(f.currentAmount) ?? 0,
          targetDate: f.targetDate ? new Date(str(f.targetDate)).toISOString() : null,
        })
      } else if (intent === 'remove_expense') {
        const category = str(f.category)
        const amount = num(f.amount)
        if (!summary?.expenses?.length) {
          setChatMessages((m) =>
            m.map((x, i) =>
              i === msgIdx
                ? { ...x, content: 'No expenses found to remove.', commandCard: undefined }
                : x,
            ),
          )
          return
        }
        const match = summary.expenses.find(
          (e) => e.category === category && Math.round(Number(e.amount)) === Math.round(amount),
        )
        const toDelete = match ?? summary.expenses.find((e) => e.category === category)
        if (!toDelete) {
          setChatMessages((m) =>
            m.map((x, i) =>
              i === msgIdx
                ? { ...x, content: `No matching expense found for ${category} ₹${amount.toLocaleString('en-IN')}.`, commandCard: undefined }
                : x,
            ),
          )
          return
        }
        await axios.delete(`/api/expenses/${toDelete.id}`)
      } else if (intent === 'subtract_expense') {
        const category = str(f.category)
        const amount = num(f.amount)
        if (!summary?.expenses?.length) {
          setChatMessages((m) =>
            m.map((x, i) =>
              i === msgIdx
                ? { ...x, content: 'No expenses found to reduce.', commandCard: undefined }
                : x,
            ),
          )
          return
        }
        const categoryExpenses = summary.expenses
          .filter((e) => e.category === category)
          .sort((a, b) => Number(b.amount) - Number(a.amount))
        const toReduce = categoryExpenses.find((e) => Number(e.amount) >= amount)
        if (!toReduce) {
          setChatMessages((m) =>
            m.map((x, i) =>
              i === msgIdx
                ? { ...x, content: `No ${category} expense of ₹${amount.toLocaleString('en-IN')} or more to reduce.`, commandCard: undefined }
                : x,
            ),
          )
          return
        }
        const currentAmount = Number(toReduce.amount)
        const newAmount = currentAmount - amount
        if (newAmount <= 0) {
          await axios.delete(`/api/expenses/${toReduce.id}`)
        } else {
          await axios.patch(`/api/expenses/${toReduce.id}`, {
            category: toReduce.category,
            amount: newAmount,
          })
        }
      } else {
        setChatLoading(false)
        return
      }
      await loadSummary()
      if (intent === 'add_goal') await loadGoals()
      setChatMessages((m) =>
        m.map((x, i) =>
          i === msgIdx ? { ...x, confirmed: true, content: 'Done.', commandCard: undefined } : x,
        ),
      )
    } catch (e: any) {
      setChatMessages((m) =>
        m.map((x, i) =>
          i === msgIdx
            ? { ...x, content: e?.response?.data?.error ?? 'Failed. Try again or use the form.', commandCard: undefined }
            : x,
        ),
      )
    } finally {
      setConfirmingCommandIdx(null)
    }
  }

  const handleCommandEdit = (msgIdx: number) => {
    const msg = chatMessages[msgIdx]
    const card = msg?.commandCard
    if (!card || msg.confirmed || msg.cancelled) return
    const f = card.fields
    const str = (v: unknown) => (v != null ? String(v) : '')
    const num = (v: unknown) => (typeof v === 'number' ? v : Number(String(v).replace(/,/g, '')) || 0)

    if (card.intent === 'add_expense') {
      setNewExpense({ category: str(f.category) || 'Food', amount: num(f.amount) ? String(f.amount) : '' })
      document.getElementById('section-expense')?.scrollIntoView({ behavior: 'smooth' })
    } else if (card.intent === 'add_income') {
      setNewIncome({ category: str(f.category) || 'Salary', amount: num(f.amount) ? String(f.amount) : '' })
      document.getElementById('section-income')?.scrollIntoView({ behavior: 'smooth' })
    } else if (card.intent === 'add_investment') {
      setNewInvestment({
        type: (str(f.type) || 'STOCK').toUpperCase().replace(/\s/g, '_') || 'STOCK',
        symbol: str(f.symbol),
        name: str(f.name),
        investedAmount: num(f.buyPrice ?? f.investedAmount) ? String(f.buyPrice ?? f.investedAmount) : '',
        profit: f.profit != null ? String(f.profit) : '',
        monthlySip: f.monthlySip != null ? String(f.monthlySip) : '',
      })
      document.getElementById('section-investment')?.scrollIntoView({ behavior: 'smooth' })
    } else if (card.intent === 'add_loan') {
      setNewLoan({
        name: str(f.name),
        principal: num(f.principal) ? String(f.principal) : '',
        interest: num(f.interest) ? String(f.interest) : '',
        monthsPaid: '',
        totalTenureMonths: f.totalTenureMonths != null ? String(f.totalTenureMonths) : '',
        emi: num(f.emi) ? String(f.emi) : '',
      })
      document.getElementById('section-loan')?.scrollIntoView({ behavior: 'smooth' })
    } else if (card.intent === 'add_goal') {
      setNewGoal({
        title: str(f.title),
        targetAmount: num(f.targetAmount) ? String(f.targetAmount) : '',
        currentAmount: f.currentAmount != null ? String(f.currentAmount) : '0',
        targetDate: f.targetDate ? str(f.targetDate).slice(0, 10) : '',
      })
      document.getElementById('section-goal')?.scrollIntoView({ behavior: 'smooth' })
    } else if (card.intent === 'remove_expense' || card.intent === 'subtract_expense') {
      setShowExpenseListModal(true)
    } else if (card.intent === 'update_loan') {
      setTimeout(() => document.getElementById('section-loans-list')?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  const handleCommandCancel = (msgIdx: number) => {
    setChatMessages((m) =>
      m.map((x, i) =>
        i === msgIdx ? { ...x, cancelled: true, content: 'Cancelled.', commandCard: undefined } : x,
      ),
    )
  }

  const portfolioAllocationData = useMemo(() => {
    if (!summary) return []
    const byCategory = new Map<string, number>()
    summary.investments.forEach((inv) => {
      const key = inv.type
      const value = inv.buyPrice + inv.profit
      byCategory.set(key, (byCategory.get(key) ?? 0) + value)
    })
    return Array.from(byCategory.entries()).map(([name, value]) => ({
      name,
      value,
    }))
  }, [summary])

  const expenseByCategoryData = useMemo(() => {
    if (!summary) return []
    const byCategory = new Map<string, number>()
    summary.expenses.forEach((e) => {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount)
    })
    return Array.from(byCategory.entries()).map(([name, value]) => ({
      name,
      value,
    }))
  }, [summary])

  const simpleProjectionData = useMemo(() => {
    if (!summary) return []
    const years = 10
    const rate = 0.1
    const data = []
    let value = summary.KPIs.netWorth
    for (let year = 1; year <= years; year++) {
      value = (value + summary.KPIs.monthlySavings * 12) * (1 + rate)
      data.push({ year: `${year}`, value: Math.round(value) })
    }
    return data
  }, [summary])

  const investmentRows = useMemo(() => {
    if (!summary) return []
    return summary.investments.map((inv) => {
      const invested = inv.buyPrice
      const current = inv.buyPrice + inv.profit
      const profit = current - invested
      return {
        ...inv,
        invested,
        currentValue: current,
        profit,
      }
    })
  }, [summary])

  const totalMonthlySip = useMemo(
    () => investmentRows.reduce((s, inv) => s + (inv.monthlySip ?? 0), 0),
    [investmentRows],
  )

  const monthlyBalance = useMemo(() => {
    if (!summary) return 0
    return summary.KPIs.monthlySavings - totalMonthlySip
  }, [summary, totalMonthlySip])

  const projectionRate = projectionRatePct / 100

  const selectedInvestment = useMemo(() => {
    if (!investmentRows.length) return null
    return (
      investmentRows.find((inv) => inv.id === selectedInvestmentId) ??
      investmentRows[0]
    )
  }, [investmentRows, selectedInvestmentId])

  const investmentProjectionData = useMemo(() => {
    if (!selectedInvestment) return []
    const data = []
    let value = selectedInvestment.currentValue
    for (let year = 1; year <= projectionYears; year++) {
      value = value * (1 + projectionRate)
      data.push({ year: `${year}`, value: Math.round(value) })
    }
    return data
  }, [selectedInvestment, projectionYears, projectionRate])

  const homeAppreciationRate = homeAppreciationRatePct / 100
  const homeAppreciationProjectionData = useMemo(() => {
    if (!homePredictionModalLoan) return []
    const data = [{ year: '0', value: Math.round(homePredictionModalLoan.principal) }]
    let value = homePredictionModalLoan.principal
    for (let year = 1; year <= homeAppreciationYears; year++) {
      value = value * (1 + homeAppreciationRate)
      data.push({ year: `${year}`, value: Math.round(value) })
    }
    return data
  }, [homePredictionModalLoan, homeAppreciationYears, homeAppreciationRate])

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h1>Wealth Dashboard</h1>
        <p>{status === 'loading' ? 'Loading…' : 'Redirecting to sign in…'}</p>
      </div>
    )
  }

  if (loading && !summary) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Wealth Dashboard</h1>
        <p>Loading your data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Wealth Dashboard</h1>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 20px',
            background: '#333',
            color: '#fff',
            borderRadius: 8,
            zIndex: 9999,
            fontSize: 14,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {toast}
        </div>
      )}
      <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ margin: 0 }}>AI-Powered Wealth Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {session?.user?.email && (
              <span style={{ fontSize: 13, color: '#666' }}>{session.user.email}</span>
            )}
            <a
              href="/api/export?format=csv"
              download="wealth-export.csv"
              style={{
                fontSize: 13,
                padding: '6px 12px',
                background: '#0b8457',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              Export CSV
            </a>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              style={{
                fontSize: 13,
                padding: '6px 12px',
                background: '#eee',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {summary && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 16,
            }}
          >
            <KpiCard
              title="Net Worth"
              value={summary.KPIs.netWorth}
              prefix="₹"
            />
            <KpiCard
              title="Total Investments"
              value={summary.KPIs.totalCurrent}
              prefix="₹"
            />
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid #eee',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: 12, color: '#666' }}>Total Income (monthly)</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                ₹{(Number(summary.KPIs.totalIncome) || 0).toLocaleString('en-IN')}
              </div>
              <button
                type="button"
                onClick={() => setShowIncomeListModal(true)}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  padding: '4px 10px',
                  background: 'none',
                  color: '#0070f3',
                  border: '1px solid #0070f3',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                View list
              </button>
            </div>
            <div
              id="section-expenses-list"
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid #eee',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: 12, color: '#666' }}>Total Expenses (incl. loan EMIs)</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                ₹{(typeof summary.KPIs.totalExpensesIncludingEmi === 'number' ? summary.KPIs.totalExpensesIncludingEmi : (summary.KPIs.totalExpenses ?? 0) + (summary.KPIs.totalLoanEmi ?? 0)).toLocaleString('en-IN')}
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseListModal(true)}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  padding: '4px 10px',
                  background: 'none',
                  color: '#0070f3',
                  border: '1px solid #0070f3',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                View list
              </button>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid #eee',
                background: '#fff',
              }}
            >
              <div style={{ fontSize: 12, color: '#666' }}>Monthly balance</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                ₹{(Number.isFinite(monthlyBalance) ? Math.round(monthlyBalance) : 0).toLocaleString('en-IN')}
              </div>
              <button
                type="button"
                onClick={() => setShowSavingsDetails(true)}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  padding: '4px 10px',
                  background: 'none',
                  color: '#0070f3',
                  border: '1px solid #0070f3',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                View details
              </button>
            </div>
            {summary.KPIs.totalHomeAssetValue > 0 && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: '1px solid #eee',
                  background: '#fff',
                }}
              >
                <div style={{ fontSize: 12, color: '#666' }}>Home asset (est.)</div>
                <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                  ₹{Math.round(summary.KPIs.totalHomeAssetValue).toLocaleString('en-IN')}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const first = summary.loans.find(isHomeLoan)
                    if (first) openHomePredictionModal(first)
                  }}
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    padding: '4px 10px',
                    background: '#6f42c1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Predict
                </button>
              </div>
            )}
            <div
              id="section-goals-list"
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid #eee',
                background: '#fff',
                scrollMarginTop: 16,
              }}
            >
              <div style={{ fontSize: 12, color: '#666' }}>Goals</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
                {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
              </div>
              <button
                type="button"
                onClick={() => setShowGoalsListModal(true)}
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  padding: '4px 10px',
                  background: 'none',
                  color: '#0070f3',
                  border: '1px solid #0070f3',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                View list
              </button>
            </div>
            <LoansKpiCard
              loans={summary.loans}
              totalPrincipal={summary.KPIs.totalLoanPrincipal}
            />
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 24,
          }}
        >
          <ChartCard title="Portfolio Allocation">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={portfolioAllocationData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {portfolioAllocationData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Expense Breakdown">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={expenseByCategoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Projected Net Worth (10 years)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={simpleProjectionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#82ca9d"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {investmentRows.length > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              border: '1px solid #eee',
              background: '#fff',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <div>
                <h2 style={{ fontSize: 16, margin: 0 }}>Investments</h2>
                <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0' }}>
                  Amounts are total invested (lump sum). Add optional Monthly SIP to track ongoing contributions.
                  {(() => {
                    const totalSip = investmentRows.reduce((s, inv) => s + (inv.monthlySip ?? 0), 0)
                    return totalSip > 0 ? ` Total monthly SIP: ₹${Math.round(totalSip).toLocaleString('en-IN')}` : ''
                  })()}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <div>
                  <label>
                    Years:&nbsp;
                    <strong>{projectionYears}</strong>
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={30}
                    value={projectionYears}
                    onChange={(e) => setProjectionYears(Number(e.target.value))}
                    style={{ width: 120, display: 'block' }}
                  />
                </div>
                <div>
                  <label>
                    Expected return:&nbsp;
                    <strong>{projectionRatePct}%</strong>
                  </label>
                  <input
                    type="range"
                    min={4}
                    max={18}
                    value={projectionRatePct}
                    onChange={(e) => setProjectionRatePct(Number(e.target.value))}
                    style={{ width: 120, display: 'block' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                  marginBottom: 12,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 6 }}>Name</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Symbol</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Invested</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Current</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Profit</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>SIP/mo</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Buy Date</th>
                    <th style={{ textAlign: 'center', padding: 6 }}>Prediction</th>
                    <th style={{ textAlign: 'center', padding: 6 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {investmentRows.map((inv) => {
                    const isSelected =
                      selectedInvestment && selectedInvestment.id === inv.id
                    return (
                      <tr
                        key={inv.id}
                        style={{
                          backgroundColor: isSelected ? '#f0f4ff' : 'transparent',
                        }}
                      >
                        <td style={{ padding: 6 }}>{inv.name}</td>
                        <td style={{ padding: 6 }}>{inv.symbol ?? '-'}</td>
                        <td style={{ padding: 6, textAlign: 'right' }}>
                          ₹{Math.round(inv.invested).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: 6, textAlign: 'right' }}>
                          ₹{Math.round(inv.currentValue).toLocaleString('en-IN')}
                        </td>
                        <td
                          style={{
                            padding: 6,
                            textAlign: 'right',
                            color: inv.profit >= 0 ? '#0b8457' : '#c92a2a',
                          }}
                        >
                          ₹{Math.round(inv.profit).toLocaleString('en-IN')}
                        </td>
                        <td style={{ padding: 6, textAlign: 'right' }}>
                          {inv.monthlySip != null && inv.monthlySip > 0
                            ? `₹${Math.round(inv.monthlySip).toLocaleString('en-IN')}`
                            : '–'}
                        </td>
                        <td style={{ padding: 6 }}>
                          {new Date(inv.buyDate).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td style={{ padding: 6, textAlign: 'center' }}>
                          <button
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            type="button"
                            onClick={() => void handlePredictInvestment(inv)}
                          >
                            Predict
                          </button>
                        </td>
                        <td style={{ padding: 6, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              style={{
                                fontSize: 11,
                                padding: '4px 8px',
                                background: '#28a745',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                              type="button"
                              onClick={() => openEditInvestmentModal(inv)}
                            >
                              Update
                            </button>
                            <button
                              style={{
                                fontSize: 11,
                                padding: '4px 8px',
                                color: '#c92a2a',
                              }}
                              type="button"
                              onClick={() => void handleDeleteInvestment(inv.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {selectedInvestment && investmentProjectionData.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <ChartCard
                  title={`Projection for ${selectedInvestment.name} (${projectionYears} years @ ${projectionRatePct}% p.a.)`}
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={investmentProjectionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#ff7300"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
                <div style={{ marginTop: 8, fontSize: 12, color: '#333' }}>
                  {predictionLoading && <p>Asking AI to explain this position…</p>}
                  {!predictionLoading && predictionExplanation && (
                    <div>
                      <strong>AI view on this investment</strong>
                      <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                        {predictionExplanation}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {summary && summary.loans.length > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              border: '1px solid #eee',
              background: '#fff',
            }}
          >
            <div id="section-loans-list" style={{ scrollMarginTop: 16 }}>
            <h2 style={{ fontSize: 16, margin: 0, marginBottom: 8 }}>Loans</h2>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 8px 0' }}>
              Click <strong>Plan payoff</strong> on a loan to see how to close it sooner and save interest.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 6 }}>Name</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Principal</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Outstanding</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Interest %</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>EMI</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Total (months)</th>
                    <th style={{ textAlign: 'right', padding: 6 }}>Months paid</th>
                    <th style={{ textAlign: 'left', padding: 6 }}>Start Date</th>
                    <th
                      style={{
                        textAlign: 'center',
                        padding: 6,
                        position: 'sticky',
                        right: 0,
                        background: '#fff',
                        minWidth: 180,
                        boxShadow: '-4px 0 8px rgba(0,0,0,0.06)',
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.loans.map((loan) => (
                    <tr key={loan.id}>
                      <td style={{ padding: 6 }}>{loan.name}</td>
                      <td style={{ padding: 6, textAlign: 'right' }}>
                        ₹{Math.round(loan.principal).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: 6, textAlign: 'right' }}>
                        ₹{Math.round(loan.remainingPrincipal ?? loan.principal).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: 6, textAlign: 'right' }}>
                        {loan.interest.toFixed(2)}
                      </td>
                      <td style={{ padding: 6, textAlign: 'right' }}>
                        ₹{Math.round(loan.emi).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: 6, textAlign: 'right' }}>
                        {loan.totalTenureMonths != null ? loan.totalTenureMonths : '–'}
                      </td>
                      <td style={{ padding: 6, textAlign: 'right' }}>
                        {loan.totalTenureMonths != null
                          ? loan.totalTenureMonths - loan.tenure
                          : '–'}
                      </td>
                      <td style={{ padding: 6 }}>
                        {new Date(
                          loan.startDate ?? new Date(),
                        ).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td
                        style={{
                          padding: 6,
                          textAlign: 'center',
                          position: 'sticky',
                          right: 0,
                          background: '#fff',
                          minWidth: 180,
                          boxShadow: '-4px 0 8px rgba(0,0,0,0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={{
                              fontSize: 12,
                              padding: '6px 12px',
                              background: '#28a745',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                            onClick={() => openEditLoanModal(loan)}
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            style={{
                              fontSize: 12,
                              padding: '6px 12px',
                              background: '#0070f3',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                            onClick={() => openPayoffModal(loan)}
                          >
                            Plan payoff
                          </button>
                          <button
                            type="button"
                            style={{
                              fontSize: 12,
                              padding: '6px 12px',
                              background: '#dc3545',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                            onClick={() => window.confirm('Delete this loan?') && handleDeleteLoan(loan.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 24,
          }}
        >
          <div id="section-investment">
          <FormCard title="Add Investment">
            <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px' }}>
              Enter <strong>total amount invested</strong> (lump sum). Use <strong>Monthly SIP</strong> for SIP (stocks/MF) or <strong>monthly chit subscription</strong> (chit funds). Used in Net Worth and Total Investments.
            </p>
            <form onSubmit={handleAddInvestment} style={{ display: 'grid', gap: 8 }}>
              <select
                value={newInvestment.type}
                onChange={(e) =>
                  setNewInvestment((v) => ({ ...v, type: e.target.value }))
                }
              >
                <option value="STOCK">Stock</option>
                <option value="MUTUAL_FUND">Mutual Fund</option>
                <option value="CHIT_FUND">Chit fund</option>
                <option value="OTHER">Other</option>
              </select>
              <input
                placeholder="Symbol (e.g. TCS)"
                value={newInvestment.symbol}
                onChange={(e) =>
                  setNewInvestment((v) => ({ ...v, symbol: e.target.value }))
                }
              />
              <input
                placeholder="Name"
                value={newInvestment.name}
                onChange={(e) =>
                  setNewInvestment((v) => ({ ...v, name: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="Total invested (₹, lump sum)"
                value={newInvestment.investedAmount}
                onChange={(e) =>
                  setNewInvestment((v) => ({
                    ...v,
                    investedAmount: e.target.value,
                  }))
                }
              />
              <input
                type="number"
                placeholder="Current profit (₹, can be negative)"
                value={newInvestment.profit}
                onChange={(e) =>
                  setNewInvestment((v) => ({
                    ...v,
                    profit: e.target.value,
                  }))
                }
              />
              <input
                type="number"
                placeholder={newInvestment.type === 'CHIT_FUND' ? 'Monthly chit (₹, optional)' : 'Monthly SIP (₹, optional)'}
                value={newInvestment.monthlySip}
                onChange={(e) =>
                  setNewInvestment((v) => ({ ...v, monthlySip: e.target.value }))
                }
              />
              <button type="submit">Save</button>
            </form>
          </FormCard>
          </div>

          <div id="section-income">
          <FormCard title="Add Income (monthly)">
            <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px' }}>
              Add your monthly income. Used for savings calculation.
            </p>
            <form onSubmit={handleAddIncome} style={{ display: 'grid', gap: 8 }}>
              <select
                value={newIncome.category}
                onChange={(e) =>
                  setNewIncome((v) => ({ ...v, category: e.target.value }))
                }
              >
                <option value="Salary">Salary</option>
                <option value="Bonus">Bonus</option>
                <option value="Other">Other</option>
              </select>
              <input
                type="number"
                placeholder="Amount (₹/month)"
                value={newIncome.amount}
                onChange={(e) =>
                  setNewIncome((v) => ({ ...v, amount: e.target.value }))
                }
              />
              <button type="submit">Save</button>
            </form>
          </FormCard>
          </div>

          <FormCard title="Add Expense (monthly)">
            <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px' }}>
              Only spending (consumption). Stocks, mutual funds, chit funds = add under Investments.
            </p>
            <div id="section-expense" style={{ scrollMarginTop: 16 }} />
            <form onSubmit={handleAddExpense} style={{ display: 'grid', gap: 8 }}>
              <select
                value={newExpense.category}
                onChange={(e) =>
                  setNewExpense((v) => ({ ...v, category: e.target.value }))
                }
              >
                <option>Food</option>
                <option>Rent</option>
                <option>EMI</option>
                <option>Travel</option>
                <option>Shopping</option>
                <option>Other</option>
              </select>
              <input
                type="number"
                placeholder="Amount (₹/month)"
                value={newExpense.amount}
                onChange={(e) =>
                  setNewExpense((v) => ({ ...v, amount: e.target.value }))
                }
              />
              <button type="submit">Save</button>
            </form>
          </FormCard>

          <FormCard title="Add Loan">
            <div id="section-loan" style={{ scrollMarginTop: 16 }} />
            <form onSubmit={handleAddLoan} style={{ display: 'grid', gap: 8 }}>
              <input
                placeholder="Loan Name"
                value={newLoan.name}
                onChange={(e) =>
                  setNewLoan((v) => ({ ...v, name: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="Principal"
                value={newLoan.principal}
                onChange={(e) =>
                  setNewLoan((v) => ({ ...v, principal: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="Interest %"
                value={newLoan.interest}
                onChange={(e) =>
                  setNewLoan((v) => ({ ...v, interest: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="Total tenure (months)"
                value={newLoan.totalTenureMonths}
                onChange={(e) =>
                  setNewLoan((v) => ({ ...v, totalTenureMonths: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="Months paid"
                value={newLoan.monthsPaid}
                onChange={(e) =>
                  setNewLoan((v) => ({ ...v, monthsPaid: e.target.value }))
                }
              />
              <input
                type="number"
                placeholder="EMI"
                value={newLoan.emi}
                onChange={(e) =>
                  setNewLoan((v) => ({ ...v, emi: e.target.value }))
                }
              />
              <button type="submit">Save</button>
            </form>
          </FormCard>

          <FormCard title="Goals">
            <div id="section-goal" style={{ scrollMarginTop: 16 }} />
            <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px' }}>
              Track savings or expense targets.
            </p>
            <form onSubmit={handleAddGoal} style={{ display: 'grid', gap: 8 }}>
              <input placeholder="Goal title" value={newGoal.title} onChange={(e) => setNewGoal((g) => ({ ...g, title: e.target.value }))} />
              <input type="number" placeholder="Target amount (₹)" value={newGoal.targetAmount} onChange={(e) => setNewGoal((g) => ({ ...g, targetAmount: e.target.value }))} />
              <input type="number" placeholder="Current amount (₹)" value={newGoal.currentAmount} onChange={(e) => setNewGoal((g) => ({ ...g, currentAmount: e.target.value }))} />
              <input type="date" placeholder="Target date" value={newGoal.targetDate} onChange={(e) => setNewGoal((g) => ({ ...g, targetDate: e.target.value }))} />
              <button type="submit">Add goal</button>
            </form>
            {goals.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12 }}>
                <div style={{ marginBottom: 6, color: '#666' }}>Your goals (see Goals card above for progress):</div>
                {goals.map((g) => (
                  <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #eee' }}>
                    <span>{g.title} — ₹{Math.round(g.currentAmount).toLocaleString('en-IN')} / ₹{Math.round(g.targetAmount).toLocaleString('en-IN')}{g.targetDate ? ` · ${new Date(g.targetDate).toLocaleDateString('en-IN')}` : ''}</span>
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button type="button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => openEditGoalModal(g)}>Update</button>
                      <button type="button" style={{ fontSize: 11, padding: '2px 8px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4 }} onClick={() => window.confirm('Delete goal?') && handleDeleteGoal(g.id)}>Delete</button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </FormCard>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          borderLeft: '1px solid #eee',
          paddingLeft: 24,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ margin: 0 }}>AI Financial Advisor</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#666' }}>
              Provider:{' '}
              <select
                value={chatProvider}
                onChange={(e) => setChatProvider(e.target.value as 'auto' | 'gemini' | 'groq')}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd' }}
              >
                <option value="auto">Auto (Gemini → Groq)</option>
                <option value="gemini">Gemini</option>
                <option value="groq">Groq</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setChatMessages([])}
              style={{ fontSize: 12, padding: '4px 10px', background: '#eee', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            >
              New chat
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          Ask about best asset mix, SIP amounts, expenses to cut, or loan prepayments.
        </p>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid #eee',
            borderRadius: 8,
            padding: 8,
            marginBottom: 8,
            background: '#fafafa',
          }}
        >
          {chatMessages.length === 0 && (
            <p style={{ fontSize: 12, color: '#777' }}>
              Example: “If I increase my SIP by ₹5,000, how does it change my 10-year
              corpus?” or “Which expenses should I cut to reach 30% savings rate?”.
            </p>
          )}
          {chatMessages.map((m, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: 8,
                textAlign: m.role === 'user' ? 'right' : 'left',
              }}
            >
              {m.role === 'assistant' && m.commandCard && !m.cancelled && !m.confirmed ? (
                <div
                  style={{
                    display: 'inline-block',
                    textAlign: 'left',
                    maxWidth: '100%',
                    padding: 12,
                    borderRadius: 12,
                    background: '#fff',
                    border: '1px solid #e0e0e0',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ marginBottom: 8 }}>{m.commandCard.reply}</div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
                    {Object.entries(m.commandCard.fields).filter(([, v]) => v != null && v !== '').length > 0 && (
                      <span>
                        {Object.entries(m.commandCard.fields)
                          .filter(([, v]) => v != null && v !== '')
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                  {m.commandCard.missing && m.commandCard.missing.length > 0 && (
                    <div style={{ fontSize: 11, color: '#b8860b', marginBottom: 8 }}>
                      Please provide: {m.commandCard.missing.join(', ')} — or click Edit to fill in the form.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {m.commandCard.intent !== 'update_loan' && (
                      <button
                        type="button"
                        onClick={() => void handleCommandConfirm(idx)}
                        disabled={m.commandCard.missing.length > 0 || confirmingCommandIdx === idx}
                        style={{
                          padding: '6px 12px',
                          fontSize: 12,
                          border: 'none',
                          borderRadius: 6,
                          background: m.commandCard.missing.length > 0 || confirmingCommandIdx === idx ? '#ccc' : '#28a745',
                          color: '#fff',
                          cursor: m.commandCard.missing.length > 0 || confirmingCommandIdx === idx ? 'not-allowed' : 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        {confirmingCommandIdx === idx ? 'Processing…' : 'Confirm'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCommandEdit(idx)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        border: '1px solid #0070f3',
                        borderRadius: 6,
                        background: '#fff',
                        color: '#0070f3',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCommandCancel(idx)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        border: 'none',
                        borderRadius: 6,
                        background: '#6c757d',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'inline-block',
                      position: 'relative',
                      padding: '6px 10px',
                      paddingRight: m.role === 'assistant' && ttsSupported ? 36 : 10,
                      borderRadius: 12,
                      background: m.role === 'user' ? '#0070f3' : '#e5e5ea',
                      color: m.role === 'user' ? '#fff' : '#000',
                      fontSize: 13,
                    }}
                  >
                    {m.content}
                    {m.role === 'assistant' && ttsSupported && !m.commandCard && (
                      <button
                        type="button"
                        title={speakingMessageIdx === idx ? 'Stop speaking' : 'Listen'}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (speakingMessageIdx === idx) stopSpeaking()
                          else speakResponse(m.content, idx)
                        }}
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          width: 26,
                          height: 26,
                          padding: 0,
                          fontSize: 14,
                          border: 'none',
                          borderRadius: 6,
                          background: speakingMessageIdx === idx ? '#dc3545' : 'rgba(0,0,0,0.08)',
                          color: speakingMessageIdx === idx ? '#fff' : '#333',
                          cursor: 'pointer',
                        }}
                      >
                        {speakingMessageIdx === idx ? '⏹' : '🔊'}
                      </button>
                    )}
                  </div>
                  {m.role === 'assistant' && m.provider && (
                    <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                      Answered by {m.provider === 'groq' ? 'Groq' : 'Gemini'}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(voiceSupported || ttsSupported) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#666', flexWrap: 'wrap' }}>
              {speakingMessageIdx !== null && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    border: 'none',
                    background: '#dc3545',
                    color: '#fff',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Stop speaking
                </button>
              )}
              <span>Voice:</span>
              <select
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value as 'en-IN' | 'ta-IN')}
                disabled={voiceListening}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd', fontSize: 12 }}
              >
                <option value="en-IN">English</option>
                <option value="ta-IN">Tamil</option>
              </select>
              {voiceSupported && (
              <button
                type="button"
                title={voiceListening ? 'Stop listening' : 'Start voice input'}
                onClick={voiceListening ? stopVoiceInput : startVoiceInput}
                disabled={chatLoading}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: voiceListening ? '#dc3545' : '#0b8457',
                  color: '#fff',
                  cursor: chatLoading ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {voiceListening ? 'Stop' : 'Mic'}
              </button>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoSpeakResponse}
                  onChange={(e) => setAutoSpeakResponse(e.target.checked)}
                />
                Speak responses
              </label>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={{ flex: 1 }}
              placeholder="Ask a question about your money…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleChatSend()
                }
              }}
            />
            <button disabled={chatLoading} onClick={() => void handleChatSend()}>
              {chatLoading ? 'Thinking…' : 'Ask'}
            </button>
          </div>
        </div>
      </div>

      {showSavingsDetails && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setShowSavingsDetails(false)}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>How monthly balance is calculated</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 8px', fontSize: 13, color: '#444', marginBottom: 8 }}>
              <span>Income ₹{Math.round(Number(summary.KPIs.totalIncome) || 0).toLocaleString('en-IN')}</span>
              <span>−</span>
              <span>Expenses ₹{Math.round(Number(summary.KPIs.totalExpenses) || 0).toLocaleString('en-IN')}</span>
              {(Number(summary.KPIs.totalLoanEmi) || 0) > 0 && (
                <>
                  <span>−</span>
                  <span>Loan EMIs ₹{Math.round(Number(summary.KPIs.totalLoanEmi) || 0).toLocaleString('en-IN')}</span>
                </>
              )}
              <span>=</span>
              <span>Surplus ₹{Math.round(Number(summary.KPIs.monthlySavings) || 0).toLocaleString('en-IN')}</span>
              {totalMonthlySip > 0 && (
                <>
                  <span>−</span>
                  <span>SIP/chit ₹{Math.round(totalMonthlySip).toLocaleString('en-IN')}</span>
                  <span>=</span>
                  <span style={{ fontWeight: 600, color: '#0b8457' }}>Monthly balance ₹{Math.round(monthlyBalance).toLocaleString('en-IN')}</span>
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
              Expenses include spending + loan EMIs (from Loans). Monthly balance = cash left after expenses and SIP/chit.
            </div>
            <button type="button" onClick={() => setShowSavingsDetails(false)} style={{ padding: '8px 16px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {showIncomeListModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setShowIncomeListModal(false)}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 420, width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>Income</h3>
            {summary.incomes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {summary.incomes.map((i) => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 8, background: '#f8f9fa', borderRadius: 8 }}>
                    <span>{i.category} ₹{Math.round(i.amount).toLocaleString('en-IN')}</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button type="button" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => { setShowIncomeListModal(false); openEditIncomeModal(i); }}>Update</button>
                      <button type="button" style={{ fontSize: 11, padding: '4px 10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4 }} onClick={() => window.confirm('Delete this income?') && handleDeleteIncome(i.id)}>Delete</button>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>No income entries yet.</div>
            )}
            <button type="button" onClick={() => setShowIncomeListModal(false)} style={{ padding: '8px 16px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {showExpenseListModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setShowExpenseListModal(false)}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 420, width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>Expenses</h3>
            {summary.expenses.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {summary.expenses.map((e) => (
                  <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 8, background: '#f8f9fa', borderRadius: 8 }}>
                    <span>{e.category} ₹{Math.round(e.amount).toLocaleString('en-IN')}{e.description ? ` — ${e.description}` : ''}</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button type="button" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => { setShowExpenseListModal(false); openEditExpenseModal(e); }}>Update</button>
                      <button type="button" style={{ fontSize: 11, padding: '4px 10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4 }} onClick={() => window.confirm('Delete this expense?') && handleDeleteExpense(e.id)}>Delete</button>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>No expenses yet.</div>
            )}
            <button type="button" onClick={() => setShowExpenseListModal(false)} style={{ padding: '8px 16px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {showGoalsListModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setShowGoalsListModal(false)}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 420, width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>Goals</h3>
            {goals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {goals.map((g) => {
                  const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0
                  return (
                    <div key={g.id} style={{ padding: 10, background: '#f8f9fa', borderRadius: 8, border: '1px solid #eee' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{g.title}</div>
                      <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>
                        ₹{Math.round(g.currentAmount).toLocaleString('en-IN')} / ₹{Math.round(g.targetAmount).toLocaleString('en-IN')} ({pct.toFixed(0)}%)
                      </div>
                      <div style={{ height: 6, background: '#e9ecef', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#28a745' : '#0070f3', borderRadius: 3 }} />
                      </div>
                      {g.targetDate && (
                        <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
                          Target: {new Date(g.targetDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => { setShowGoalsListModal(false); openEditGoalModal(g); }}>Update</button>
                        <button type="button" style={{ fontSize: 11, padding: '4px 10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4 }} onClick={() => window.confirm('Delete this goal?') && handleDeleteGoal(g.id)}>Delete</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>No goals yet. Add one in the form below.</div>
            )}
            <button type="button" onClick={() => setShowGoalsListModal(false)} style={{ padding: '8px 16px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {editIncome && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setEditIncome(null)}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>Edit Income</h3>
            <form onSubmit={handleUpdateIncome} style={{ display: 'grid', gap: 8 }}>
              <select value={editIncomeForm.category} onChange={(e) => setEditIncomeForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="Salary">Salary</option>
                <option value="Bonus">Bonus</option>
                <option value="Other">Other</option>
              </select>
              <input type="number" placeholder="Amount (₹)" value={editIncomeForm.amount} onChange={(e) => setEditIncomeForm((f) => ({ ...f, amount: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit">Save</button>
                <button type="button" onClick={() => setEditIncome(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editExpense && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setEditExpense(null)}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>Edit Expense</h3>
            <form onSubmit={handleUpdateExpense} style={{ display: 'grid', gap: 8 }}>
              <select value={editExpenseForm.category} onChange={(e) => setEditExpenseForm((f) => ({ ...f, category: e.target.value }))}>
                <option>Food</option>
                <option>Rent</option>
                <option>EMI</option>
                <option>Travel</option>
                <option>Shopping</option>
                <option>Other</option>
              </select>
              <input type="number" placeholder="Amount (₹)" value={editExpenseForm.amount} onChange={(e) => setEditExpenseForm((f) => ({ ...f, amount: e.target.value }))} />
              <input placeholder="Description (optional)" value={editExpenseForm.description} onChange={(e) => setEditExpenseForm((f) => ({ ...f, description: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit">Save</button>
                <button type="button" onClick={() => setEditExpense(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editGoal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setEditGoal(null)}
        >
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 360, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>Edit Goal</h3>
            <form onSubmit={handleUpdateGoal} style={{ display: 'grid', gap: 8 }}>
              <input placeholder="Goal title" value={editGoalForm.title} onChange={(e) => setEditGoalForm((f) => ({ ...f, title: e.target.value }))} />
              <input type="number" placeholder="Target amount (₹)" value={editGoalForm.targetAmount} onChange={(e) => setEditGoalForm((f) => ({ ...f, targetAmount: e.target.value }))} />
              <input type="number" placeholder="Current amount (₹)" value={editGoalForm.currentAmount} onChange={(e) => setEditGoalForm((f) => ({ ...f, currentAmount: e.target.value }))} />
              <input type="date" placeholder="Target date" value={editGoalForm.targetDate} onChange={(e) => setEditGoalForm((f) => ({ ...f, targetDate: e.target.value }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit">Save</button>
                <button type="button" onClick={() => setEditGoal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {payoffModalLoan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={closePayoffModal}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 480,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 20, borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Payoff plan: {payoffModalLoan.name}</h3>
                <button
                  type="button"
                  onClick={closePayoffModal}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666' }}
                >
                  ×
                </button>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: '#555' }}>
                Outstanding ₹{Math.round(payoffModalLoan.remainingPrincipal ?? payoffModalLoan.principal).toLocaleString('en-IN')} · EMI ₹{Math.round(payoffModalLoan.emi).toLocaleString('en-IN')} · {payoffModalLoan.interest}% · {payoffModalLoan.tenure} months left{payoffModalLoan.totalTenureMonths != null ? ` (${payoffModalLoan.totalTenureMonths - payoffModalLoan.tenure} paid of ${payoffModalLoan.totalTenureMonths})` : ''}
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                Optional: add extra payment to see how it affects your payoff.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Extra EMI per month (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={payoffExtraEmi}
                    onChange={(e) => setPayoffExtraEmi(e.target.value)}
                    style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>One-time prepayment (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={payoffLumpSum}
                    onChange={(e) => setPayoffLumpSum(e.target.value)}
                    style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={payoffAdviceLoading}
                onClick={() => void handleGetPayoffAdvice()}
                style={{
                  width: '100%',
                  padding: 10,
                  background: payoffAdviceLoading ? '#ccc' : '#0070f3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: payoffAdviceLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {payoffAdviceLoading ? 'Getting advice…' : 'Get payoff advice'}
              </button>
              {payoffAdvice && (
                <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {payoffAdvice}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {homePredictionModalLoan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={closeHomePredictionModal}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 520,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 20, borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Value prediction: {homePredictionModalLoan.name}</h3>
                <button
                  type="button"
                  onClick={closeHomePredictionModal}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666' }}
                >
                  ×
                </button>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: '#555' }}>
                Current estimated value: ₹{Math.round(homePredictionModalLoan.principal).toLocaleString('en-IN')} (appreciating asset)
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Years</label>
                  <input
                    type="range"
                    min={5}
                    max={25}
                    value={homeAppreciationYears}
                    onChange={(e) => setHomeAppreciationYears(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{homeAppreciationYears}</span>
                </div>
                <div>
                  <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Appreciation % per year</label>
                  <input
                    type="range"
                    min={3}
                    max={12}
                    value={homeAppreciationRatePct}
                    onChange={(e) => setHomeAppreciationRatePct(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{homeAppreciationRatePct}%</span>
                </div>
              </div>
              {homeAppreciationProjectionData.length > 0 && (
                <div style={{ height: 220, marginBottom: 16 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={homeAppreciationProjectionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis tickFormatter={(v) => `₹${(v / 1e5).toFixed(1)}L`} />
                      <Tooltip formatter={(v: number) => [`₹${Math.round(v).toLocaleString('en-IN')}`, 'Value']} />
                      <Line type="monotone" dataKey="value" stroke="#6f42c1" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <button
                type="button"
                disabled={homePredictionLoading}
                onClick={() => void handleGetHomePrediction()}
                style={{
                  width: '100%',
                  padding: 10,
                  background: homePredictionLoading ? '#ccc' : '#6f42c1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: homePredictionLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {homePredictionLoading ? 'Getting insight…' : 'Get AI prediction'}
              </button>
              {homePredictionExplanation && (
                <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {homePredictionExplanation}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editLoan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={closeEditLoanModal}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 420,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 20, borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Update loan: {editLoan.name}</h3>
                <button
                  type="button"
                  onClick={closeEditLoanModal}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666' }}
                >
                  ×
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateLoan} style={{ padding: 20, display: 'grid', gap: 10 }}>
              <input
                placeholder="Loan Name"
                value={editLoanForm.name}
                onChange={(e) => setEditLoanForm((v) => ({ ...v, name: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="number"
                placeholder="Principal"
                value={editLoanForm.principal}
                onChange={(e) => setEditLoanForm((v) => ({ ...v, principal: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="number"
                placeholder="Interest %"
                value={editLoanForm.interest}
                onChange={(e) => setEditLoanForm((v) => ({ ...v, interest: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="number"
                placeholder="Total tenure (months)"
                value={editLoanForm.totalTenureMonths}
                onChange={(e) => setEditLoanForm((v) => ({ ...v, totalTenureMonths: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="number"
                placeholder="Months paid"
                value={editLoanForm.monthsPaid}
                onChange={(e) => setEditLoanForm((v) => ({ ...v, monthsPaid: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="number"
                placeholder="EMI"
                value={editLoanForm.emi}
                onChange={(e) => setEditLoanForm((v) => ({ ...v, emi: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="date"
                value={editLoanForm.startDate}
                onChange={(e) => setEditLoanForm((v) => ({ ...v, startDate: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={closeEditLoanModal}
                  style={{
                    padding: '8px 16px',
                    background: '#eee',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateLoanLoading}
                  style={{
                    padding: '8px 16px',
                    background: updateLoanLoading ? '#ccc' : '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: updateLoanLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {updateLoanLoading ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editInvestment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={closeEditInvestmentModal}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              maxWidth: 420,
              width: '100%',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: 20, borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>Update investment: {editInvestment.name}</h3>
                <button
                  type="button"
                  onClick={closeEditInvestmentModal}
                  style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666' }}
                >
                  ×
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateInvestment} style={{ padding: 20, display: 'grid', gap: 10 }}>
              <select
                value={editInvestmentForm.type}
                onChange={(e) => setEditInvestmentForm((v) => ({ ...v, type: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              >
                <option value="STOCK">Stock</option>
                <option value="MUTUAL_FUND">Mutual Fund</option>
                <option value="CHIT_FUND">Chit fund</option>
                <option value="OTHER">Other</option>
              </select>
              <input
                placeholder="Symbol (e.g. TCS)"
                value={editInvestmentForm.symbol}
                onChange={(e) => setEditInvestmentForm((v) => ({ ...v, symbol: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                placeholder="Name"
                value={editInvestmentForm.name}
                onChange={(e) => setEditInvestmentForm((v) => ({ ...v, name: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="number"
                placeholder="Total invested (₹, lump sum)"
                value={editInvestmentForm.investedAmount}
                onChange={(e) => setEditInvestmentForm((v) => ({ ...v, investedAmount: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="number"
                placeholder="Current profit (₹, can be negative)"
                value={editInvestmentForm.profit}
                onChange={(e) => setEditInvestmentForm((v) => ({ ...v, profit: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="number"
                placeholder={editInvestmentForm.type === 'CHIT_FUND' ? 'Monthly chit (₹, optional)' : 'Monthly SIP (₹, optional)'}
                value={editInvestmentForm.monthlySip}
                onChange={(e) => setEditInvestmentForm((v) => ({ ...v, monthlySip: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <input
                type="date"
                value={editInvestmentForm.buyDate}
                onChange={(e) => setEditInvestmentForm((v) => ({ ...v, buyDate: e.target.value }))}
                style={{ padding: 8, border: '1px solid #ddd', borderRadius: 6 }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={closeEditInvestmentModal}
                  style={{
                    padding: '8px 16px',
                    background: '#eee',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    background: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard(props: { title: string; value: number; prefix?: string }) {
  const num = Number(props.value)
  const display = Number.isFinite(num) ? Math.round(num).toLocaleString('en-IN') : '0'
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: '1px solid #eee',
        background: '#fff',
      }}
    >
      <div style={{ fontSize: 12, color: '#666' }}>{props.title}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
        {props.prefix}
        {display}
      </div>
    </div>
  )
}

function LoansKpiCard(props: {
  loans: Loan[]
  totalPrincipal: number
}) {
  const { loans, totalPrincipal } = props
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: '1px solid #eee',
        background: '#fff',
      }}
    >
      <div style={{ fontSize: 12, color: '#666' }}>Outstanding loan balance</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>
        ₹{Math.round(totalPrincipal).toLocaleString('en-IN')}
      </div>
      {loans.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: '#555',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 10px',
          }}
        >
          {loans.map((loan) => (
            <span
              key={loan.id}
              style={{
                background: '#f0f0f0',
                padding: '2px 6px',
                borderRadius: 6,
              }}
            >
              {loan.name}: ₹{Math.round(loan.remainingPrincipal ?? loan.principal).toLocaleString('en-IN')}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ChartCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: '1px solid #eee',
        background: '#fff',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
        {props.title}
      </div>
      {props.children}
    </div>
  )
}

function FormCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: '1px solid #eee',
        background: '#fff',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
        {props.title}
      </div>
      {props.children}
    </div>
  )
}
