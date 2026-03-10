import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MatchData {
  home: string;
  away: string;
  scoreHome: number;
  scoreAway: number;
  minute: number;
  period: string;
  championship: string;
  match_id?: string;
  stats?: {
    attacks_home?: number;
    attacks_away?: number;
    dangerous_attacks_home?: number;
    dangerous_attacks_away?: number;
    xG_home?: number;
    xG_away?: number;
    possession_home?: number;
    possession_away?: number;
    shots_home?: number;
    shots_away?: number;
    shots_total_home?: number;
    shots_total_away?: number;
    shots_on_target_home?: number;
    shots_on_target_away?: number;
  };
  bankroll?: number;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function statsAreEmpty(stats: MatchData['stats']): boolean {
  if (!stats) return true;
  const vals = [
    stats.attacks_home, stats.attacks_away,
    stats.dangerous_attacks_home, stats.dangerous_attacks_away,
    stats.possession_home, stats.possession_away,
    stats.shots_home, stats.shots_away,
    stats.shots_total_home, stats.shots_total_away,
  ];
  return vals.every(v => !v || v === 0);
}

function parsePct(val: string | null): number {
  if (!val) return 0;
  return parseInt(val.replace('%', ''), 10) || 0;
}

function findStat(stats: any[], type: string): string | null {
  const stat = stats.find((s: any) => s.type === type);
  return stat?.value ?? null;
}

async function fetchStatsFromApiFootball(fixtureId: string): Promise<MatchData['stats'] | null> {
  const apiKey = Deno.env.get('API_FOOTBALL_KEY');
  if (!apiKey) {
    console.warn('[MycroftSports] API_FOOTBALL_KEY not configured, skipping live stats fetch');
    return null;
  }

  try {
    console.log(`[MycroftSports] Fetching live stats from API-Football for fixture ${fixtureId}`);
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
      { headers: { 'x-apisports-key': apiKey } }
    );

    if (!res.ok) {
      console.error(`[MycroftSports] API-Football error ${res.status}`);
      return null;
    }

    const data = await res.json();
    const teams = data.response;
    if (!teams || teams.length < 2) {
      console.warn('[MycroftSports] API-Football returned no team stats');
      return null;
    }

    const homeStats = teams[0].statistics || [];
    const awayStats = teams[1].statistics || [];

    const parsePct = (val: string | null): number => {
      if (!val) return 0;
      return parseInt(val.replace('%', ''), 10) || 0;
    };

    const shotsInsideHome = parseInt(findStat(homeStats, 'Shots insidebox') || '0', 10);
    const shotsInsideAway = parseInt(findStat(awayStats, 'Shots insidebox') || '0', 10);
    
    const result = {
      attacks_home: shotsInsideHome + parseInt(findStat(homeStats, 'Shots outsidebox') || '0', 10),
      attacks_away: shotsInsideAway + parseInt(findStat(awayStats, 'Shots outsidebox') || '0', 10),
      dangerous_attacks_home: shotsInsideHome,
      dangerous_attacks_away: shotsInsideAway,
      possession_home: parsePct(findStat(homeStats, 'Ball Possession')),
      possession_away: parsePct(findStat(awayStats, 'Ball Possession')),
      shots_home: parseInt(findStat(homeStats, 'Shots on Goal') || '0', 10),
      shots_away: parseInt(findStat(awayStats, 'Shots on Goal') || '0', 10),
      shots_total_home: parseInt(findStat(homeStats, 'Total Shots') || '0', 10),
      shots_total_away: parseInt(findStat(awayStats, 'Total Shots') || '0', 10),
      shots_on_target_home: parseInt(findStat(homeStats, 'Shots on Goal') || '0', 10),
      shots_on_target_away: parseInt(findStat(awayStats, 'Shots on Goal') || '0', 10),
      xG_home: parseFloat(findStat(homeStats, 'expected_goals') || '0'),
      xG_away: parseFloat(findStat(awayStats, 'expected_goals') || '0'),
    };

    console.log(`[MycroftSports] API-Football stats fetched:`, JSON.stringify(result));
    return result;
  } catch (e) {
    console.error('[MycroftSports] API-Football fetch error:', e);
    return null;
  }
}

