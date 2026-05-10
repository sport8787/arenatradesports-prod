## Objetivo
Separar definitivamente o Oráculo Mycroft (Punter/Trader Sports) do Blefador Milionário (Quiz/Poker/Apresentador), preservando 100% do código atual num remix engavetado e deixando este repo enxuto.

## Fase 0 — Backup (você faz manualmente, antes de eu mexer)
1. No menu de três pontos (⋯) do projeto no dashboard → **Remix**.
2. Renomeie o remix para algo como `blefador-milionario-archive-2026-05-10`.
3. Confirme que o remix abre, dá build e mostra a lista de arquivos.
4. Quando confirmar, eu executo as Fases 1–3 abaixo.

> O remix preserva todo o código + esquema + edges. Banco/secrets/storage **não** são copiados, mas o código fica congelado para reuso futuro.

## Fase 1 — Remoção de frontend (eu executo)

### 1.1 Páginas e rotas Blefador
Remover do `src/App.tsx` (rotas) e deletar arquivos:
- `src/pages/ArenaPoker.tsx`
- `src/pages/ArenaPokerRankings.tsx`
- `src/pages/SinglePlayerRoom.tsx` (se existir e for Blefador)
- Qualquer rota `/poker`, `/presenter`, `/blefador`

### 1.2 Componentes Blefador
- Pasta inteira: `src/components/arena-poker/` (HorusTrashTalk, PersonaIcons usados só lá, etc.)
- `src/components/HorusTerminal.tsx` (widget convai, só usado no SinglePlayerRoom)

### 1.3 Hooks Blefador
- `usePresenterRoom`
- `useGameState` (se for do quiz)
- `useQuestionAudioPreloader`, `useQuestionHistory`, `useQuestionNarration`
- `useNarrativeEngine`, `useNarrativeIntegration`, `useAtomicNarrationTrigger`
- `useMycroftVerdict`, `useFounderCase`, `useDialogManager`
- `useHorusNarration`, `useAudioSync`
- `usePromoSlots` (revisar — pode ser do Mycroft)

> Antes de deletar cada um eu rodo `rg` para confirmar que não é importado por nada do Punter/Trader. Se for, eu paro e pergunto.

### 1.4 Services Blefador
- `presenterAudioService`, `audioForensicsTypes`, `voiceBaselineService`, `voiceRecordingService`
- `faceMeshService`, `cognitiveLeaksService`, `cognitiveRuptureService`
- `juryClaudeService`
- `horus2Engine`, `horusPhrasesPool`, `horusPsychologyService`, `horusLocalAudio`
- `pressureTimerService`, `silentObserverService`
- `mycroftHumanReadingService`, `mycroftBlockService`
- `elevenLabsSTTService`, `webSpeechFallbackService`
- `audioCacheService`, `audioDebugService`, `audioPreloader`, `audioQueueManager`, `backgroundMusicService`, `centralAudioQueue`, `globalAudioContext` (revisar — alguns alimentam o Hórus do Punter)

### 1.5 Pages do AdminFounderCases e Hub Quiz
- `src/pages/AdminFounderCases.tsx`
- `src/pages/HowToPlay.tsx` (se for tutorial Blefador)
- `src/pages/MycroftMemory.tsx` (revisar — pode ser config Mycroft)

### 1.6 Outros
- `src/data/horusActPhrases.ts`, `src/data/trainingScenarios.ts`
- `src/types/personas.ts`, `src/types/game.ts`, `src/types/bot.ts` (revisar)
- `src/lib/handHistoryParser.ts`, `src/lib/gameUtils.ts`
- `src/__tests__/` referentes a quiz

### 1.7 Edge Functions Blefador
Remover via `delete_edge_functions`:
- `arena-trader-jury` (3 IAs CLARO/BLEFE — só quiz)
- `mycroft-ai` se for usado só pelo presenter (verificar primeiro)

> Se outra função do Punter/Trader chamar uma dessas, eu paro.

## Fase 2 — Validação
- Rodar build (`tsc --noEmit` automático do Lovable)
- Conferir que `/`, `/punter`, `/trader/*`, `/lobby`, `/admin/*` carregam
- Conferir console sem erros de import

## Fase 3 — Banco (NÃO agora — você pediu "depois")
Documentar em `MIGRATION_INVENTORY.md` (já existe) a lista de tabelas/edges/storage Blefador que ficaram **órfãs** vivas no Postgres, para limpeza futura quando você quiser. Provavelmente:
- `presenter_rooms`, `presenter_players`, `presenter_audio_*`
- `poker_rankings`, `poker_*`
- `horus_punter_audio_plays` (manter — é Mycroft)
- Storage bucket `game-audio` (manter — é Mycroft, usado em outros lugares)

## O que NÃO vou tocar (já confirmado como Mycroft)
- `useHorusPunterAudio`, `horusPunterVoiceService`, `HorusTTSPlayer`
- `useCentralAudioQueue`, `horus_audio_inventory`, edge `elevenlabs-tts`
- `useApprovedSignalSound`, `criticalAlertSound`, `useAudioQueue*` (alertas Punter/Trader)
- Todo o Punter, Trader Sports, Trader (cripto), BC Rewards, Liga Mycroft, SEO, Admin

## Riscos
- **Médio**: alguns services de áudio (`audioPreloader`, `centralAudioQueue`, `globalAudioContext`) são usados por **ambos**. Se eu deletar errado, alerta sonoro do Punter quebra. Mitigação: rodar `rg` em cada um antes, manter se houver qualquer import vivo do Punter/Trader.
- **Baixo**: rotas órfãs no `App.tsx` — se eu esquecer alguma, vira tela branca em URL antiga (não usada).
- **Zero**: banco intacto, secrets intactos, edges Punter/Trader intactos.

## Pós-execução
- Rodar `getJurorVote` e edges removidas via `delete_edge_functions` no Supabase
- Atualizar `mem://index.md` com nota: "Blefador removido em 10/05/2026, snapshot em remix `blefador-milionario-archive-2026-05-10`"
- Reportar lista exata de arquivos deletados, linhas removidas e edges deployadas

## Estimativa
- Tempo de execução: ~5 min
- Arquivos removidos: ~40–60
- Bundle/build: estimo -15–25% mais rápido
