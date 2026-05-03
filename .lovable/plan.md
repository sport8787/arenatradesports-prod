
# Diagnóstico de Engajamento — Arenas Punter & Live

## 1. O retrato real (dados de hoje)

Consultei o banco. Os números explicam por que apenas 5–7 usuários estão ativos:

| Métrica | Valor | Leitura |
|---|---|---|
| Usuários totais | 143 | Base existe |
| Ativos 24h | 5 | 3,5% |
| Ativos 7d | 42 | 29% |
| Retornaram alguma vez (>24h após cadastro) | 25 | **Apenas 17% voltaram um segundo dia** |
| Usuários com push ativado | 4 | **3% — gargalo crítico** |
| Sinais APROVADOS últimos 7d | 74 | Sistema funciona |
| Apostas virtuais últimos 7d | **0** | **Ninguém testa os sinais — fricção total entre ver e agir** |
| Trial expirando | (vários) | Conversão depende de hábito antes do D14 |

**Conclusão central:** o produto está entregando sinais (74 em 7 dias), mas o usuário não fecha o loop "vejo sinal → aposto virtualmente → recebo resultado → volto amanhã". A retenção morre no D1 porque não há gancho de retorno automático nem prova de valor pessoal.

## 2. Diagnóstico UX por arena (perspectiva do usuário novo)

### Arena Punter (`/punter`)
**Pontos fortes já implementados:**
- `OnboardingTour` de 4 passos (Brain → Target → Bankroll → Live)
- `PunterMenuHeroStatus` mostra Sinais hoje / ROI 7d / G/R
- Modo simples × avançado via `usePunterViewMode`
- `PunterRankings`, `PerformanceCertificate`, `EbookWelcomeCard`

**Fricções residuais:**
1. **Página de 2.313 linhas** — densidade visual alta para quem chega; muitos painéis condicionais (Backtest, Sherlock, Pattern Mining, Self Learning, Portfolio, Antilimiting…). Mesmo com modo simples, o primeiro impacto ainda é "painel de Bloomberg".
2. **Sinais APROVADOS não convidam à ação** — 74 sinais em 7d e zero apostas virtuais significa que o caminho "Sinal aprovado → aposta virtual em 1 clique" não está óbvio (ou parece complexo).
3. **Não há "Hoje você precisa ver isto"** — quando o usuário abre, vê listas e tabs. Falta um card único de destaque ("O melhor sinal de hoje, com base no seu plano: X com edge Y%").
4. **Onboarding termina e some** — após o tour de 4 passos, não há checklist persistente ("✅ Vi um sinal · ⬜ Fiz minha 1ª aposta virtual · ⬜ Ativei push · ⬜ Vi resultado liquidado").
5. **Sem prova social local** — o `PunterRankings` existe mas está atrás de um botão. O novo usuário não vê "outros 3 usuários acertaram esse sinal hoje".

### Arena Live / Trader Sports (`/arena-trader-sports`)
**Pontos fortes:**
- Tabs claras (Todos / Próximos / Ao Vivo / Aprovados / Pré-Live / Finalizados / Simulado)
- Badges com contagem de aprovados e pré-live em destaque
- `BankrollWidget`, `ActivePositions`, indicador de última sincronização
- `LiveCronToggle` para admin

**Fricções residuais:**
1. **Excesso de tabs no topo (8 abas)** — em mobile (viewport atual 743×445) vira scroll horizontal. Usuário novo não sabe que "Aprovados" é o que importa.
2. **Sem estado vazio educativo** — quando não há jogo ao vivo (boa parte do dia), a tela parece "quebrada". Não diz "Próximo jogo relevante começa às 16h, ative o push para ser avisado".
3. **Quiet window 02h–08h BR sem aviso na UI** — usuário admin que liga "LIVE ON" nesse horário vai pensar que está com bug. Já está implementado no servidor, mas a UI não mostra "Modo silencioso ativo até 08h BR".
4. **Chat com Mycroft escondido como botão pequeno** entre Sinais Aprovados, Eventos Raros, Performance — perde força como diferencial.
5. **Sem "destaque do dia"** — mesmo problema do Punter: lista densa em vez de um card "JOGO DO DIA segundo o Mycroft".

## 3. O que falta para o usuário voltar todo dia

Pensando como o usuário recém-cadastrado de 50% OFF que tem 14 dias de trial:

| Gancho de retorno | Existe hoje? | Impacto esperado |
|---|---|---|
| Push notification de sinal aprovado | Sim, mas só 4/143 ativaram | **Crítico** |
| Email diário com resumo do dia anterior | Não | Alto |
| Streak de dias consecutivos visível | Não | Alto |
| Card "ontem o Mycroft acertou X de Y" ao logar | Parcial (faixa hero, mas sem call-to-action) | Médio |
| Resumo pessoal "suas apostas virtuais essa semana" | Não (porque ninguém aposta) | Alto |
| Onboarding-checklist persistente | Não | Alto |
| Botão "Apostar virtual" em 1 clique no sinal | Existe mas escondido | **Crítico** |

## 4. Plano de implementação — 3 ondas

### Onda 1 — Quick wins de retenção (esta sessão)
Tudo client-side / pequenas tabelas, sem mexer em IA:

1. **Push opt-in agressivo no primeiro login**
   - Modal único após o `OnboardingTour` ("Receber alerta quando o Mycroft aprovar um sinal? — sim/depois") com track no PostHog.
   - Banner persistente no topo do `/punter` enquanto não houver subscription, fechável por 24h via localStorage.