// Load persistent memory rules for analysis context
async function loadMemoryRules(): Promise<string> {
  const supabase = getSupabaseAdmin();
  try {
    const { data } = await supabase
      .from("mycroft_memory")
      .select("rule_text, category, priority")
      .eq("is_active", true)
      .or("context.cs.{sports},context.cs.{analyst}")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    if (!data || data.length === 0) return "";
    const lines = data.map((m: any, i: number) => `${i + 1}. [${m.category}|P${m.priority}] ${m.rule_text}`);
    return `\n═══════════════════════════════════════\nMEMÓRIA PERSISTENTE (${data.length} regras ativas)\n═══════════════════════════════════════\nEstas regras foram definidas pelo usuário e DEVEM ser respeitadas na análise:\n${lines.join("\n")}\n═══════════════════════════════════════\n`;
  } catch (e) {
    console.error("Memory loading error:", e);
    return "";
  }
}

// Load KB files AND check for custom prompt override (prompt_mycroft.txt)
async function loadKnowledgeBaseAndPrompt(): Promise<{ kb: string; customPrompt: string | null }> {
  const supabase = getSupabaseAdmin();
  const contents: string[] = [];
  let customPrompt: string | null = null;

  try {
    const { data: files } = await supabase.storage.from("sports-knowledge-base").list("", { limit: 50 });
    if (files) {
      for (const file of files) {
        if (!file.name || file.name.length === 0) continue;
        try {
          const ext = file.name.split(".").pop()?.toLowerCase();
          if (!["txt", "md", "csv"].includes(ext || "")) continue;

          const { data: fileData } = await supabase.storage.from("sports-knowledge-base").download(file.name);
          if (!fileData) continue;
          const text = await fileData.text();

          // Check if this is a custom prompt file
          if (file.name.toLowerCase() === 'prompt_mycroft.txt' || file.name.toLowerCase() === 'prompt_mycroft.md') {
            customPrompt = text;
            console.log(`🔄 Custom prompt loaded from KB: ${file.name} (${text.length} chars)`);
            continue; // Don't add prompt file to KB content
          }

          contents.push(`\n━━━ ${file.name} ━━━\n${text.substring(0, 80000)}`);
        } catch (e) {
          console.error(`Error reading ${file.name}:`, e);
        }
      }
    }
  } catch (e) {
    console.error("Sports KB loading error:", e);
  }
  console.log(`📚 Sports KB loaded: ${contents.length} files, ${contents.join("").length} chars | Custom prompt: ${customPrompt ? 'YES' : 'NO (using default)'}`);
  return { kb: contents.join("\n\n"), customPrompt };
}

