# Running Prisma migrations (Supabase / Neon)

## "prepared statement does not exist" (Supabase / pooler)

If you see errors like:

```text
prepared statement "s77" does not exist
```

your app is using a **pooled** connection (e.g. Supabase `pooler.supabase.com`) without telling Prisma. Add **`?pgbouncer=true`** to your **`DATABASE_URL`** in `.env`:

```env
# Before (can cause prepared statement errors)
DATABASE_URL="postgresql://user:pass@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"

# After (Prisma disables prepared statements; works with pooler)
DATABASE_URL="postgresql://user:pass@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?pgbouncer=true"
```

If the URL already has a query string, use `&pgbouncer=true` instead of `?pgbouncer=true`. Restart the dev server after changing `.env`.

---

## Advisory lock timeout (P1002) – use env var (recommended)

If you see:

```text
Timed out trying to acquire a postgres advisory lock (SELECT pg_advisory_lock(...))
```

**Fix:** Disable advisory locking for Prisma Migrate so `migrate deploy` and `migrate resolve` don’t wait for the lock.

Add to your **`.env`** (not only `.env.example`):

```env
PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1
```

Then run migrations as usual:

```bash
npx prisma migrate resolve --rolled-back "20260314151612_add_alert_networth_investment_goal_fields"
npx prisma migrate deploy
```

Or for development:

```bash
npx prisma migrate dev
```

No manual SQL or Supabase Dashboard needed. Prisma uses this env var when running any migrate command.

---

## Drift / "All data will be lost" reset prompt

If `prisma migrate dev` says **"Drift detected"** and asks to **reset** (which would delete all data), do **not** confirm. Instead, **baseline** the database so Prisma treats the current schema as up to date:

**Option A – Run the baseline script (Windows PowerShell, from project root):**

```bash
npm run db:baseline
```

Or run the script directly:

```powershell
.\prisma\scripts\baseline.ps1
```

**Option B – Run resolve manually for each migration (any OS):**

```bash
npx prisma migrate resolve --applied "20260301164806_init"
npx prisma migrate resolve --applied "20260301170703_enrich_models"
npx prisma migrate resolve --applied "20260301181730_investment_profit"
npx prisma migrate resolve --applied "20260301190335_add_loan_total_tenure_months"
npx prisma migrate resolve --applied "20260301203207_add_investment_monthly_sip"
npx prisma migrate resolve --applied "20260301210914_add_chat_goals_password_reset"
npx prisma migrate resolve --applied "20260314151522_add_alert_networth_investment_goal_fields"
npx prisma migrate resolve --applied "20260314151612_add_alert_networth_investment_goal_fields"
```

After that, run `npx prisma migrate dev` again. Prisma should report no drift and no reset. Your data stays intact.

---

## Other options (if you prefer not to disable the lock)

### 1. Use the correct connection strings (Supabase)

- **DIRECT_URL** must be the **Session mode** connection (port **5432**). Prisma uses this for `migrate` and `db pull`.
- **DATABASE_URL** can be the same for the app, or Transaction mode (port 6543 with `?pgbouncer=true`) for serverless.

In `.env`:

```env
# Session mode (port 5432) – use for DIRECT_URL so migrations work
DIRECT_URL="postgresql://USER.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres"

# App can use same URL or transaction mode (6543) for serverless
DATABASE_URL="postgresql://USER.PROJECT_REF:PASSWORD@REGION.pooler.supabase.com:5432/postgres"
```

### 2. Free the advisory lock

Another process (e.g. `next dev`, another Prisma command, or an open DB client) may be holding the lock.

1. Stop the dev server (`Ctrl+C` in the terminal where `npm run dev` runs).
2. Close any other terminals or tools that might be connected to the same database.
3. Wait a few seconds, then run:

```bash
npx prisma migrate resolve --rolled-back "20260314151612_add_alert_networth_investment_goal_fields"
npx prisma migrate deploy
```

If `resolve` still times out, retry when no other process is using the project (e.g. close Cursor/IDE or run from a fresh terminal).

### 3. Bypass the lock: mark rolled back via SQL (Supabase Dashboard)

If `migrate resolve` still times out (even with the direct URL and no app running), mark the failed migration as rolled back from Supabase so Prisma never has to take the lock for `resolve`:

1. Open **Supabase Dashboard** → your project → **SQL Editor**.
2. Run the script in **prisma/scripts/mark-migration-rolled-back.sql** (or run this):

   ```sql
   UPDATE _prisma_migrations
   SET rolled_back_at = now()
   WHERE migration_name = '20260314151612_add_alert_networth_investment_goal_fields'
     AND rolled_back_at IS NULL;
   ```

3. Stop your app (`npm run dev`) and any other DB clients.
4. Locally run:

   ```bash
   npx prisma migrate deploy
   ```

Prisma will then re-apply the migration. The advisory lock is only needed during `migrate deploy`; with no other connections, it should succeed.

### 3b. Avoid the lock completely: apply migration in Supabase (recommended if deploy still times out)

If `migrate deploy` still times out (advisory lock), apply the migration and mark it applied **entirely in Supabase** so Prisma never needs to connect for migrate:

1. Open **Supabase Dashboard** → **SQL Editor**.
2. Open **prisma/scripts/apply-migration-manually.sql** in your project, copy its entire contents, paste into the SQL Editor, and **Run**.
3. That script applies the schema (Alert, NetWorthHistory, new columns) and marks the migration as applied in `_prisma_migrations`.
4. Locally run only: **`npx prisma generate`** (no `migrate deploy` needed).

Your schema and migration history will be in sync and you can start the app.

### 4. If the schema is already applied

If you know the migration changes are already in the database (e.g. tables and columns exist), you can mark the migration as applied instead of re-running it:

```bash
npx prisma migrate resolve --applied "20260314151612_add_alert_networth_investment_goal_fields"
```

Then run `npx prisma migrate deploy` again; it should report that there’s nothing left to apply.
