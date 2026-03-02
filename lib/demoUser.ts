import type { PrismaClient } from '@prisma/client'

export const DEMO_USER_ID = process.env.DEMO_USER_ID ?? 'demo-user'

export async function ensureDemoUser(prisma: PrismaClient) {
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {},
    create: {
      id: DEMO_USER_ID,
      email: 'demo@example.com',
      name: 'Demo User',
    },
  })
}

