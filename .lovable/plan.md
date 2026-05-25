# Plano v2: Hórus Mentor — Voz cirúrgica + 4 modos (refinado)

Ajustes do feedback: **frases mais curtas e fluidas**, vocabulário trocado (sem "sinais"), e **remoção total de GREEN/RED por voz** (mantém só visual — evita estética de cassino).

## 1. Modos de operação (controle do usuário)

Coluna `horus_mode` em `user_preferences`, 4 valores:

| Modo | O que fala | Para quem |
|---|---|---|
| `silent` | Nada | Avançado / quer silêncio |
| `critical_only` | Só alertas críticos (cash-out, Betfair off, oportunidade aprovada) | Experiente |
| `mentor` *(padrão)* | Primeiro acesso + eventos importantes + dicas operacionais | Maioria |
| `narrator` | Mentor + narração de mudanças de contexto | Iniciante |

**`narrator` NÃO inclui mais GREEN/RED por voz.** Resultado é só visual + som curto não-falado.

UI: seletor no `PunterConfig.tsx` com 4 cards explicando cada modo + botão flutuante 🔇 global para mute de sessão.

## 2. Catálogo de frases (tabela `horus_triggers`) — versão curta e fluida

Regra de ouro: **máximo 2 sentenças, ~12 palavras por sentença**. Sem números técnicos no áudio (ficam no visual).

### Onboarding primeiro acesso (mode >= mentor)
- `/ciclos` → *"Esta é sua banca de ciclos. Separada da banca principal. Cada ciclo possui regra operacional própria."*
- `/punter/meu-plano` → *"Aqui você cria seu plano determinístico. O Mycroft global continua rodando em paralelo."*
- `/arena-trader-sports/meu-plano` → *"Seu plano filtra apenas o que importa para você. Mycroft segue ativo no fundo."*
- `/punter` (primeira vez) → *"Pré-live. Mantenha sua Betfair logada. Oportunidades podem ser aprovadas a qualquer momento."*
- `/punter/configuracoes` → *"Aqui você ajusta meu comportamento. Se preferir silêncio, é só escolher."*
- `/eventos-raros` → *"Mercados raros, alto valor. Sempre com banca isolada."*
- `/loja-bc` → *"Liga Mycroft. ROI percentual decide o ranking. Não é volume."*

### Eventos importantes (mode >= mentor)
- Oportunidade aprovada Punter → *"Nova oportunidade aprovada na Arena Punter."*
- Oportunidade aprovada Trader → *"Nova oportunidade aprovada na Arena Trader."*
- Cash-out CRITICAL → *"O mercado mudou. Avalie sair da posição agora."* *(também em `critical_only`)*
- Betfair desconectada → *"Sua conta Betfair está desconectada."* *(também em `critical_only`)*
- Hórus Pilota pausado (2 REDs) → *"Operação pausada. Dois reveses consecutivos no método."*
- Trial expirando em 2 dias → *"Seu acesso expira em dois dias."*

### Dicas operacionais (mode >= mentor, máx 1 por sessão)
- Punter sem Betfair → *"Conecte sua Betfair. Entradas aprovadas exigem execução rápida."*
- Filtro avançado ativado → *"Filtro avançado ativado."*

### REMOVIDO da v1
- ~~GREEN registrado~~ → só visual + som curto neutro (mantém `bcRewardsService` toast)
- ~~RED registrado~~ → só visual
- Qualquer áudio celebratório/dopaminérgico

### Vocabulário banido no áudio
- "sinais" → usar **"oportunidades"**, **"operações"**, **"entradas aprovadas"**
- "GREEN/RED" → não falar
- Números técnicos longos ("10%", "20K", "Tier 1") → só visual

## 3. Anti-irritação — regras invioláveis

- Máx **1 trigger por categoria por sessão** (`sessionStorage`)
- Primeiro acesso a uma página: gravar em `user_horus_seen` — nunca repete
- **Nunca dispara** se: áudio CRITICAL na fila / aba inativa / modo = `silent`
- iOS sem gesto prévio: cai para banner visual (`HorusAudioFallback` já existe)
- Botão 🔇 global: muta sessão inteira sem mudar o modo persistido

