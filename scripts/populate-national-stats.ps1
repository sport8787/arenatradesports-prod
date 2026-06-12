# populate-national-stats.ps1
# Popula national_team_stats em lotes de 4 times para evitar timeout (504)
# Uso: .\scripts\populate-national-stats.ps1

$SUPABASE_URL  = "https://ogpohiugfkvygcejrzfp.supabase.co"
$ANON_KEY      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ncG9oaXVnZmt2eWdjZWpyemZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MDU2NDQsImV4cCI6MjA5NDQ4MTY0NH0.jCkoT6C0A-68XtDzZ9sTp3xE_qkGiANOkyl5rMTV3Ns"
$FUNC_URL      = "$SUPABASE_URL/functions/v1/fetch-national-team-stats"
$BATCH_SIZE    = 4   # Times por chamada — reduz se ainda der 504
$DELAY_BETWEEN = 3   # Segundos entre lotes

$headers = @{
    "Authorization" = "Bearer $ANON_KEY"
    "Content-Type"  = "application/json"
}

# 1) Buscar todos os times de copa_fixtures
Write-Host "Buscando times de copa_fixtures..." -ForegroundColor Cyan
$fixturesUrl = "$SUPABASE_URL/rest/v1/copa_fixtures?select=home,away"
$fixtures = Invoke-RestMethod -Uri $fixturesUrl -Headers @{
    "apikey"        = $ANON_KEY
    "Authorization" = "Bearer $ANON_KEY"
}

$allTeams = [System.Collections.Generic.HashSet[string]]::new()
foreach ($f in $fixtures) {
    if ($f.home) { $allTeams.Add($f.home) | Out-Null }
    if ($f.away) { $allTeams.Add($f.away) | Out-Null }
}
$teamList = $allTeams | Sort-Object
Write-Host "Total de seleções encontradas: $($teamList.Count)" -ForegroundColor Green

# 2) Dividir em lotes e processar
$batches = @()
$batch   = @()
foreach ($t in $teamList) {
    $batch += $t
    if ($batch.Count -eq $BATCH_SIZE) {
        $batches += , $batch
        $batch = @()
    }
}
if ($batch.Count -gt 0) { $batches += , $batch }

$totalBatches = $batches.Count
$processed = 0; $failed = 0; $skipped = 0

Write-Host "Processando $totalBatches lotes de até $BATCH_SIZE times..." -ForegroundColor Cyan

for ($i = 0; $i -lt $totalBatches; $i++) {
    $b = $batches[$i]
    $teamsJson = ($b | ForEach-Object { "`"$_`"" }) -join ","
    $body = "{`"teams`":[$teamsJson],`"last`":10}"

    Write-Host "[$($i+1)/$totalBatches] $($b -join ', ')" -NoNewline

    try {
        $r = Invoke-RestMethod -Uri $FUNC_URL -Method POST -Headers $headers -Body $body -TimeoutSec 180
        $processed += $r.processed
        $failed    += $r.failed
        $skipped   += $r.skipped

        # Mostrar resultado por time
        $status = foreach ($t in $b) {
            $v = $r.teams.$t
            if ($v -like "ok*")              { "✅ $t" }
            elseif ($v -like "skipped*")     { "⏭ $t" }
            else                             { "❌ $t ($v)" }
        }
        Write-Host " → $($status -join ' | ')" -ForegroundColor Green
    } catch {
        $failed += $b.Count
        Write-Host " → TIMEOUT/ERRO: $_" -ForegroundColor Red
        Write-Host "   Tente reduzir BATCH_SIZE para 2 se timeouts persistirem." -ForegroundColor Yellow
    }

    if ($i -lt $totalBatches - 1) {
        Start-Sleep -Seconds $DELAY_BETWEEN
    }
}

Write-Host ""
Write-Host "=== CONCLUÍDO ===" -ForegroundColor Cyan
Write-Host "Processados: $processed | Ignorados: $skipped | Erros: $failed"
