---
name: Trader Sports Telegram — apenas ligas principais
description: notify-trader-event filtra APROVADO/LABAREDA e só envia ao grupo @oraculo_mycroft_trader sinais de ligas principais (Brasileirão, top-5 europeias, copas continentais, seleções). GREEN/RED/CASHOUT seguem para qualquer liga.
type: feature
---
Após expansão de ligas, sinais aprovados explodiram (~5x). Para evitar ruído no grupo Telegram `@oraculo_mycroft_trader` (t.me/oraculo_mycroft_trader/1):

- `supabase/functions/notify-trader-event/index.ts` aplica `isMainLeague(payload.league)` antes do envio.
- Whitelist regex MAIN_LEAGUE_PATTERNS: Brasileirão/Série A, Copa do Brasil, Libertadores, Sul-Americana, Copa América, Premier League, La Liga, Serie A (Itália), Bundesliga, Ligue 1, Champions/Europa/Conference League, World Cup, Eurocopa.
- Sinais de ligas fora da whitelist são `skipped: true, reason: 'non_main_league'` — NÃO entram em `trader_notifications_sent` (podem ser reavaliados depois).
- Eventos pessoais (GREEN/RED/CASHOUT) ignoram o filtro e seguem normal.
- Pendente: análise de ROI por liga para decidir se vale a pena manter aprovação em ligas não-principais ou apenas exibir como "informativo" no app.