## 4. Implementação técnica

```text
src/
  services/
    horusMentor.ts            (novo) — orquestrador: modo + gatilho + dedupe + enqueue
  hooks/
    useHorusTrigger.ts        (novo) — useHorusTrigger('ciclos_first_visit')
    useHorusMode.ts           (novo) — lê/escreve user_preferences.horus_mode
  components/punter/
    HorusModeSelector.tsx     (novo) — 4 cards no PunterConfig
    HorusMuteFloatingButton.tsx (novo) — botão 🔇 global
  data/
    horusTriggers.ts          (novo) — fallback estático se DB falhar
```

Reusa tudo existente:
- `centralAudioQueue` (prioridade `HORUS_DIALOGUE`)
- `elevenlabs-tts` edge (cache via `cacheKey`)
- `horus_audio_inventory` (cache permanente)
- `HorusAudioFallback` (banner iOS)

## 5. Banco de dados (migration)

```sql
ALTER TABLE user_preferences 
  ADD COLUMN IF NOT EXISTS horus_mode TEXT NOT NULL DEFAULT 'mentor' 
  CHECK (horus_mode IN ('silent','critical_only','mentor','narrator'));

CREATE TABLE user_horus_seen (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trigger_key)
);
ALTER TABLE user_horus_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own seen" ON user_horus_seen FOR ALL 
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE horus_triggers (
  trigger_key TEXT PRIMARY KEY,
  texto TEXT NOT NULL,
  categoria TEXT NOT NULL,         -- 'onboarding'|'evento'|'dica'|'critico'
  min_mode TEXT NOT NULL DEFAULT 'mentor',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE horus_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all" ON horus_triggers FOR SELECT USING (true);
-- Seed com as ~12 frases curtas da seção 2
```

## 6. Pontos de integração

- `Ciclos.tsx`, `ArenaTraderSportsMeuPlano.tsx`, `PunterMenu.tsx`, `PunterConfig.tsx`, `ArenaTraderSportsEventosRaros.tsx`, `HowToEarnBC.tsx` → `useHorusTrigger('first_visit')` no mount
- `PunterMenu.tsx` (sem Betfair) → `useHorusTrigger('punter_connect_betfair')`
- Onde dispara push APROVADO Punter/Trader → adicionar `horusMentor.speak('opportunity_approved_punter|trader')`
- `ActivePositions.tsx` (já tem `criticalAlertSound`) → adicionar voz no CRITICAL
- Layout root → montar `HorusMuteFloatingButton`
- **NÃO tocar** em `bcRewardsService` / GREEN-RED handlers — ficam só visuais

## 7. Custo ElevenLabs

- ~14 frases fixas × ~80 chars = **~1.100 chars gerados uma vez**, cacheados em `horus_audio_inventory`
- Sem áudio dinâmico (todas as frases são fixas)
- Plano grátis cobre folgado mesmo com 1.000 usuários

## 8. Fora de escopo

- Voz em hover/scroll/tab (proibido)
- Frases dinâmicas com LLM em tempo real (v2 se métricas pedirem)
- Áudio de resultado (GREEN/RED) — explicitamente removido
- Painel admin para editar `horus_triggers` (DB permite edição manual)

## Diferenças vs v1

1. Frases reescritas: curtas, fluidas, ~12 palavras/sentença
2. "sinais" trocado por "oportunidades / operações / entradas aprovadas"
3. GREEN/RED por voz **removidos** (cassino-feel)
4. `narrator` agora só narra contexto, não celebra resultado
5. Catálogo encolheu de ~25 para ~14 frases (menos é mais)

## Resultado esperado

Usuário avançado: silêncio total se quiser.
Usuário novo: ouve **uma frase curta e técnica** no primeiro acesso de cada função avançada. Sem dopamina, sem cassino — fiel ao "Mycroft calcula, não torce".
