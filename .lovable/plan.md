

# Corrigir Bluff Talk (Provocação em Vídeo) no Street Continuation

## Problema Identificado

O modal de "Bluff Talk" (gravação de provocação em vídeo) **existe** no código do Street Continuation, mas aparece apenas em condições muito específicas que podem não estar sendo atingidas durante o jogo:

1. **Condição de timing**: O modal só aparece na **transição entre streets** (depois de acertar uma decisão), nunca durante a decisão em si
2. **Condição de index**: O modal só aparece quando `currentStreetIdx > 0`, ou seja, apenas nas transições Flop-para-Turn e Turn-para-River. A transição Preflop-para-Flop (index 0) e pula
3. **Condição de acerto**: Se o jogador erra, o modal nunca aparece
4. **Condição de fim de mao**: Se a IA decide que a mao terminou (ex: fold), o modal e pulado

Resumindo: se voce errou no Flop, ou se a mao terminou antes do Turn, nunca veria o modal de video.

## Solucao Proposta

Alterar a logica para oferecer o Bluff Talk como opcao **antes de tomar a decisao** em cada street pos-flop, em vez de apenas na transicao. Isso e mais intuitivo — o jogador grava a provocacao, depois toma a decisao.

### Mudancas Tecnicas

**Arquivo: `src/components/arena-poker/StreetContinuationTraining.tsx`**

1. **Adicionar botao "Gravar Provocacao"** na area de decisao (ao lado dos botoes de acao) para streets Flop, Turn e River
   - O botao aparece quando `currentStreetIdx > 0` (pos-flop), `bluffTalkEnabled` esta ON, e o jogador ainda nao decidiu
   - Icone de camera/mic com estilo dourado para chamar atencao

2. **Manter a logica atual** de transicao como opcao secundaria (para quem prefere gravar depois de ver o cenario e antes de avançar)

3. **Corrigir a transicao Preflop-para-Flop**: mudar a condicao de `currentStreetIdx > 0` para `currentStreetIdx >= 0` na transicao, permitindo que o Bluff Talk apareca tambem ao sair do Preflop para o Flop (opcional, pode ser configuravel)

4. **Adicionar indicador visual** de que o Bluff Talk esta disponivel na street atual — um badge sutil "Table Talk disponivel" abaixo do cenario

### Fluxo Corrigido

```text
Cenario aparece (Flop/Turn/River)
    |
    v
Jogador ve opcoes de acao + botao "Gravar Provocacao"
    |
    ├── Clica "Gravar Provocacao" → Abre BluffTalkModal → Volta para decisao
    |
    └── Escolhe acao → Avaliacao → Feedback → Proximo street
```

### Estimativa

- 1 arquivo modificado
- Mudanca de baixo risco — reutiliza o BluffTalkModal existente, apenas muda quando ele aparece
