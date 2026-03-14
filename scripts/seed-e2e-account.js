/**
 * Create a single E2E test account: income 50K, no loans/expenses/investments.
 * Run: node scripts/seed-e2e-account.js
 * Login: e2e@test.com / E2eTest@123
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const E2E_EMAIL = 'e2e@test.com'
const E2E_PASSWORD = 'E2eTest@123'
const E2E_INCOME_AMOUNT = 50000

const prisma = new PrismaClient()

async function main() {
  const hashed = await bcrypt.hash(E2E_PASSWORD, 10)

  const user = await prisma.user.upsert({
    where: { email: E2E_EMAIL },
    create: {
      email: E2E_EMAIL,
      name: 'E2E Test',
      password: hashed,
    },
    update: { password: hashed, name: 'E2E Test' },
  })

  await prisma.income.deleteMany({ where: { userId: user.id } })
  await prisma.income.create({
    data: {
      userId: user.id,
      amount: E2E_INCOME_AMOUNT,
      category: 'Salary',
    },
  })

  await prisma.expense.deleteMany({ where: { userId: user.id } })
  await prisma.loan.deleteMany({ where: { userId: user.id } })
  await prisma.investment.deleteMany({ where: { userId: user.id } })
  await prisma.goal.deleteMany({ where: { userId: user.id } })

  console.log('E2E account ready.')
  console.log('  Email:', E2E_EMAIL)
  console.log('  Password:', E2E_PASSWORD)
  console.log('  Income: ₹50,000 (Salary), no loans/expenses/investments.')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
