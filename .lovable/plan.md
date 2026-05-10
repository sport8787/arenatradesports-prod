## Diagnóstico atualizado

Consultei `pg_stat_user_tables`. Os maiores consumidores de write IO desde o último reset:

| Tabela | UPDATEs | INSERTs | DELETEs | Observação |
|---|---:|---:|---:|---|
| `public.scheduled_games` | **35.7M** | 30k | 15k | **#1 ofensor** — write amplification gigante |
| `cron.job_run_details` | 537k | 134k | 346k | log interno pg_cron — cresce sozinho |
| `public.live_matches` | 1.04M | 4.1k | — | atualizado a cada minuto |
| `net.http_request_queue` | — | 130k | 128k | fila pg_net (5 crons /1min) |
| `net._http_response` | — | 130k | 128k | respostas pg_net |
| `public.cron_logs` | — | 121k | 325k | log próprio nosso |
| `public.edge_function_errors` | — | 59k | 66k | log de erros |
| `public.edge_function_runs` | — | 56k | 68k | log de execuções |
| `public.fixture_stats_cache` | 118k | 833 | — | cache reescrito demais |
| `public.mycroft_analyses` | seq_scan 8.7k lendo **81M rows** | | | índice ausente |

A migração anterior reduziu `scheduled_games` na fonte (`fetch-live-matches` agora só roda 4×/hora e usa `ignoreDuplicates`), mas **outras 3 fontes continuam reescrevendo a tabela inteira**:

1. `sofascore-scheduled-games` (cron por hora) faz `upsert` com `updated_at: now()` **sem `ignoreDuplicates`** → toda hora reescreve ~todas as linhas.
2. `n8n-webhook` também escreve em `scheduled_games`.
3. `update-live-odds-1min`, `futodds-upcoming-cache-60s`, `punter-steam-monitor`, `shadow-af-cron-1min` somam **5 crons/minuto** martelando pg_net + tabelas auxiliares.

E a tabela `mycroft_analyses` está fazendo seq scan em 81M de tuplas porque algum filtro não tem índice cobrindo.

---

## Plano de correção (3 frentes paralelas)

### 1. Migração SQL — eliminar write amplification e cobrir seq scans

```sql
-- (a) Truncar logs internos do pg_cron (eles crescem indefinidamente)
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '2 days';

-- (b) Limpar fila pg_net já consumida
DELETE FROM net._http_response WHERE created < now() - interval '1 day';

-- (c) Limpar nossos logs aplicacionais
DELETE FROM public.cron_logs WHERE created_at < now() - interval '3 days';
DELETE FROM public.edge_function_errors WHERE created_at < now() - interval '3 days';
DELETE FROM public.edge_function_runs  WHERE started_at  < now() - interval '3 days';

-- (d) Índice composto para mycroft_analyses (cobre o filtro mais comum
--     verdict + match_id + created_at usado em vários joins/triggers)
CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_match_verdict_created
  ON public.mycroft_analyses (match_id, verdict, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_verdict_created
  ON public.mycroft_analyses (verdict, created_at DESC)
  WHERE verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA');

-- (e) Crons periódicos de auto-limpeza (executam à noite)
SELECT cron.schedule(
  'cleanup-internal-pgcron-logs-daily',
  '15 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '2 days';$$
);
SELECT cron.schedule(
  'cleanup-pgnet-response-daily',
  '20 3 * * *',
  $$DELETE FROM net._http_response WHERE created < now() - interval '1 day';$$
);

-- (f) ANALYZE pós-mudanças
ANALYZE public.mycroft_analyses;
ANALYZE public.scheduled_games;
ANALYZE public.live_matches;
```

### 2. Edge function `sofascore-scheduled-games` — corte de 99% das writes

- Adicionar `{ onConflict: '...', ignoreDuplicates: true }` igual ao `fetch-live-matches`.
- Remover `updated_at: new Date()` do payload (assim conflitos não disparam UPDATE).
- Trocar o loop de 200 upserts individuais por **1 upsert em batch** (chunks de 200).

Resultado esperado: a tabela só recebe INSERT quando aparece um jogo novo. Hoje cada execução horária reescreve ~todas as linhas.

### 3. Reduzir frequência de crons de 1min

Hoje rodam **5 crons/minuto** (300/hora cada um abrindo HTTP via pg_net):

| Job | Atual | Proposto | Justificativa |
|---|---|---|---|
| `cron-live-matches-1min` | `* * * * *` | manter | dado ao vivo precisa de 1min |
| `update-live-odds-1min` | `* * * * *` | `*/2 * * * *` | odds movem em janela de minutos |
| `punter-steam-monitor` | `* * * * *` | `*/2 * * * *` | drift 4%/15min — 2min basta |
| `futodds-upcoming-cache-60s` | `* * * * *` | `*/3 * * * *` | cache pré-live |
| `shadow-af-cron-1min` | `* * * * *` | `*/3 * * * *` | shadow comparison, não-crítico |

Isso corta **~60% do tráfego pg_net** (de 5/min → ~2/min em média) sem afetar features críticas (alertas live + steam).

---

## Impacto esperado

- `scheduled_games`: de ~35M UPDATEs cumulativos → próximo de zero (só inserts novos). **#1 alívio**.
- pg_net: ~3 mil chamadas HTTP/dia a menos.
- pg_cron + logs internos: tabelas estabilizam em alguns dias de dados em vez de meses acumulados.
- `mycroft_analyses`: queries que faziam seq scan de 81M tuplas passam a usar índice.

Se mesmo assim o IO ficar acima de 70% após 2h, o gargalo restante é estrutural (volume de tráfego real, não código) e o upgrade de instância passa a ser a saída correta.

---

**Confirma que posso aplicar as 3 frentes?** Posso fazer tudo em sequência: migração SQL, edição da edge function, e re-`cron.schedule` dos jobs ajustados.