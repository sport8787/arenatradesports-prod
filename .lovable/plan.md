
# Nova Landing Page — `/lp/ia-apostas-esportivas`

Substituição completa do HTML atual (mesma URL, preserva indexação Google Ads). Foco: **capturar lead no WhatsApp**, fechar venda no atendimento humano. Sem alterações no Paywall/Kiwify/backend nesta entrega.

## 1. Estrutura da página (ordem)

1. **Topbar** — logo + 1 CTA mini "Falar no WhatsApp" (verde, não mais "testar grátis").
2. **Hero** — H1 + sub (copy nova abaixo), 2 CTAs lado a lado:
   - Primário verde: **"Falar com especialista no WhatsApp"** (`https://wa.me/5534991290648?text=...`)
   - Secundário ouro: **"Testar 24h por R$ 9,90"** → `/auth?promo=daypass`
3. **Faixa de prova social** (3 métricas curtas: jogos/dia, ROI auditado, usuários ativos).
4. **🔥 Seção "PROVA REAL" (NOVA — coração da página)** — grid com 4 mockups visuais gerados (estilo cards Mycroft autênticos):
   - 2 cards "SINAL APROVADO" Arena Punter (pré-jogo, com Asset Score, odd, edge, stake).
   - 2 cards "SINAL APROVADO LIVE" Arena Trader Sports (ao vivo, com xG, minuto, status APROVADO).
   - 1 card destaque: **"Banca real do Paulo (sócio) — R$ 2.000 → R$ 7.000 em ~30 dias"** com gráfico de crescimento estilizado + nota "2 aportes de R$ 1.000 incluídos" para honestidade.
   - Disclaimer fino abaixo: "Resultados individuais variam. Apostas envolvem risco."
5. **"Quem é o Mycroft" (3 pilares)** — Arena Punter (pré-jogo), Arena Trader Sports (ao vivo), Hórus (coach IA).
6. **Como funciona (3 passos)** — Cadastra → Recebe sinais aprovados (push/Telegram) → Aposta com edge matemático.
7. **🆕 Seção "Planos"** (3 cards + faixa day-pass):
   - **Plano Iniciante** — R$ 49,90/mês — Arena Punter (pré-jogo) + Telegram VIP
   - **Plano Profissional do Esporte** — R$ 149,90/mês — Punter + Trader Sports (ao vivo) — badge "MAIS ESCOLHIDO"
   - **Plano Trading de Elite** — R$ 249,90/mês — Tudo + Múltiplas + Banca Real Betfair + Chat Mycroft + Eventos Raros
   - Faixa horizontal abaixo dos 3 cards: **"Quer testar antes? Day Pass 24h por R$ 9,90 → libera tudo"** com CTA.
   - Cada plano tem 2 botões: "Assinar" (Kiwify atual) + "Falar no WhatsApp antes" (verde).
8. **FAQ** (atualizado: substitui pergunta "teste grátis" por "como funciona o Day Pass R$ 9,90" + "posso falar com humano antes de assinar").
9. **CTA final** — repete WhatsApp como destaque + day pass secundário.
10. **Footer** + **Sticky mobile CTA** (WhatsApp verde).

**Mantém:** `FloatingWhatsApp` flutuante já existente, Meta Pixel, UTMs, JSON-LD (atualizado para refletir Day Pass R$ 9,90 e remover "teste grátis 7 dias").

## 2. Copy do Hero (sua deixa finalizada)

> **H1:** "Se você é trader esportivo, punter ou apostador casual e ainda **não usa o Oráculo Mycroft**, está deixando dinheiro na mesa."
>
> **Sub:** "No próximo minuto eu te conto quem é o Mycroft e como ele te leva à **consistência real** — sem palpite, sem tipster, sem torcida. Hoje você entende exatamente como vencer a casa."
>
> *(Sob o sub, em fonte menor, badge cinza:)* "Aviso de risco: apostas envolvem perda. Resultados passados não garantem futuros."

