## Objetivo
Transformar leads Day Pass (R$ 9,90 / 24h) em assinantes recorrentes (R$ 47/mês) antes da janela expirar, com fallback de 5 emails + 3 pushes pós-expiração.

---

## 1. Backend — Asaas Subscription R$ 47/mês

### 1.1 Tabela `day_pass_upsells`
```
user_id, asaas_subscription_id, status (pending|active|cancelled|overdue),
first_charge_id, first_payment_at, next_due_date, cancelled_at,
created_at, updated_at
```
RLS: usuário lê próprio; service role escreve.

### 1.2 Edge function `asaas-create-subscription`
- Recebe `{ cpfCnpj }` do usuário autenticado.
- Cria/recupera customer Asaas (reusa do `asaas-create-charge`).
- POST `/v3/subscriptions` com `billingType=PIX`, `value=47`, `cycle=MONTHLY`, `nextDueDate=hoje+1`, `description="Oráculo Mycroft — Assinatura Mensal"`.
- Persiste em `day_pass_upsells` com status=`pending`.
- Retorna `{ subscriptionId, firstChargeId, pixQrCode, pixPayload, invoiceUrl }` pegando 1ª cobrança via `/v3/payments?subscription=`.

### 1.3 Extensão do `asaas-webhook`
- Já trata `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` do Day Pass.
- Adicionar: se `subscription` presente no payload → atualiza `day_pass_upsells` (status=`active`, atualiza `next_due_date`) e estende `user_subscriptions` por 30 dias (`plan='premium'`, `is_active=true`, `current_period_end=now()+30d`).
- Tratar `PAYMENT_OVERDUE` → `status=overdue`.
- Tratar `SUBSCRIPTION_DELETED` → `status=cancelled`.

---

## 2. Frontend — Upsell in-app

### 2.1 Hook `useDayPassUpsell`
- Lê do banco: tempo restante do Day Pass, status do upsell, se já tem GREEN no dia.
- Calcula gatilhos:
  - **Trigger A:** primeiro GREEN detectado (subscribe a `virtual_bets_punter`/`punter_sinais` onde `resultado=GREEN` e `user_id`=atual).
  - **Trigger B:** restando ≤ 4h.
  - **Trigger C:** restando ≤ 1h.
- Estado de dismiss por gatilho em `localStorage` (não spammar).

### 2.2 Componente `UpsellModal`
- Headline dinâmica por gatilho:
  - GREEN: "Você acaba de ver o Oráculo trabalhar. Continue por R$ 47/mês."
  - 4h: "Faltam 4h. Garanta acesso contínuo por R$ 47/mês."
  - 1h: "ÚLTIMA HORA. Não perca o ritmo — R$ 47/mês."
- Input CPF (mascarado, validado) → chama `asaas-create-subscription`.
- Mostra QR Code Pix + copia-cola + spinner aguardando webhook (igual `LobbyPreview`).
- Banner persistente no topo (cor mudando por urgência) com botão "Continuar acesso".

### 2.3 Montagem global
- `UpsellGate` em `App.tsx` (dentro do RequireSubscription) renderiza modal/banner se `useDayPassUpsell.shouldShow`.

---

## 3. Sequência Email/Push pós-Day Pass

### 3.1 Edge function `day-pass-lifecycle-notify` (cron diário 13h UTC)
Lê leads do Day Pass via `user_subscriptions` + `day_pass_upsells`:

| Janela após signup | Canal | Mensagem |
|---|---|---|
| D+0 (4h antes de expirar) | Email + Push | "Seu acesso expira em 4h. Assine R$ 47/mês e mantenha o ritmo." |
| D+1 (24h após expirar, sem upsell ativo) | Email | "Você viu o Oráculo trabalhar ontem. Volte por R$ 47/mês." |
| D+2 | Push | "Hoje teve GREEN no Punter. Você está fora." (texto dinâmico se houve green) |
| D+5 | Email | Recap de resultados reais dos últimos 5 dias (greens/wr/lucro) + CTA |
| D+15 | Email (última) | "Reativação R$ 27 nos próximos 7 dias" (cupom único) |

Dedup via tabela `day_pass_lifecycle_log` (user_id, touch, sent_at).

### 3.2 Cron
`SELECT cron.schedule('day-pass-lifecycle', '0 13 * * *', ...)`

---

## 4. Analytics PostHog

Eventos novos em `src/lib/analytics.ts`:
- `day_pass_signup` (já existe? confirmar)
- `lobby_preview_viewed`
- `liberar_arenas_clicked`
- `pix_day_pass_generated`
- `pix_day_pass_paid`
- `upsell_modal_viewed` (trigger: green|4h|1h)
- `upsell_cpf_submitted`
- `upsell_pix_generated`
- `upsell_pix_paid`
- `lifecycle_email_sent` (touch: D0|D1|D5|D15)

---

## 5. Memória
Salvar `mem://features/day-pass/funnel-and-upsell` com: ticket R$ 9,90 → upsell R$ 47/mês recorrente, gatilhos green/4h/1h, sequência D0/D1/D2/D5/D15.

---

## Migrations necessárias
1. Tabela `day_pass_upsells` + RLS.
2. Tabela `day_pass_lifecycle_log` + RLS.
3. Cron `day-pass-lifecycle` (via insert tool, com URL e anon key).

## Edges novas
- `asaas-create-subscription`
- `day-pass-lifecycle-notify`

## Edges editadas
- `asaas-webhook` (subscription events)

## Arquivos frontend
- novo: `src/hooks/useDayPassUpsell.ts`
- novo: `src/components/upsell/UpsellModal.tsx`
- novo: `src/components/upsell/UpsellBanner.tsx`
- novo: `src/components/upsell/UpsellGate.tsx`
- edit: `src/App.tsx` (montar UpsellGate)
- edit: `src/lib/analytics.ts` (eventos novos)

---

## Detalhe técnico Asaas Subscription
- Endpoint: `POST {ASAAS_BASE}/v3/subscriptions`
- Pix recorrente: o Asaas gera **uma nova cobrança Pix por ciclo** automaticamente. Primeira cobrança via `GET /v3/payments?subscription={id}&limit=1`.
- Webhook envia `PAYMENT_RECEIVED` em cada renovação → nossa edge estende `current_period_end` em 30 dias a cada pagamento.
- Cancelamento user-side: futuro (não no escopo desta entrega).

---

## Fora de escopo (alertar usuário)
- Página de cancelamento de assinatura (admin pode cancelar via Asaas direto por enquanto).
- Tela "Minha assinatura" detalhada com histórico de cobranças.
- Cupom único D+15 (gera valor fixo R$ 27 — implementação simples, mas notificar).

Tempo estimado: 2 migrations + 2 edges novas + 1 edge editada + 4 arquivos frontend.
