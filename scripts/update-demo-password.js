/**
 * One-time script: set demo user password to bcrypt hash of Admin@123
 * Run: node scripts/update-demo-password.js
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const HASH = '$2a$10$oT.ClPgpQJ493GCOxOh.W.Zg9pQyLU3Hvq8WyEpd7TqHrImJ/P9Sy'

const prisma = new PrismaClient()

async function main() {
  const updated = await prisma.user.updateMany({
    where: { email: 'nk@gmail.com' },
    data: { password: HASH },
  })
  console.log('Updated', updated.count, 'user(s). Login with nk@gmail.com / Admin@123')
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
