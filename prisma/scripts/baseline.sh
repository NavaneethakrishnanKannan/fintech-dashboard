#!/bin/sh
# Baseline: mark all migrations as applied so Prisma stops asking to reset.
# Run from project root: sh prisma/scripts/baseline.sh
# Use when DB already has the schema but migration history is out of sync (drift).

set -e
export PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1

for m in \
  20260301164806_init \
  20260301170703_enrich_models \
  20260301181730_investment_profit \
  20260301190335_add_loan_total_tenure_months \
  20260301203207_add_investment_monthly_sip \
  20260301210914_add_chat_goals_password_reset \
  20260314151522_add_alert_networth_investment_goal_fields \
  20260314151612_add_alert_networth_investment_goal_fields; do
  echo "Resolving --applied: $m"
  npx prisma migrate resolve --applied "$m"
done

echo "Done. Run: npx prisma migrate dev (or deploy) to confirm no drift."