2. **Checklist de ativação no `/punter/menu`**
   - Card abaixo do `PunterMenuHeroStatus`: "Comece em 4 passos" com persistência em `localStorage` (e opcionalmente em uma tabela `user_activation_checklist`).
   - Itens: Ver primeiro sinal aprovado · Ativar push · Fazer 1ª aposta virtual · Configurar banca.
   - Cada item completo dá um "+ check" verde e um micro-confete.

3. **Card "Destaque de Hoje" no topo do `/punter` e `/arena-trader-sports`**
   - Pega o sinal com maior `asset_score` do dia (ou maior edge), mostra hero card grande com:
     `🏆 SINAL DO DIA · Liga · Time A vs Time B · Mercado · Odd · Edge %` + botão "Apostar virtual com 5%" em 1 clique.
   - Some quando o jogo começa.

4. **Banner "Resumo de ontem"**
   - No primeiro acesso do dia: "Ontem o Mycroft analisou X jogos · Aprovou Y · Acertou Z (W%)" — se ROI positivo, em verde com micro-confete.
   - Persistir `last_summary_seen_date` em localStorage.

5. **Redução de tabs na Arena Live em mobile**
   - Em viewport <768px, esconder "Simulado" e "Finalizados" atrás de um menu "Mais ▾", e mover "Aprovados" para a 2ª posição (default highlight).

6. **Estado vazio educativo na Arena Live**
   - Quando não há jogos ao vivo: card grande "Próximo jogo relevante: [time] às [hora]. [Ativar push]" em vez de só "nenhum jogo".

7. **Aviso de quiet window 02h–08h BR**
   - No `LiveCronToggle`, mostrar badge "🌙 Modo silencioso ativo (02h–08h BR)" quando dentro da janela, para evitar suporte/confusão.

### Onda 2 — Email + streak (próxima sessão)
Requer cron + edge function nova:

8. **Email diário de resumo (07h BR)**
   - Edge function `daily-recap-email` enviada para usuários com `daily_recap_enabled=true` (default ON para trial).
   - Conteúdo: "Ontem: X aprovados, Y acertos, ROI Z%. Hoje: N jogos no radar, primeiro às HH:MM. [Abrir Arena Punter]".
   - Tabela `daily_recap_log` para idempotência.

9. **Streak de dias consecutivos**
   - Tabela `user_streaks(user_id, current_streak, best_streak, last_login_date)`.
   - RPC `bump_streak()` chamado em todo login bem-sucedido.
   - Badge no header do `/punter`: "🔥 5 dias seguidos".

10. **"Minhas apostas virtuais" em destaque**
    - Após primeira aposta virtual, widget fixo mostrando "Suas apostas: X pendentes · Y green · Z red · ROI W%".

### Onda 3 — Otimizações opcionais
11. Notificação push 30min antes do sinal aprovado começar.
12. Compartilhar sinal/resultado em WhatsApp com card visual (já existe `CopySignalActions`, expandir).
13. Gamificação leve: "Você está no top 20% da semana".

## 5. Detalhes técnicos (para a implementação)

**Tabelas novas (Onda 1+2):**
```sql
-- Onda 1
CREATE TABLE user_activation_checklist (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  saw_first_signal bool DEFAULT false,
  enabled_push bool DEFAULT false,
  placed_first_virtual_bet bool DEFAULT false,
  configured_bankroll bool DEFAULT false,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE user_activation_checklist ENABLE ROW LEVEL SECURITY;
-- policy: user manages only own row

-- Onda 2
CREATE TABLE user_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak int DEFAULT 0,
  best_streak int DEFAULT 0,
  last_login_date date,
  updated_at timestamptz DEFAULT now()
);
-- + RPC bump_streak() SECURITY DEFINER
```

**Componentes novos:**
- `src/components/punter/DailyHighlightCard.tsx` — hero do dia
- `src/components/punter/ActivationChecklist.tsx` — 4 itens
- `src/components/punter/PushOptInModal.tsx`
- `src/components/punter/YesterdayRecapBanner.tsx`
- `src/components/arena-trader/EmptyStateNextMatch.tsx`
- `src/components/arena-trader/QuietWindowBadge.tsx`

**Componentes editados:**
- `src/pages/PunterMenu.tsx` — adicionar `ActivationChecklist` abaixo do hero status
- `src/pages/Punter.tsx` — `DailyHighlightCard` + `YesterdayRecapBanner` no topo
- `src/pages/ArenaTraderSports.tsx` — empty state + reordenação de tabs em mobile
- `src/components/arena-trader/LiveCronToggle.tsx` — `QuietWindowBadge`

**Tracking PostHog (extender `src/lib/analytics.ts`):**
- `activation_step_completed`, `daily_highlight_clicked`, `push_optin_shown`, `push_optin_accepted`, `yesterday_recap_seen`, `streak_milestone`.

## 6. O que NÃO vou mexer

- Lógica de IA, prompts, edge functions de análise (já estão estáveis após o fix de hoje)
- Sportmonks / API-Football (vamos só observar a quota)
- Sistema de assinatura / paywall
- Modo simples × avançado (já funciona)

## 7. Pergunta antes de implementar

A Onda 1 são 7 mudanças relativamente simples mas tocam várias telas. **Posso seguir com as 7 todas de uma vez na próxima mensagem (build mode)**, ou prefere que eu entregue por blocos (3+2+2)?
