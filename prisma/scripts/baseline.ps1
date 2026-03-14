# Baseline: mark all migrations as applied so Prisma stops asking to reset.
# Run from project root: .\prisma\scripts\baseline.ps1
# Use when DB already has the schema but migration history is out of sync (drift).

# Avoid advisory lock timeout (Supabase/pooler)
$env:PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = "1"

$migrations = @(
  "20260301164806_init",
  "20260301170703_enrich_models",
  "20260301181730_investment_profit",
  "20260301190335_add_loan_total_tenure_months",
  "20260301203207_add_investment_monthly_sip",
  "20260301210914_add_chat_goals_password_reset",
  "20260314151522_add_alert_networth_investment_goal_fields",
  "20260314151612_add_alert_networth_investment_goal_fields"
)

$maxRetries = 3
$retryDelaySeconds = 5

foreach ($m in $migrations) {
  Write-Host "Resolving --applied: $m"
  $attempt = 1
  $done = $false
  while (-not $done -and $attempt -le $maxRetries) {
    $out = npx prisma migrate resolve --applied $m 2>&1
    $code = $LASTEXITCODE
    if ($code -eq 0) {
      $done = $true
      break
    }
    # P3008 = already applied; skip and continue
    if ($out -match "P3008|already recorded as applied") {
      Write-Host "  (already applied, skipping)"
      $done = $true
      break
    }
    # P1001 = can't reach DB; retry
    if ($out -match "P1001|Can't reach database") {
      if ($attempt -lt $maxRetries) {
        Write-Host "  Connection failed (attempt $attempt/$maxRetries). Retrying in ${retryDelaySeconds}s..."
        Start-Sleep -Seconds $retryDelaySeconds
        $attempt++
      } else {
        Write-Host $out
        Write-Host "Failed at $m after $maxRetries attempts. Check DATABASE_URL / DIRECT_URL and network."
        exit 1
      }
    } else {
      Write-Host $out
      Write-Host "Failed at $m. Fix and re-run from that migration."
      exit 1
    }
  }
}

Write-Host "Done. Run: npx prisma migrate dev (or deploy) to confirm no drift."
