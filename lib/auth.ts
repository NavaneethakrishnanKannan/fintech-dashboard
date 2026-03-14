import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.trim().toLowerCase() },
          })
          if (!user?.password) return null
          const ok = await bcrypt.compare(credentials.password, user.password)
          if (!ok) return null
          return { id: user.id, email: user.email ?? '', name: user.name ?? null }
        } catch (err) {
          console.error('[auth] authorize error:', err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const email = user.email?.trim().toLowerCase()
        if (user.id) {
          token.id = user.id
        } else if (email) {
          try {
            let dbUser = await prisma.user.findUnique({ where: { email } })
            if (!dbUser) {
              dbUser = await prisma.user.create({
                data: { email, name: user.name ?? null, password: null },
              })
            }
            token.id = dbUser.id
          } catch (err) {
            console.error('[auth] jwt findOrCreate error:', err)
          }
        }
        token.sub = token.id ?? token.sub
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = (token.id ?? token.sub) as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
}
