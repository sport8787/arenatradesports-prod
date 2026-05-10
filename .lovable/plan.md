
# Reavaliação honesta: migrar para Supabase próprio AGORA não resolve nada

Você escolheu reavaliar — e essa é a decisão certa. Vou ser direto:

---

## Suas 3 motivações vs realidade

### 1. "Crashes/performance recentes"
**Não vai melhorar migrando.** O crash de hoje teve causa identificada e corrigida:
- Faltava índice parcial em `live_matches` (criado).
- `update-live-odds` carregava JSON pesado de `cached_odds_games` em toda execução (corrigido com lazy load).
- UPDATEs sequenciais geravam lock contention (paralelizados).
- Instância subdimensionada (subiu para 8GB).

Se você levar o mesmo schema e os mesmos cron jobs pro Supabase próprio com a mesma instância, vai dar **o mesmo crash**. O Supabase de baixo é o mesmo Postgres.

### 2. "Custo"
**Provavelmente fica MAIS caro, não mais barato.** Comparativo realista para o seu uso atual (8GB, ~80 edges, ~20 crons, tráfego intenso):
- **Lovable Cloud:** já incluso no plano Lovable, billing unificado.
- **Supabase Pro direto:** ~US$25/mês base + compute add-on (Large 8GB ≈ US$110/mês) + egress + edge function invocations + storage. Estimativa US$ 150–250/mês só de Supabase, **fora** o plano Lovable que você continua pagando para editar o app.

Você paga **dois** fornecedores em vez de um. Só compensa se sair também da Lovable — o que é uma decisão muito maior.

### 3. "Medo de lock-in"
**Esse é o único ponto legítimo.** E tem solução parcial sem migrar:
- O schema, edges e RLS já são 100% Postgres/Deno padrão Supabase. Se um dia precisar sair, o caminho é o mesmo (export schema + redeploy edges + repointar client).
- **A migração HOJE não te dá vantagem nenhuma** — ela apenas antecipa um trabalho que custa o mesmo se feito em 6 meses, 1 ano, ou nunca.

---

## Riscos REAIS de migrar agora

```text
Janela de manutenção         4–8h de downtime obrigatório (cutover único)
Edge functions               ~80 funções para redeploy + revalidar secrets
Cron jobs                    ~20 jobs pg_cron com URLs hardcoded (precisam reescrever)
Auth users                   Migração de senhas: possível mas frágil
Webhooks externos            Telegram, Resend, PostHog, Vercel rewrites — todos
                             apontam para affquongjlhmusxzohjl.supabase.co.
                             Cada um precisa ser reapontado manualmente.
URLs no código               36+ ocorrências hardcoded de affquongjlhmusxzohjl
                             em edges (notify_aprovado_broadcast, triggers SQL,
                             punter functions, etc.) — buscar/substituir tudo
Realtime                     Reassinar canais; testar push notifications
Storage                      Migrar buckets seo-static, audio, etc.
Risco operacional            Você opera live durante jogos. Qualquer bug pós-
                             migração afeta usuários pagantes em tempo real.
```

E o pior: **se algo der errado, não tem rollback fácil** — voltar pra Lovable Cloud significa migrar tudo de novo na direção oposta.

---

## Minha recomendação

**Não migre agora. Use os próximos 2–3 meses para:**

1. **Otimizar o que está aqui** — ainda tem ganhos fáceis: índices faltantes em outras tabelas quentes (`punter_signals`, `mycroft_analyses`, `virtual_bets`), revisar queries das outras edges que rodam por cron, adicionar `statement_timeout` local nas edges críticas.
2. **Monitorar de verdade** — você já tem `edge_function_runs` e `edge_function_errors`. Vamos criar um painel de saúde (queries lentas, locks, % de erro por edge) para detectar gargalo *antes* de virar crash.
3. **Documentar dependências externas** — listar tudo que aponta para `affquongjlhmusxzohjl.supabase.co`. Quando/se migrar, esse inventário vira o checklist de cutover.
4. **Reavaliar em 90 dias.** Se nesse período você tiver: (a) atingido limites que upgrade de instância não resolve, (b) precisar de read replicas / branching / PITR avançado, ou (c) decidir sair da Lovable também, **aí** a migração faz sentido. E você terá inventário pronto.

---

## Quando migrar FAZ sentido

Marque pelo menos 2 destes para considerar:
- [ ] Você decidiu sair da Lovable como ferramenta de edição.
- [ ] Precisa de Point-in-Time Recovery, read replicas ou branching que Cloud não expõe.
- [ ] Tem equipe técnica dedicada para operar Postgres/edges direto.
- [ ] Volume de dados/tráfego justifica negociar contrato direto com Supabase.
- [ ] Quer multi-região ou self-hosting.

Hoje você não marca nenhum.

---

## Próximo passo proposto

Em vez de migrar, **execute uma rodada de hardening do que está aqui**:
- Auditoria de índices em todas as tabelas com >100k rows.
- Painel admin de saúde (lock waits, queries >1s, top edges por tempo).
- `statement_timeout` por função crítica.
- Documento `MIGRATION_INVENTORY.md` listando todo recurso/URL externo (vira o seu seguro caso decida migrar no futuro).

Quer que eu monte esse plano de hardening + inventário de migração como próxima tarefa?