A promessa forte ("viver do futebol") fica **dentro** do bloco "Quem é o Mycroft" como aspiração de cliente real (depoimento Paulo), não como headline — reduz exposição legal mantendo gancho.

## 3. Mockups visuais (prova social)

Gerar 3 imagens via `imagegen--generate_image` (modelo `premium` pela legibilidade de números):
- `public/lp/prints/mock-punter-aprovado.jpg` — card escuro Mycroft com "✅ APROVADO • Asset Score 87 • Over 2.5 @ 1.92 • Edge +6.4% • Stake 3%"
- `public/lp/prints/mock-trader-live.jpg` — card live com "⚡ LABAREDA → APROVADO • Over 1.5 HT • 38' • xG 1.42 • Conf 78%"
- `public/lp/prints/mock-banca-paulo.jpg` — gráfico linha ascendente R$ 2.000 → R$ 7.000 + selos "Paulo S. — sócio 5% • banca real Betfair"

Todos coerentes com o tema dark gold da `lp.css`.

## 4. WhatsApp como CTA primário

Botão verde (`#25D366`) em **5 pontos**: topbar, hero, abaixo de cada plano, CTA final, sticky mobile. Mensagem pré-preenchida muda por seção:
- Hero: "Olá! Quero entender como o Mycroft funciona antes de assinar."
- Planos: "Olá! Tenho interesse no Plano {Iniciante|Profissional|Elite}, pode me explicar?"
- CTA final: "Olá! Vim do site, quero testar o Mycroft."

Número: **+55 34 99129-0648** (já em uso no FloatingWhatsApp).

## 5. Detalhes técnicos

**Arquivos tocados:**
- `public/lp/ia-apostas-esportivas.html` — reescrita completa (mantém `<link rel="stylesheet" href="/lp/lp.css">`).
- `public/lp/lp.css` — adicionar classes: `.cta-whatsapp` (verde), `.proof-grid`, `.proof-card`, `.plans-grid`, `.plan-card`, `.daypass-strip`, `.risk-note`. Sem quebrar estilos existentes.
- `public/lp/prints/` — 3 mockups gerados.

**NÃO tocar nesta entrega:**
- `Paywall.tsx`, `OfertaEspecial.tsx`, `kiwify-webhook`, banco — os planos da LP **linkam para as URLs Kiwify atuais** (Starter→Iniciante R$49,90 já existe a R$99,90; aqui a LP exibe R$49,90 como preço promocional de aquisição. **Atenção:** isso cria divergência entre LP e Paywall — ver seção 6).
- Auth, /lobby, /menu — escopo separado.

## 6. ⚠️ Pontos que precisam da sua confirmação durante a build

1. **Divergência de preço LP × Paywall/Kiwify:** hoje Starter custa R$ 99,90 no Paywall. A LP vai anunciar **R$ 49,90 (Iniciante)**, **R$ 149,90 (Profissional)**, **R$ 249,90 (Elite)**. Opções: (a) deixo a LP só com link WhatsApp nos planos para você fechar manualmente o valor promocional, ou (b) crio links Kiwify novos depois (entrega separada). **Default que vou seguir:** botão "Assinar" desabilitado/oculto, só WhatsApp ativo nos planos — força captura. Só day-pass tem checkout direto.
2. **Day Pass R$ 9,90:** não existe ainda no Kiwify. Na LP vou colocar como "Em breve via WhatsApp — peça seu cupom 24h" (não inventa produto fantasma). Quando você criar no Kiwify eu troco o link.

## 7. Fora de escopo (entregas futuras separadas)

- Criar produto Day Pass R$ 9,90 no Kiwify + edge function de ativação 24h.
- Reescrever `Paywall.tsx` com os 3 novos nomes.
- Segunda LP com VSL embutida (`/lp/oraculo-vsl`) — quando você gravar o vídeo.
- Edge function de auto-upgrade pós-green do day pass.

---

**Resultado:** LP que vende com prova visual + canal humano (WhatsApp), preserva SEO da URL atual, sem mexer em produto/billing.
