# Alpine 3.16 has OpenSSL 1.1.x required by Prisma's query engine (libssl.so.1.1)
FROM node:20-alpine3.16 AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
# Use npm ci when lock file exists (faster), else npm install (e.g. if lock not committed)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Stage 2: Builder (Prisma generate + Next build)
FROM node:20-alpine3.16 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js expects public/; ensure it exists so runner COPY does not fail
RUN mkdir -p public
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner (same Alpine 3.16 for Prisma libssl.so.1.1)
FROM node:20-alpine3.16 AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Listen on all interfaces (required for Render/cloud)
ENV HOSTNAME="0.0.0.0"
# Render injects PORT at runtime; default for local Docker
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# Shell form so Render's PORT env is picked up; Next.js reads process.env.PORT
CMD ["sh", "-c", "exec node server.js"]
