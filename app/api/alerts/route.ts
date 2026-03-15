import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/getSession'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const alerts = await prisma.alert.findMany({
    where: { userId },
    orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  })

  let budgetAlerts: { id: string; userId: string; type: string; title: string; message: string; severity: string; read: boolean; metadata: unknown; createdAt: Date }[] = []
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const [budgets, expenses] = await Promise.all([
      prisma.budget.findMany({ where: { userId } }),
      prisma.expense.findMany({
        where: { userId, date: { gte: monthStart, lte: monthEnd } },
      }),
    ])
    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const byCategory: Record<string, number> = {}
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount)
    }
    for (const b of budgets) {
      const spent = b.category === 'total' ? totalSpent : (byCategory[b.category] ?? 0)
      if (spent >= b.amount && b.amount > 0) {
        budgetAlerts.push({
          id: `expense_budget_${b.id}`,
          userId,
          type: 'expense_budget',
          title: `Budget exceeded: ${b.category === 'total' ? 'Total' : b.category}`,
          message: `Spent ₹${spent.toLocaleString('en-IN')} vs budget ₹${Number(b.amount).toLocaleString('en-IN')} this month.`,
          severity: 'warning',
          read: false,
          metadata: { budgetId: b.id, category: b.category, spent, limit: b.amount },
          createdAt: new Date(),
        })
      }
    }
  } catch {
    // Budget table may not exist yet (migration not run); return only stored alerts
  }
  const combined = [...budgetAlerts, ...alerts].sort(
    (a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  return NextResponse.json(combined)
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = body.id as string | undefined
  const read = body.read as boolean | undefined

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  if (id.startsWith('expense_budget_')) {
    return NextResponse.json({ id, read: read ?? false, type: 'expense_budget' })
  }

  const result = await prisma.alert.updateMany({
    where: { id, userId },
    data: read !== undefined ? { read } : {},
  })
  if (result.count === 0) return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
  const updated = await prisma.alert.findUnique({ where: { id } })
  return NextResponse.json(updated)
}
