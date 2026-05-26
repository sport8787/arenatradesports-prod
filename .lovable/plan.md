## Objetivo

Higienizar todo o conteúdo público do domínio `oraculo-mycroft.com` (Home + páginas estáticas + blog) para alinhar com a estética e linguagem fria/SaaS da `/lp/day-pass.html`, eliminando termos que disparam veto do Google Ads e TikTok Ads no escopo "jogos de azar / promessa de lucro".

## Findings da auditoria

Termos/elementos de alto risco encontrados nas rotas/HTMLs públicos:

| # | Local | Trecho ofensor | Por que é risco |
|---|---|---|---|
| 1 | `src/pages/LandingPage.tsx` (Home `/`) | "ROI +73% verificável", "ROI +71%", "ROI +25,6%", "1.658 posições auditadas" | Promessa numérica de retorno |
| 2 | `src/pages/LandingPage.tsx` (FAQ + tabela comparativa) | "Garantia Dobro", "devolvemos em dobro sua assinatura" | Garantia financeira com multiplicador = bloqueio quase certo |
| 3 | `src/pages/LandingPage.tsx` | "Único jogo de cassino com vantagem do jogador" (Blackjack) | Palavra-chave "cassino" |
| 4 | `src/pages/LandingPage.tsx` + `OfertaEspecial.tsx` + `/lp/ia-apostas-esportivas.html` | "Método Hórus de Alavancagem — pilota a banca" | "Alavancagem" + "pilota a banca" = promessa de retorno |
| 5 | `src/pages/OfertaEspecial.tsx` | "Não é tigrinho. Não é roleta." | Mesmo negando, crawler indexa as keywords |
| 6 | `src/pages/LandingPage.tsx` | `PromoSlotsCounter` ("restam X vagas") | Falsa escassez = red flag |
| 7 | `/lp/ia-apostas-esportivas.html` | "estratégias infalíveis", "lucro consistente acontece", "lucro garantido da casa" | Vocabulário sensível mesmo no contexto educativo |
| 8 | `public/blog/edge-gain-apostas-esportivas.html` + `previsao-jogos-futebol-ia.html` + `ferramenta-analise-apostas-esportivas-ia.html` + `blog/index.html` | Posts antigos com copy de venda | Crawler escaneia via sitemap |
| 9 | `public/landing.html` | Página legada redundante | Confunde crawler — remover ou desindexar |

## Escopo da higienização (Opção A)

### 1. Home `/` — refazer `src/pages/LandingPage.tsx` com linguagem fria

Mantém estrutura (Hero, VSL, What is, Why Different, Bonus, Pricing, FAQ, Footer) mas troca **toda copy** seguindo o padrão da `/lp/day-pass.html`:

- **Remover** todas as menções a "ROI +73%", "+71%", números absolutos de retorno. Substituir por linguagem de processo: "Edge calculado em cada operação", "ROI rastreável publicamente no painel de auditoria", sem afirmar percentual.
- **Remover Garantia Dobro** por completo (FAQ + tabela comparativa). Substituir por "Reembolso integral em 7 dias se a plataforma não atender o esperado" (padrão SaaS, sem multiplicador).
- **Remover `PromoSlotsCounter`** (falsa escassez).
- **Trocar "Método Hórus de Alavancagem — pilota a banca"** por "Método dos Ciclos — gestão de banca em estágios definidos" (descritivo, sem promessa).
- **Remover "Único jogo de cassino com vantagem do jogador"** (Blackjack como bônus). Reposicionar como "Módulo Blackjack educacional — estratégia básica + contagem de cartas" (sem "cassino").
- **Remover comparativos agressivos** ("Confie em mim bro", "bullshit total") — tom técnico.
- **Tabela comparativa**: manter critérios, trocar números por descritivos ("Histórico auditável", "Sem garantia financeira de resultado").
- **FAQ**: reescrever 100% das perguntas no tom da day-pass.
- **CTA principal**: passa a apontar para `/lp/day-pass.html` (oferta de teste) em vez do `/oferta-especial`.

### 2. `src/pages/OfertaEspecial.tsx` — limpar copy

- Tirar bloco "Não é tigrinho. Não é roleta." inteiro.
- Tirar palavra "cassino" do card Blackjack — reescrever como "Módulo educacional de Blackjack".
- Tirar "alavanca a banca", trocar por "gestão em ciclos".
- Substituir "Betfair Exchange" por "Exchange" no bullet do Elite (alinhar com day-pass).

### 3. `public/lp/ia-apostas-esportivas.html` — limpar ou redirecionar

Opções:
- **Preferida**: Reescrever copy retirando "estratégias infalíveis", "lucro consistente", "alavancagem", "cassino", "tigrinho".
- **Alternativa rápida**: adicionar `<meta name="robots" content="noindex,nofollow">` + remover do sitemap, manter URL viva mas invisível.

### 4. Páginas legadas — desindexar

`public/landing.html`, `public/blog/edge-gain-apostas-esportivas.html`, `public/blog/ferramenta-analise-apostas-esportivas-ia.html`, `public/blog/previsao-jogos-futebol-ia.html`, `public/blog/index.html`:

- Adicionar `<meta name="robots" content="noindex,nofollow">` no `<head>` de cada uma.
- Remover do `public/sitemap.xml` (manter apenas day-pass + rodadas Brasileirão dinâmicas + Home limpa).
- `public/robots.txt`: liberar só `/`, `/lp/day-pass.html`, `/blog/brasileirao-2026/*`. Bloquear o resto explicitamente.

### 5. Footer global

Garantir que o footer da Home não exponha links para `/oferta-especial`, `/paywall`, `/landing.html` ou blog antigo. Apenas: WhatsApp suporte, Termos, Privacidade, Day Pass.

## Detalhes técnicos

- **Arquivos editados**:
  - `src/pages/LandingPage.tsx` (reescrita parcial — copy/sections)
  - `src/pages/OfertaEspecial.tsx` (limpeza pontual)
  - `public/lp/ia-apostas-esportivas.html` (decisão: limpar ou noindex)
  - `public/landing.html`, `public/blog/*.html` (adicionar noindex)
  - `public/sitemap.xml`
  - `public/robots.txt`
- **Componentes possivelmente afetados** (somente uso, não estrutura): `BonusInclusos.tsx`, `WhatIsOracleSection.tsx`, `WhyDifferentSection.tsx`, `BeforeAfterSection.tsx` — vou ler antes de editar e ajustar copy onde houver termo sensível.
- **A/B test do H1** (`landingAbTest.ts`): vou auditar as variantes e remover qualquer uma que contenha "lucro", "ROI %", "ganho".
- **Sem mexer em**: rotas autenticadas (`/punter`, `/arena-trader-sports`, etc.) — crawler do Google Ads não chega lá, ficam protegidas por `RequireSubscription`.
- **Tracking**: manter `fireAdsConversion`, PostHog, Meta Pixel intactos.

## Validação pós-implementação

Antes de soltar tráfego:
1. `curl -s https://oraculo-mycroft.com/ | grep -iE "garantia dobro|cassino|tigrinho|ROI \+|alavancagem"` deve retornar vazio.
2. Conferir `view-source:` de cada página pública.
3. Rodar uma simulação manual no Google Ads Policy Manager (você submete um anúncio de teste apontando para `/` e vê o veredito).

## Fora de escopo

- Renomear arquivos de imagem `proof-betfair-*.jpeg` (são paths, não aparecem no DOM como texto — opcional, deixo para depois).
- Mexer em copy de páginas internas autenticadas.
- Migração para o destino (continua planejada à parte).
