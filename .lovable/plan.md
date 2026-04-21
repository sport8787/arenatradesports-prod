

## Remover LeadCaptureForm e canalizar tudo para signup

A landing já está convertendo 15% dos visitantes em conta direto (excelente). O `LeadCaptureForm` virou redundante — inclusive já está **órfão no código** (não é importado em nenhum lugar). Só precisa de limpeza + garantir que o e-book continue acessível.

### O que vai mudar

**1. Limpeza de código (form de WhatsApp)**
- Deletar `src/components/landing/LeadCaptureForm.tsx` (componente órfão).
- Dropar a tabela `landing_leads` do banco (vazia, sem perda de dados) via migration.

**2. CTA reforçado na landing (substituição visual)**
- Como o componente não está visível, o "substituir por CTA direto pro signup" se traduz em **fortalecer o CTA principal** que já leva ao `/auth`.
- Adicionar um bloco de destaque no Hero (e logo após o VSL) com:
  - Título: "Comece grátis agora — 7 dias de acesso completo"
  - Subtítulo: "Sem cartão. Sem WhatsApp. Crie sua conta em 30 segundos."
  - Botão grande amarelo: "CRIAR CONTA GRÁTIS →" (dispara `track.ctaClicked('hero_signup', 'criar_conta_gratis')` e vai pra `/auth`).
  - Microcopy abaixo: "🎁 E-book 'Apostas de Valor' liberado dentro do app"

**3. E-book "Apostas de Valor" — manter acessível pós-signup**
- Manter o PDF no bucket `public-assets/ebooks/apostas-de-valor.pdf` (já está lá).
- Adicionar card de boas-vindas no dashboard `/punter` (canto superior, dismissível) na primeira visita do usuário:
  - "🎁 Bônus de boas-vindas: baixe o e-book Apostas de Valor"
  - Botão de download direto + opção "Não mostrar novamente" (persiste em localStorage `ebook_dismissed`).

**4. Tracking PostHog (manter atribuição UTM funcionando)**
- O novo CTA do Hero usa `track.ctaClicked` (já existe em `analytics.ts`) — UTMs continuam sendo anexados via `getAttributionProps()`.
- Sem novos eventos necessários; o funil `landing_viewed → cta_clicked → user_signed_up` já está instrumentado.

### Detalhes técnicos

- **Arquivos a deletar**: `src/components/landing/LeadCaptureForm.tsx`
- **Arquivos a editar**:
  - `src/pages/LandingPage.tsx` — adicionar bloco CTA reforçado pós-Hero/pós-VSL.
  - `src/pages/Punter.tsx` — adicionar `<EbookWelcomeCard />` no topo (dismissível).
- **Arquivos a criar**:
  - `src/components/punter/EbookWelcomeCard.tsx` — card amarelo com download do e-book + dismiss.
- **Migration SQL**: `DROP TABLE IF EXISTS public.landing_leads;` (tabela vazia, sem RLS dependencies).
- **Sem mudanças** em: edge functions, autenticação, fluxo de signup, analytics core.

### O que NÃO vai mudar

- `/auth` continua igual.
- Captura de UTMs (`captureUTMs()`) e super-properties do PostHog continuam ativas.
- Floating WhatsApp de suporte (`FloatingWhatsApp.tsx`) permanece — é botão de **suporte**, não de captura.
- E-book continua acessível via URL pública direta para quem já tem o link.

### Resultado esperado

- Funil mais limpo: visitor → CTA → signup (sem fricção intermediária de WhatsApp).
- E-book vira **bônus de retenção pós-signup**, não isca de pré-signup.
- Banco de dados sem tabela morta.

