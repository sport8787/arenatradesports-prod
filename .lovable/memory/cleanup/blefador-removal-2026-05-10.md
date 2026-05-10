---
name: Remoção Blefador Milionário
description: Em 10/05/2026 removidos ~150 arquivos do Blefador (Arena Poker, Modo Apresentador, Trader Season Jury). Snapshot preservado em remix dedicado.
type: feature
---

# Remoção Blefador (10/05/2026)

## Snapshot
Remix `blefador-milionario-archive-2026-05-10` preserva o código completo. Banco/edges Blefador permanecem vivos no Postgres (limpeza adiada).

## Removido deste repo
- **Páginas**: ArenaPoker, ArenaPokerRankings, SinglePlayerRoom, ArenaTraderSeason, GameRoom, PlayerScreen, PresenterRoom, AdminFounderCases, HowToPlay
- **Componentes**: `src/components/arena-poker/` inteiro, `HorusTerminal`, e a maior parte de `src/components/game/` (mantidos apenas: GoldButton, LuxuryCard, BluffCoinDisplay, AudioPreloadIndicator, GameOpening, BalanceHeader, FakeLobby, PhaseSelector, DailyBonusModal, InsufficientEnergyModal, FounderCaseModal, PresenterRoleSelector, ProgressToPrize, RankCard — usados pelo Mycroft/lobby)
- **Hooks**: usePresenterRoom, useGameState, useQuestionAudioPreloader, useQuestionHistory, useQuestionNarration, useNarrativeEngine, useNarrativeIntegration, useAtomicNarrationTrigger, useMycroftVerdict, useDialogManager, useHorusNarration, useAudioSync, useMLDataPersistence
- **Services**: presenterAudio, audioForensicsTypes, voiceRecording, faceMesh, cognitiveLeaks, cognitiveRupture, juryClaude, horus2Engine, horusPsychology, horusLocalAudio, pressureTimer, silentObserver, mycroftHumanReading, mycroftBlock, elevenLabsSTT, biometricCalibration, mlDataPersistence
- **Contexts/Data/Types/Lib**: NarrativeContext, horusActPhrases, types/game, types/bot, handHistoryParser
- **Edge functions**: `arena-trader-jury`, `claude-jury` (deletadas via delete_edge_functions)

## Mantido (compartilhado com Mycroft)
- centralAudioQueue, audioCacheService, audioPreloader, audioQueueManager, globalAudioContext, audioDebugService, horusCacheService, voiceBaselineService, webSpeechFallbackService, backgroundMusicService, horusPhrasesPool
- useCentralAudioQueue, useAudioPreloader, useAudioQueueStatus, useFounderCase, usePromoSlots
- HorusTTSPlayer, useHorusPunterAudio, horusPunterVoiceService
- types/personas.ts, lib/gameUtils.ts, data/trainingScenarios.ts, MycroftMemory.tsx (usados em Mycroft)

## Arena Trader Jury — confirmado não-Mycroft
Mecânica de quiz Blefador (3 jurados CLARO/BLEFE votando em transcrição de áudio do jogador). NÃO confundir com a aprovação/veto de sinais reais do Mycroft Trader Sports, que vive em borderline-ai-validator + mycroft-rules-engine + analyze-live-matches.

## Pendência
Tabelas órfãs no Postgres (presenter_rooms, poker_rankings, etc.) documentadas em MIGRATION_INVENTORY.md para limpeza futura.
