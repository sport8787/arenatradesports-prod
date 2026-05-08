---
name: Punter AH Quality Pipeline
description: Pipeline de qualidade dos sinais AH no Punter — Sherlock obrigatório, dispersão, calibração por bucket, quarentena e CLV
type: feature
---

Pipeline integrado em `mycroft-punter-anthropic` aplicado em cascata após análise IA:

1. **Sherlock obrigatório (AH alto risco)** — `applySherlockRules` veta AH com odd ≥ 2.0 ou |handicap| ≥ 1.5 quando faltam stats avançadas dos times, ou quando CV (home ou away) > 1.10.
2. **Calibration Floor** — rebaixa se confidence < piso global do Punter.
3. **Exchange edge (Betfair via Futodds)** — veta se edge_exchange < 4pp (genérico) e persiste open_* em `punter_clv_log`.
4. **AH Strict Dispersion** — veta AH com edge_exchange < 5pp ou sem cotação Exchange (mais conservador que o genérico).
5. **Quality Check (RPC `punter_check_signal_quality`)** — consulta `punter_quarantine` e `punter_bucket_calibration` por (liga, market_family, odd_bucket). Se quarantined → veto. Se houver `confidence_delta` → ajusta.

Cron `punter-clv-capture-5min` (*/5 * * * *) chama edge `punter-clv-capture`:
- Pega linhas de `punter_clv_log` com kickoff em -30min..+15min e `close_mid_odd IS NULL`.
- Captura quote Exchange como closing, calcula `clv_pp = (1/close_mid - 1/open_mid) * 100`.
- Roda `refresh_punter_quarantine()` ao final.

Cron `punter-bucket-calibration-daily` (04:15 UTC) executa `recompute_punter_buckets()` + `refresh_punter_quarantine()` (90d hit-rate/ROI/Brier por bucket; quarentena 14d se ROI < -5% ou CLV < -1.5pp em 30d).
