
# Ajustes finais na LP `/lp/day-pass.html`

Plano aprovado pelo usuário, agora com dados confirmados de YouTube + lives.

## Dados confirmados
- **Canal:** https://www.youtube.com/@OraculoMycroft
- **Lives:** Quarta-feira 21h30 e Sábado 19h (2x/semana)
- **Decisão de embed:** usar **card com link** para o canal (mais leve, não polui LP, evita CLS do iframe do YouTube e mantém score de PageSpeed). O vídeo específico (`Hlp9rr0cueY`) pode entrar como thumbnail clicável dentro do card.

## Mudanças a aplicar (em ordem)

### 1. Hero — substituir pílula redundante (linhas 213–217)
Trocar `<span><b>1.200+</b> usuários ativos</span>` por:
`<span>📺 <b>2× por semana</b> ao vivo no YouTube</span>`

### 2. Stats — neutralizar valor monetário isolado (linha 278)
Trocar `R$ 7k · Desempenho passado documentado` por:
`+4 anos · Histórico documentado de operações`

### 3. Caption Betfair — remover "em 1 dia" (linha 308)
`R$ 347,94 de resultado líquido em 1 dia · 5 mercados resolvidos` →
`R$ 347,94 — exemplo de operação documentada na Betfair (5 mercados resolvidos no extrato oficial)`

### 4. Caption GREENs — neutralizar jargão (linha 303)
`5 GREENs consecutivos na Copa Libertadores — Over/Under 2.5 liquidados em sequência` →
`5 mercados Over/Under 2.5 resolvidos com acerto na Copa Libertadores (exemplo documentado, 20–21/05)`

### 5. NOVO BLOCO — "Transparência ao vivo" (inserir após linha 330, antes de "Método Mycroft")

```html
<!-- LIVE TRANSPARENCY -->
<section class="block" style="background:rgba(239,68,68,.04)">
  <div class="container">
    <div class="eyebrow">📺 Transparência ao vivo</div>
    <h2>Toda semana, ao vivo. <span class="hl">Sem corte, sem edição.</span></h2>
    <p class="lead">
      2 lives por semana no YouTube mostrando o Mycroft em operação real —
      entradas, raciocínio matemático, acertos e erros. Você vê antes de assinar.
    </p>

    <div class="live-card">
      <div class="live-thumb">
        <a href="https://www.youtube.com/watch?v=Hlp9rr0cueY"
           target="_blank" rel="noopener" aria-label="Assistir live no canal Oráculo Mycroft">
          <img src="https://img.youtube.com/vi/Hlp9rr0cueY/maxresdefault.jpg"
               alt="Live do canal Oráculo Mycroft no YouTube" loading="lazy" />
          <span class="play">▶</span>
        </a>
      </div>
      <div class="live-info">
        <span class="live-badge">CANAL OFICIAL</span>
        <h3>@OraculoMycroft</h3>
        <ul class="live-schedule">
          <li>🔴 <b>Quarta-feira</b> · 21h30</li>
          <li>🔴 <b>Sábado</b> · 19h00</li>
        </ul>
        <a href="https://www.youtube.com/@OraculoMycroft?sub_confirmation=1"
           target="_blank" rel="noopener" class="cta cta-secondary">
          Inscrever-se no canal →
        </a>
      </div>
    </div>
  </div>
</section>
```

Mais o CSS correspondente (dentro do `<style>` existente) para `.live-card`, `.live-thumb`, `.live-info`, `.live-badge`, `.live-schedule`, `.cta-secondary` — grid responsivo (2 colunas desktop, 1 coluna mobile), thumb com play overlay vermelho, badge vermelha "CANAL OFICIAL".

### 6. Card de preço — mencionar grupo WhatsApp como bônus (linhas 219–231 e 403–414)
Acrescentar uma linha logo abaixo de `.price-sub`:
```html
<div class="price-bonus">
  ✅ <b>Bônus:</b> acesso ao grupo dos fundadores no WhatsApp —
  onde o método é operado e discutido em tempo real.
</div>
```
(Aplicar nos dois cards de preço — hero e final.)

### 7. Footer — remover link com slug "apostas" (linha 430)
Trocar `<a href="/lp/ia-apostas-esportivas.html">Plataforma completa</a>` por:
`<a href="/">Plataforma completa</a>`
(O arquivo legado continua existindo; só removemos a referência interna da LP. Não renomeia o arquivo agora para evitar mexer em redirects/SEO em escopo separado.)

## Itens fora deste escopo (não vou tocar)
- Forçar redirect pós-pagamento para tela "entre no grupo" em `LobbyPreview.tsx` — é mudança de fluxo, fica para um próximo turno se o usuário pedir.
- Renomear `ia-apostas-esportivas.html` — exige redirect em `vercel.json`, pode ser pedido separado.

## Verificação ao final
- `rg -n "GREENs consecutivos|em 1 dia|R\\$ 7k" public/lp/day-pass.html` deve retornar zero.
- Conferir visualmente o novo bloco no preview (mobile 743px e desktop).
- Conferir que o card WhatsApp aparece nos dois cards de preço.

Pronto para entrar em build mode e aplicar.
