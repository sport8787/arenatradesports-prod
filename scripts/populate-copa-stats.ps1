# populate-copa-stats.ps1
# Chama enrich-copa-stats para os times da Copa 2026
# Uso:
#   .\scripts\populate-copa-stats.ps1              # todos os times (batch)
#   .\scripts\populate-copa-stats.ps1 -Team Brazil  # time especifico

param(
    [string]$Team = ""
)

# Carrega .env
$envFile = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.env"))
if (Test-Path $envFile) {
    Get-Content $envFile | Where-Object { $_ -match "^[^#].+=.+" } | ForEach-Object {
        $parts = $_ -split "=", 2
        [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim())
    }
}

$SUPABASE_URL = [System.Environment]::GetEnvironmentVariable("VITE_SUPABASE_URL")
$SUPABASE_KEY = [System.Environment]::GetEnvironmentVariable("VITE_SUPABASE_PUBLISHABLE_KEY")

if (-not $SUPABASE_URL) {
    Write-Host "ERRO: VITE_SUPABASE_URL nao encontrado no .env"
    exit 1
}

$FN_URL = "$SUPABASE_URL/functions/v1/enrich-copa-stats"

$headers = @{
    "Content-Type"  = "application/json"
    "Authorization" = "Bearer $SUPABASE_KEY"
    "apikey"        = $SUPABASE_KEY
}

Write-Host "================================================"
Write-Host "  Copa 2026 - Enrich Stats"
Write-Host "================================================"

if ($Team) {
    Write-Host "Processando: $Team"
    $bodyObj = @{ team = $Team }
} else {
    Write-Host "Modo batch - processando todos os times..."
    $bodyObj = @{ batch = $true }
}

$body = $bodyObj | ConvertTo-Json

try {
    $resp = Invoke-RestMethod -Uri $FN_URL -Method POST -Headers $headers -Body $body -TimeoutSec 300

    Write-Host ""
    Write-Host ("Concluido: " + $resp.ok + " ok | " + $resp.skipped + " pulados")
    Write-Host ""

    foreach ($r in $resp.results) {
        if ($r.status -eq "ok") {
            $icon = "[OK]"
        } elseif ($r.status -eq "no_nat_stats") {
            $icon = "[SEM DADOS]"
        } else {
            $icon = "[ERRO]"
        }

        $line = "$icon $($r.team)"
        if ($r.form) { $line += " | forma: $($r.form)" }
        if ($null -ne $r.xg) { $line += " | xG: $($r.xg)" }
        if ($r.source -and $r.source -ne "ok" -and $r.source -ne "no_nat_stats" -and $r.source -ne "error") {
            $line += " [$($r.source)]"
        }
        Write-Host $line
    }
} catch {
    Write-Host ("ERRO: " + $_.Exception.Message)
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host ("Response: " + $reader.ReadToEnd())
        } catch {}
    }
}

Write-Host ""
