## Objetivo
Expandir o Trader Sports de ~17 ligas hoje no whitelist para **120-150**, sem estourar custo Gemini nem quota da API-Football, usando sistema de **tiers A/B/C**.

## Diagnóstico atual
- `fetch-live-matches/index.ts` tem whitelist hardcoded (`LIGAS_PERMITIDAS`) com 17 ligas top.
- `handicap-asiatico-prelive/index.ts` e `plano-favorito-prelive/index.ts` têm seus próprios sets reduzidos (~18 ligas) e chamam Gemini por jogo.
- `analyze-live-matches` (motor ao vivo) é **determinístico** — não chama IA. Então expandir cobertura ao vivo tem custo de quota API-Football, mas **zero custo Gemini**.
- `arena-trader-jury` é chamado sob demanda (não em loop por jogo).

Conclusão: o custo Gemini concentra-se nas edges pré-live (HA, Plano Favorito). Live é "barato" do lado da IA.

## Estratégia de tiers

| Tier | Ligas | Live (analyze-live) | Pré-live (HA + Favorito) | Modelo Gemini |
|------|-------|---------------------|---------------------------|---------------|
| **A** | ~30 top (atual) | ✅ completo | ✅ análise completa | gemini-2.5-flash |
| **B** | ~60 médio | ✅ completo | ✅ prompt enxuto + max 25 jogos | gemini-2.5-flash-lite |
| **C** | ~40 cauda longa | ✅ completo | ❌ só Sherlock (estatística pura, sem IA) | — |

Resultado: 3-5x mais cobertura, custo Gemini cresce ~30-40% (não 8x).

## Implementação

### 1. Migração — tabela `trader_leagues`
```sql
CREATE TABLE public.trader_leagues (
  league_id integer PRIMARY KEY,
  name text NOT NULL,
  country text,
  region text,             -- BRASIL|EUROPA|SUL_AMERICA|ASIA|NORTE_AMERICA|OUTROS
  tier text NOT NULL,      -- 'A' | 'B' | 'C'
  enabled boolean NOT NULL DEFAULT true,
  odds_sport_key text,     -- mapping pro The Odds API (quando existir)
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.trader_leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trader_leagues readable by everyone" ON public.trader_leagues FOR SELECT USING (true);
CREATE POLICY "trader_leagues admin write" ON public.trader_leagues FOR ALL USING (public.has_role(auth.uid(),'admin'));
```
Seed inicial: as 17 ligas atuais como Tier A + ~60 Tier B (Brasileirão B/C, Argentina, Chile, Colômbia, México, MLS, Eredivisie, Belga, Turca, Grega, J-League, K-League, A-League, China, Saudi, Eredivisie 2, EFL Championship/L1/L2, Bundesliga 2, La Liga 2, Serie B Italiana, Ligue 2, FA Cup, Copa del Rey, Coppa Italia, DFB-Pokal, etc.) + ~40 Tier C (3ª/4ª divisões, Cyprus, Bulgaria, Romania, Croatia, Sérvia, Israel, Egito, África do Sul, etc.).

### 2. Helper compartilhado — `_shared/leaguesRegistry.ts`
- Cache em memória (TTL 30 min) das ligas habilitadas, indexado por id e por tier.
- Funções: `getAllowedLeagueIds()`, `getLeagueTier(id)`, `getLeaguesByTier('A'|'B'|'C')`.

### 3. `fetch-live-matches/index.ts`
- Substituir `LIGAS_PERMITIDAS` constante por consulta ao registry (1x por execução, cacheado).
- Bloqueio mantém `LIGAS_BLOQUEADAS` (amistosos).

### 4. `handicap-asiatico-prelive/index.ts`
- Tier A+B somente (C nunca chega aqui).
- Tier B usa `gemini-2.5-flash-lite` e prompt 50% menor (sem H2H detalhado, sem narrativa longa).
- Limite de jogos: A=25, B=20.

### 5. `plano-favorito-prelive/index.ts`
- Mesmo padrão: A+B only, modelo por tier.

### 6. UI Admin — `/admin/trader-leagues` (opcional, mas útil)
- Nova rota com tabela editável: enable/disable, mudar tier, filtrar por região.
- Adicionar link no `AdminHub`.

### 7. Memória atualizada
Atualizar `mem://features/arena-trader-sports/league-filtering-system-v2` com a estrutura de tiers e tabela `trader_leagues`.

## Pontos técnicos a confirmar
- IDs API-Football das ligas adicionais: vou usar a lista canônica conhecida + verificação contra `/leagues` da API.
- Se uma liga não tiver `odds_sport_key`, o HA pula (já é o comportamento atual).
- Sherlock (cauda longa) já roda sem IA na própria edge `mycroft-punter-analytic` — não precisa mudar nada lá.

## Entregas
1. Migração + seed das ligas (uma única ação `supabase--migration` para schema, depois `supabase--insert` para o seed).
2. `_shared/leaguesRegistry.ts` (novo).
3. Edits em `fetch-live-matches`, `handicap-asiatico-prelive`, `plano-favorito-prelive`.
4. `/admin/trader-leagues` + entrada no `AdminHub`.
5. Memória atualizada.

Aprovado o plano, começo pela migração da tabela.