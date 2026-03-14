-- =============================================================================
-- Apply the failed migration entirely in Supabase SQL Editor (no Prisma lock).
-- Copy-paste this entire file into Supabase Dashboard → SQL Editor → Run.
-- Then run locally: npx prisma generate
-- =============================================================================

-- 1) Apply schema changes (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Goal' AND column_name = 'expectedReturnRate') THEN
    ALTER TABLE "Goal" ADD COLUMN "expectedReturnRate" DOUBLE PRECISION;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Investment' AND column_name = 'currentPrice') THEN
    ALTER TABLE "Investment" ADD COLUMN "currentPrice" DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Investment' AND column_name = 'sector') THEN
    ALTER TABLE "Investment" ADD COLUMN "sector" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Investment' AND column_name = 'category') THEN
    ALTER TABLE "Investment" ADD COLUMN "category" TEXT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NetWorthHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "assets" DOUBLE PRECISION NOT NULL,
    "liabilities" DOUBLE PRECISION NOT NULL,
    "netWorth" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NetWorthHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Alert_userId_idx" ON "Alert"("userId");
CREATE INDEX IF NOT EXISTS "NetWorthHistory_userId_idx" ON "NetWorthHistory"("userId");
CREATE INDEX IF NOT EXISTS "NetWorthHistory_userId_date_idx" ON "NetWorthHistory"("userId", "date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Alert_userId_fkey') THEN
    ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NetWorthHistory_userId_fkey') THEN
    ALTER TABLE "NetWorthHistory" ADD CONSTRAINT "NetWorthHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Mark migration as applied so Prisma won't try to run it (avoids advisory lock)
UPDATE _prisma_migrations
SET rolled_back_at = NULL,
    finished_at   = now(),
    applied_steps_count = 1
WHERE migration_name = '20260314151612_add_alert_networth_investment_goal_fields';
