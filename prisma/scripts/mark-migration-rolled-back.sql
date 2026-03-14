-- Run this in Supabase Dashboard → SQL Editor to mark the failed migration as rolled back.
-- This avoids the advisory lock timeout from "prisma migrate resolve --rolled-back".
-- After running, stop your app (npm run dev) and run: npx prisma migrate deploy

UPDATE _prisma_migrations
SET rolled_back_at = now()
WHERE migration_name = '20260314151612_add_alert_networth_investment_goal_fields'
  AND rolled_back_at IS NULL;

-- Verify: you should see 1 row updated
-- SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations WHERE migration_name LIKE '20260314%';
