## A/B Lab — Página de testes controlados antes de promover ao global

Objetivo: criar `/admin/ab-lab` para rodar qualquer mudança candidata (provider de IA, prompt, regra de aprovação, threshold) em paralelo ao motor atual, registrando decisões em uma tabela isolada (`ab_decisions`) sem poluir o feed real. Promoção ao global só com evidência estatística.

### Fase 1 — Backend (tabelas + RPC)

Migração SQL:
- `ab_experiments` (id, name, hypothesis, scope `punter|trader|chats`, variant_a_config jsonb, variant_b_config jsonb, status `draft|running|paused|promoted|discarded`, started_at, ended_at, created_by, notes)
- `ab_decisions` (id, experiment_id FK, match_id, market, variant `A|B`, verdict, probability, edge, stake, raw jsonb, created_at, settled_at, result `GREEN|RED|VOID|null`, pnl)
- Índices: `(experiment_id, variant)`, `(experiment_id, match_id, market, variant)` unique
- RLS: somente admins (`has_role(auth.uid(),'admin')`)
- Trigger de espelhamento: quando `virtual_bets` (ou `punter_signals`) liquida, copia `result/pnl` para `ab_decisions` com mesmo `match_id+market`
- RPC `ab_compute_metrics(experiment_id uuid)` → retorna por variante: total, approved, GREEN%, ROI%, stake médio, drawdown, p-value chi-quadrado entre A e B

### Fase 2 — Integração nas edges candidatas

Padrão mínimo, opt-in via parâmetro:
- Cada edge candidata (ex.: `mycroft-punter-sportmonks` Groq, `mycroft-punter-anthropic` Gemini, futuras variações de prompt/regra) aceita `experiment_id` e `variant` no body
- Se presente: grava em `ab_decisions` em vez de `punter_analyses/punter_signals` (zero impacto no feed real)
- Se ausente: comportamento atual inalterado
- Mesmo `match_id` deve poder ser analisado por A e B no mesmo experimento

Cron opcional `ab-lab-runner` (1×/dia): para cada experimento `running`, pega as N partidas do dia e dispara A e B em paralelo para a mesma amostra. Sem cron, admin pode disparar manualmente na UI.

### Fase 3 — UI `/admin/ab-lab`

- Lista de experimentos (status, dias rodando, nº decisões A vs B)
- Botão "Novo Experimento": form com nome, hipótese, escopo, configs A/B (JSON livre — quem cria sabe o que está testando)
- Detalhe do experimento: placar lado a lado (approvals, GREEN%, ROI, p-value, drawdown), tabela de divergências do dia (mesmo jogo onde A≠B), botões "Promover B → Global" / "Descartar B" / "Pausar" / "Estender N dias"
- Histórico de experimentos encerrados

Promoção é manual: o botão só registra a decisão; aplicar o config ao motor real continua sendo trabalho explícito (edge swap, atualizar prompt, etc.). Evita auto-promoção surpresa.

### Detalhes técnicos

- Sem tocar `punter_analyses`, `punter_signals`, `virtual_bets` no fluxo A/B — tudo isolado em `ab_decisions`
- Reaproveita a lógica de `compare_providers_metrics` do `shadow-af-comparison` (mesmo padrão estatístico)
- p-value via chi-quadrado 2x2 (GREEN/RED × A/B) computado no Postgres
- Mínimo recomendado exibido na UI: 80 decisões por variante antes de habilitar botão "Promover"

### Entrega desta sprint

Fase 1 (backend completo) + Fase 3 (UI lendo dados, criar/pausar/encerrar experimento, ver métricas e divergências). Fase 2 (integração nas edges) entra como segundo passo, edge por edge, conforme você quiser testar cada mudança — assim não mexo em produção sem necessidade.

Posso começar pela Fase 1+3 agora?