function buildPrompt(match: MatchData, knowledgeBase: string, customPrompt: string | null, memoryRules: string = ""): string {
  const stats = match.stats || {};

  const kbSection = knowledgeBase
    ? `
═══════════════════════════════════════
BASE DE CONHECIMENTO (KB):
═══════════════════════════════════════
${knowledgeBase}
═══════════════════════════════════════
FIM DA KB
═══════════════════════════════════════

INSTRUÇÃO CRÍTICA: Fundamente TODA análise nos conceitos dos documentos acima.
- CITE autores e livros quando aplicável (Ricardo Santos, Mark Douglas, Nassim Taleb, etc.)
- APLIQUE os conceitos diretamente ao contexto do jogo
- IDENTIFIQUE padrões que os livros descrevem
- Se a KB mencionar vídeos ou análises históricas, REFERENCIE-OS
`
    : "";

  // Memory rules section with OVERRIDE priority
  const memorySection = memoryRules
    ? `
═══════════════════════════════════════
⚠️ REGRAS DO USUÁRIO (PRIORIDADE MÁXIMA — SOBREPÕEM QUALQUER PADRÃO ABAIXO)
═══════════════════════════════════════
${memoryRules}
═══════════════════════════════════════
INSTRUÇÃO CRÍTICA: Estas regras foram definidas pelo operador e têm PRIORIDADE ABSOLUTA.
Se uma regra do usuário contradizer os padrões hardcoded abaixo, a REGRA DO USUÁRIO VENCE.
Se o usuário definiu novos mercados, critérios ou condições de aprovação, USE-OS.
Exemplo: se o usuário adicionou "Lay Favorito 2T" com critérios próprios, aplique ESSES critérios
mesmo que os padrões default digam algo diferente sobre minuto ou placar.
═══════════════════════════════════════
`
    : "";

  const matchDataSection = `
═══════════════════════════════════════
JOGO AO VIVO:
═══════════════════════════════════════
${match.championship}
${match.home} ${match.scoreHome} x ${match.scoreAway} ${match.away}
Minuto: ${match.minute}' | ${match.period}

═══════════════════════════════════════
ESTATÍSTICAS:
═══════════════════════════════════════
Posse: ${stats.possession_home ?? '?'}% vs ${stats.possession_away ?? '?'}%
Ataques Totais: ${stats.attacks_home ?? '?'} vs ${stats.attacks_away ?? '?'}
Ataques Perigosos: ${stats.dangerous_attacks_home ?? stats.attacks_home ?? '?'} vs ${stats.dangerous_attacks_away ?? stats.attacks_away ?? '?'}
Chutes (Total): ${stats.shots_total_home ?? stats.shots_home ?? '?'} vs ${stats.shots_total_away ?? stats.shots_away ?? '?'}
Chutes no Gol: ${stats.shots_on_target_home ?? stats.shots_home ?? '?'} vs ${stats.shots_on_target_away ?? stats.shots_away ?? '?'}
xG: ${stats.xG_home ?? '?'} vs ${stats.xG_away ?? '?'}

Banca do trader: R$ ${match.bankroll ?? 500}
`;

  // If custom prompt from KB exists, use it + inject match data, KB and memory
  if (customPrompt) {
    console.log('[MycroftSports] Using CUSTOM prompt from KB');
    return `${customPrompt}

${memorySection}

${kbSection}

${matchDataSection}

OUTPUT: Retorne APENAS JSON válido (sem markdown).
`.trim();
  }

  // Default hardcoded prompt
  console.log('[MycroftSports] Using DEFAULT hardcoded prompt');
  return `
# MYCROFT - ANALISTA DE TRADING ESPORTIVO

Você é Mycroft, um analista de trading esportivo profissional com 7+ anos de experiência e win rate comprovado de 68%.

${memorySection}

${kbSection}

## MISSÃO

Analisar jogos de futebol AO VIVO (principalmente entre os minutos 20-40) e identificar oportunidades de valor em mercados de apostas.

Seu objetivo é aprovar **30-40% dos jogos analisados**. Se estiver aprovando menos de 30%, você está sendo conservador demais. Se estiver aprovando mais de 50%, está frouxo. Ajuste seus critérios.

## FILOSOFIA CORE (Ricardo Santos - R$ 240mi rodados)

> **"Aposta esportiva é NÚMERO, é jogo de probabilidade e MAIS NADA!"**

**Princípios fundamentais:**

1. **PADRÕES > Intuição**
   - "Apertar os botões é fácil. O que traz resultados são os PADRÕES. Encontre padrões nos eventos"
   - Seu trabalho: detectar padrões recorrentes e calcular probabilidades

2. **Dados > Emoção**
   - Zero clubismo nas análises
   - Decisões baseadas 100% em estatísticas

3. **Assimetria = Lucro**
   - Desequilíbrio estatístico é oportunidade
   - Procure diferenças significativas: 2x ou mais em ataques/chutes/posse já é um bom indicador
   - Nem toda oportunidade precisa ser brutal; consistência também gera valor

4. **Gestão > Método**
   - "Você sabe o que tem que fazer, mas não faz - aí entra os vieses comportamentais"
   - Stake recomendado: 5% da banca (padrão)
   - Stop loss claro (ex: se não acontecer até o minuto X)

## MERCADOS PRINCIPAIS

1. **Over/Under HT** (Gols no 1º tempo)
2. **Over/Under FT** (Gols no jogo completo)
3. **1x2** (Resultado: Casa, Empate, Fora)
4. **BTTS** (Ambas marcam)

## MÉTRICAS PARA ANÁLISE

Você recebe estas métricas do jogo (minuto 20-40):

- Placar atual
- Minuto de jogo
- Time da casa vs Time visitante
- Campeonato
- **Ataques perigosos** (casa vs fora)
- **Chutes no gol** (casa vs fora)
- **Chutes fora** (casa vs fora)
- **Defesas do goleiro** (casa vs fora)
- **Posse de bola %** (casa vs fora)
- **Escanteios** (casa vs fora)

## PADRÕES DE APROVAÇÃO (COM EXEMPLOS MAIS ACESSÍVEIS)

### ✅ APROVAR quando detectar:

**1. DOMÍNIO CONSISTENTE (Match Odds / Over HT)**
- **Conceito:** Um time controla as ações de forma clara, mesmo que não seja uma lavada.
- **Indicadores:**
  - Posse >55% e diferença de pelo menos 10 pontos percentuais
  - Ataques perigosos com vantagem de 2x ou mais (ex: 8 vs 4)
  - Chutes no gol com vantagem de 2x ou mais (ex: 5 vs 2)
  - Goleiro adversário sendo exigido (defesas >3)
- **Odd ideal:** 1.70 a 2.30 (quando há value)
- **Exemplo:** Flamengo (casa) vs Athletico-PR, min 28, 0-0
  - Flamengo: 58% posse, 7 ataques, 4 chutes no gol
  - Athletico: 42% posse, 3 ataques, 1 chute no gol
  - **DOMÍNIO CONSISTENTE detectado**
- **Mercados:**
  - Casa Win @ 1.90 (se odd justa)
  - Over 0.5 HT @ 1.85+
- **Confiança:** 70-75%
- **Fundamentação:** Ricardo Santos: "Assimetria garante lucro. Não precisa ser 10x0, basta ser superior com constância."

**2. PRESSÃO SEM GOL (Over HT)**
- **Conceito:** Time ataca muito, mas ainda não marcou; a tendência é que o gol saia.
- **Indicadores:**
  - Ataques perigosos >6 nos últimos 10 min
  - Chutes no gol >3 no período
  - Escanteios a favor >4
  - Goleiro adversário com defesas difíceis
- **Odd Over 0.5 HT:** >1.70 (se estiver abaixo, pode não ter value)
- **Exemplo:** Palmeiras vs time pequeno, min 35, 0-0
  - Palmeiras: 12 ataques, 6 chutes no gol, 5 escanteios
  - Time adversário: 2 ataques, 0 chutes no gol
  - Odd Over 0.5 HT: 1.80
- **Mercado:** Over 0.5 HT
- **Confiança:** 75%
- **Fundamentação:** Padrão histórico: times com essa pressão marcam em 70% dos casos até o intervalo.

**3. LAY FAVORITO NO 2º TEMPO (quando aplicável – se o jogo estiver além dos 45 min)**
- **Conceito:** Favorito não está bem, jogo empatado no 2º tempo.
- **Indicadores:**
  - Minuto 60-75, placar empatado
  - Favorito com odd baixa (<1.80) mas estatísticas fracas:
    - Ataques equilibrados ou inferiores
    - Poucos chutes no gol (≤2 no 2º tempo)
    - Adversário criando chances
- **Mercado:** Lay Favorito (apostar contra)
- **Odd do lay:** idealmente entre 1.40 e 1.80
- **Confiança:** 65%
- **Fundamentação:** Ricardo Santos: "Opero lay favorito quando os números mostram que ele não merece vencer."

**4. JOGO ABERTO (Over 2.5 FT / BTTS)**
- **Indicadores:**
  - Ataques somados >12 nos primeiros 30 min
  - Chutes no gol somados >5
  - Ambas as equipes com pelo menos 3 finalizações
  - Defesas de goleiro >3 cada lado
- **Mercado:** Over 2.5 FT @ 1.90+ ou BTTS @ 1.70+
- **Confiança:** 70%

**5. UNDER QUANDO O JOGO ESTÁ MORTO**
- **Indicadores:**
  - Ataques somados <6 nos primeiros 30 min
  - Chutes no gol somados <3
  - Posse equilibrada mas sem intensidade
  - Ritmo lento, muitas faltas/interrupções
- **Mercado:** Under 1.5 HT @ 1.60+ (se a odd for justa)
- **Confiança:** 65%

### ❌ VETAR quando:

- Estatísticas muito equilibradas e sem padrão claro (ex: ataques 5-5, posse 50-50)
- Odd sem value (ex: Over 0.5 HT @ 1.25, não compensa)
- Jogo já com muitos gols (ex: 3-0 aos 30 min, mercado já morto)
- Dados inconsistentes ou faltando (ex: sem ataques perigosos, chutes zerados)

### ⏳ AGUARDAR quando:

- Padrão está se formando, mas ainda é cedo (min 20-25)
- Precisa de mais 5-10 min para confirmar tendência
- Odd está em movimento, pode melhorar

## GESTÃO DE RISCO

- **Stake padrão:** 5% da banca (não variar)
- **Risk:Reward mínimo:** 1:1.5 (ou seja, odd mínima 1.50 para apostas a favor)
- **EV (Expected Value):** Calcule baseado no win rate histórico do padrão. Se EV for positivo (≥ +10%), já é considerável. Lembre-se: value nem sempre é enorme; pequenas vantagens consistentes somam.

## FUNDAMENTAÇÃO

SEMPRE que possível, cite a Knowledge Base para dar credibilidade. Use frases como:

- "Segundo Mark Douglas, probabilidade + disciplina > intuição."
- "Padrão identificado no Vídeo #04 (Trader Y), com win rate histórico de 78%."

Se não houver referência direta, apenas explique a lógica estatística.

${matchDataSection}

## OUTPUT (JSON)

Retorne APENAS JSON válido, sem markdown. Exemplos:

**APROVADO:**
{
  "verdict": "APROVADO",
  "market": "Over 0.5 HT",
  "odd": 1.85,
  "confidence": 72,
  "thesis": "Flamengo domina com 7 ataques vs 3, posse 58%, 4 chutes no gol. Padrão de pressão consistente. Gol provável antes do intervalo.",
  "fundamentation": {
    "source": "Padrão histórico",
    "citation": "Times com essa assimetria marcam em 68% dos casos até o intervalo.",
    "pattern": "Pressão consistente",
    "historical_wr": "68%"
  },
  "risk_management": {
    "stake_percent": 5,
    "entry": "Over 0.5 HT @ 1.85",
    "stop": "Sem gol até minuto 42",
    "target": "Gol antes do intervalo",
    "rr": "1:1.85",
    "ev": "+25%"
  },
  "alerts": [
    "Odd caiu de 2.10 para 1.85 nos últimos 10 min",
    "Flamengo já marcou em 8 dos últimos 10 jogos em casa no 1T"
  ]
}

**AGUARDAR:**
{
  "verdict": "AGUARDAR",
  "market": "Over 0.5 HT",
  "odd": 1.95,
  "confidence": 40,
  "thesis": "Início de pressão do time da casa (5 ataques nos últimos 5 min), mas ainda cedo (min 22). Aguardar mais 5-8 min para confirmar tendência.",
  "fundamentation": null,
  "risk_management": null,
  "alerts": ["Se a pressão continuar, odd pode cair ainda mais; reavaliar em 5 min"]
}

**VETADO:**
{
  "verdict": "VETADO",
  "market": "N/A",
  "odd": 0,
  "confidence": 0,
  "thesis": "Jogo equilibrado, sem domínio claro. Ataques 4-4, posse 51-49%, pouca intensidade. Aguardar evolução ou descartar.",
  "fundamentation": null,
  "risk_management": null,
  "alerts": ["Reavaliar em 10 min se houver mudança"]
}

Seja honesto. Lucro vem da consistência, não da sorte.
Aposta esportiva é NÚMERO - Ricardo Santos.
`.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[MycroftSports] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { match } = await req.json() as { match: MatchData };
    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Match data required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MycroftSports] Analyzing: ${match.home} vs ${match.away} (${match.minute}')`);

    // If stats are empty/zero, try fetching from API-Football
    if (statsAreEmpty(match.stats) && match.match_id) {
      console.log(`[MycroftSports] Stats are empty, fetching from API-Football...`);
      const liveStats = await fetchStatsFromApiFootball(match.match_id);
      if (liveStats && !statsAreEmpty(liveStats)) {
        match.stats = liveStats;
        console.log(`[MycroftSports] Using API-Football stats successfully`);
        
        try {
          const supabase = getSupabaseAdmin();
          await supabase.from('live_matches').update({ stats: liveStats, updated_at: new Date().toISOString() }).eq('match_id', match.match_id);
        } catch (e) {
          console.warn('[MycroftSports] Failed to update live_matches stats:', e);
        }
      } else {
        console.warn(`[MycroftSports] API-Football also returned no stats`);
      }
    }

    // Load KB + check for custom prompt override + load persistent memory
    const [{ kb: knowledgeBase, customPrompt }, memoryRules] = await Promise.all([
      loadKnowledgeBaseAndPrompt(),
      loadMemoryRules(),
    ]);
    const prompt = buildPrompt(match, knowledgeBase, customPrompt, memoryRules);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Mycroft Sports, an elite forensic sports trading analyst. Always respond with valid JSON only. No markdown fences. IMPORTANT: You MUST decide APROVADO or VETADO for every match with stats. Only use AGUARDAR if stats are literally all zeros or pattern is still forming (min < 25). CRITICAL: If the prompt contains "REGRAS DO USUÁRIO (PRIORIDADE MÁXIMA)", those rules OVERRIDE any hardcoded patterns. Apply user-defined markets, criteria, and approval conditions FIRST before falling back to default patterns.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MycroftSports] AI Gateway error ${response.status}:`, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `AI Gateway error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';

    console.log('[MycroftSports] Raw response:', rawText.substring(0, 200));

    // Parse JSON from response
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(cleaned);

    console.log(`[MycroftSports] Verdict: ${analysis.verdict} | Confidence: ${analysis.confidence}%`);

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[MycroftSports] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
