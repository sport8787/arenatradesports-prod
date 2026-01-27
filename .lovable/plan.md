
# Plano de Implementação: Mycroft 2.0 Análise Facial em Tempo Real

## Visão Geral

O objetivo é completar os 3 elementos visuais faltantes para que a análise facial do Mycroft 2.0 funcione como demonstrado no trailer: overlay de landmarks, timeline PNL e integração no Single Player.

---

## Arquitetura Atual (99% Pronta)

```text
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTADO                                  │
├─────────────────────────────────────────────────────────────────┤
│ faceMeshService.ts      │ Rastreia 478 landmarks via MediaPipe  │
│ videoForensicsService.ts│ Calcula tensão labial, olhar, micro-  │
│                         │ expressões, blink rate                │
│ audioForensicsService.ts│ Pitch, jitter, shimmer, latência     │
│ mycroft2Engine.ts       │ Baseline adaptativo por jogador      │
│ mycroftCombinedReading  │ Combina 60% vocal + 40% facial       │
│ VideoRecorder.tsx       │ Grava vídeo com FaceMesh ativo       │
│ MycroftCombinedPanel.tsx│ Exibe veredito para o júri           │
└─────────────────────────────────────────────────────────────────┘
```

---

## O Que Falta Implementar

### Etapa 1: Overlay Visual de Landmarks (Prioridade Alta)
**Componente:** `FaceLandmarksOverlay.tsx`

Criar um canvas SVG/Canvas2D que desenha os 478 pontos verdes sobre o vídeo do jogador em tempo real, exatamente como no trailer.

**Funcionalidades:**
- Pontos verdes conectados nas regiões: olhos, sobrancelhas, boca, mandíbula
- Linhas de conexão entre landmarks adjacentes
- Indicadores dinâmicos de micro-expressões detectadas
- Animação de "scan" quando uma anomalia é detectada
- Toggle para ativar/desativar overlay

**Integração:**
- Adicionar como camada sobre o `<video>` no `VideoRecorder.tsx`
- Receber landmarks do callback `handleFaceMeshResults`

---

### Etapa 2: Timeline PNL (Prioridade Média)
**Componente:** `PNLTimelinePanel.tsx`

Criar uma linha do tempo visual que mostra os eventos faciais detectados durante a gravação.

**Funcionalidades:**
- Barra horizontal representando a duração da gravação
- Marcadores coloridos para eventos:
  - Verde: Olhar direto
  - Amarelo: Desvio de olhar esquerda (memória visual)
  - Vermelho: Desvio de olhar direita (construção visual)
  - Roxo: Micro-expressões detectadas
  - Laranja: Tensão facial elevada
- Tooltip com detalhes ao passar o mouse
- Legenda explicativa de PNL

**Integração:**
- Renderizar no `MycroftCombinedPanel.tsx` abaixo do veredito
- Usar dados do `VideoForensicsResult.timeline`

---

### Etapa 3: Indicadores em Tempo Real (Prioridade Média)
**Componente:** `LiveBiometricIndicators.tsx`

Exibir métricas em tempo real durante a gravação.

**Funcionalidades:**
- Gauge circular para "Tensão Labial" (0-100%)
- Gauge circular para "Taxa de Piscadas" (bpm)
- Indicador de direção do olhar com seta animada
- Cor dinâmica: Verde (normal), Amarelo (atenção), Vermelho (alerta)

**Integração:**
- Posicionar no canto inferior direito do `VideoRecorder.tsx`
- Atualizar via `analyzeFrame` do `videoForensicsService.ts`

---

### Etapa 4: Integração no Single Player (Prioridade Alta)
**Arquivo:** `SinglePlayerRoom.tsx`

Ativar a análise facial completa no modo single player.

**Modificações:**
- Importar `VideoRecorder` como alternativa ao `AudioRecorder`
- Adicionar seletor de modo de gravação (áudio vs vídeo)
- Exibir `MycroftCombinedPanel` após votação dos bots
- Persistir métricas faciais no `voice_recordings` com session_id

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/game/FaceLandmarksOverlay.tsx` | Canvas SVG com 478 pontos verdes |
| `src/components/game/PNLTimelinePanel.tsx` | Timeline de eventos PNL |
| `src/components/game/LiveBiometricIndicators.tsx` | Gauges de métricas em tempo real |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `VideoRecorder.tsx` | Integrar overlay + indicadores |
| `MycroftCombinedPanel.tsx` | Adicionar timeline PNL |
| `SinglePlayerRoom.tsx` | Adicionar opção de vídeo + exibir painel combinado |

---

## Detalhes Técnicos

### FaceLandmarksOverlay (Especificação)

```text
Props:
  - landmarks: number[][] (478 pontos [x, y, z])
  - width: number
  - height: number
  - showConnections: boolean
  - highlightAnomalies: boolean

Regiões a desenhar:
  - FACE_OVAL (10, 338, 297, ...) - contorno do rosto
  - LEFT_EYE / RIGHT_EYE - olhos
  - LEFT_IRIS / RIGHT_IRIS - íris (tracking do olhar)
  - LIPS - lábios
  - LEFT_BROW / RIGHT_BROW - sobrancelhas
```

### PNLTimelinePanel (Especificação)

```text
Props:
  - timeline: VideoForensicsResult['timeline']
  - durationMs: number
  - pnlAnalysis: PNLAnalysis

Eventos a mapear:
  - 'gaze' → Cores por direção
  - 'expression' → Ícone de expressão
  - 'stress' → Barra de intensidade
```

### Estimativa de Esforço

| Etapa | Complexidade | Linhas de Código |
|-------|--------------|------------------|
| FaceLandmarksOverlay | Média | ~200 |
| PNLTimelinePanel | Baixa | ~150 |
| LiveBiometricIndicators | Baixa | ~120 |
| Integração Single Player | Média | ~100 |
| **Total** | | **~570 linhas** |

---

## Resultado Final

Após implementação, o Mycroft 2.0 terá:

1. **Overlay verde cinematográfico** sobre o rosto do jogador durante gravação
2. **Timeline PNL** mostrando sequência de eventos faciais
3. **Gauges em tempo real** com tensão labial, piscadas e direção do olhar
4. **Análise completa no Single Player** com veredito combinado vocal+facial

O visual será idêntico ao trailer: interface high-tech com pontos biométricos verdes, linhas de conexão e métricas de micro-expressões em tempo real.

---

## Dependências Externas

Nenhuma. Todas as bibliotecas necessárias já estão instaladas:
- `@mediapipe/face_mesh` (FaceMesh)
- `@mediapipe/camera_utils` (Captura de câmera)
- `framer-motion` (Animações)
- `recharts` (Gráficos para timeline)

