---
name: Day Pass Funnel & Upsell
description: Funil completo Day Pass R$ 9,90/24h → upsell R$ 47/mês recorrente + sequência email/push de retenção
type: feature
---

## Funil
- **Topo:** `https://oraculo-mycroft.com/lp/day-pass.html` → `/day-pass` (signup nome+email+senha) → `/lobby-preview` (tour + áudio Hórus) → CPF + Pix R$ 9,90 → `/punter` após webhook.
- **Tabelas:** `asaas_charges` (cobrança Day Pass + cobranças da assinatura mensal), `asaas_webhook_events`, `day_pass_upsells` (estado da assinatura recorrente por usuário), `day_pass_lifecycle_log` (dedup envios).

## Upsell in-app (R$ 47/mês recorrente Asaas)
- Gatilhos `useDayPassUpsell`: **1º GREEN do dia** | **≤ 4h restantes** | **≤ 1h restantes** (prioridade reversa).
- Banner sticky no topo (`UpsellBanner`) + modal CPF (`UpsellModal`) → edge `asaas-create-subscription` (POST `/v3/subscriptions` cycle=MONTHLY, billingType=PIX, value=47).
- Primeira cobrança da assinatura cai em `asaas_charges` com `product_slug='subscription_monthly'` + `duration_hours=720` → webhook genérico já estende `user_subscriptions` em 30 dias.
- Dismiss persistido em `localStorage` (`upsell:dismissed:<uid>:<trig>`) para não spammar.
- Mount global em `App.tsx` (componente `UpsellGate`).

## Sequência de comunicação (`day-pass-lifecycle-notify`, cron diário 13h UTC)
| Touch | Janela após paid_at do Day Pass | Canal |
|---|---|---|
| D0_4H | 20-24h | Email + Push |
| D1 | 24-48h | Email |
| D2 | 48-72h | Push |
| D5 | 5-6 dias | Email (recap real greens/wr/lucro últimos 5 dias) |
| D15 | 15-16 dias | Email (cupom VOLTA27 — R$ 27 por 30 dias, última oferta) |

Dedup via UNIQUE(user_id, touch, channel) em `day_pass_lifecycle_log`.
Usuários com `day_pass_upsells.status='active'` são pulados.

## Eventos PostHog
`upsell_modal_viewed`, `upsell_cpf_submitted`, `upsell_pix_generated`, `upsell_banner_viewed`, `upsell_cta_clicked` (todos com `trigger`).

## Secrets exigidos
`ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_ENV=production`, `RESEND_API_KEY`.
