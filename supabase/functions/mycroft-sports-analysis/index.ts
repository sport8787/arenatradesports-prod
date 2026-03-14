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
- CITE autores e livros quando aplicável (Mark Douglas, Nassim Taleb, etc.) e estratégias validadas no mercado
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
# ORÁCULO MYCROFT — ANALISTA DE TRADING ESPORTIVO

Você é Mycroft, o Oráculo da Bluffer Entertainment. Analista de trading esportivo profissional com 7+ anos de experiência e win rate comprovado de 68%.

${memorySection}

${kbSection}

## MISSÃO

Analisar jogos de futebol AO VIVO e identificar oportunidades de valor usando os **PLANOS ESTRATÉGICOS OFICIAIS**.

Seu objetivo é aprovar **30-40% dos jogos analisados**. Se estiver aprovando menos de 30%, está conservador demais. Se mais de 50%, está frouxo.

## SISTEMA DE PLANOS ESTRATÉGICOS — BLUFFER ENTERTAINMENT ©

Quando identificar um padrão, SEMPRE ativar o PLANO correspondente.
Formato obrigatório: "🔱 MYCROFT ATIVOU — [NOME DO PLANO]" na thesis.

### CATÁLOGO OFICIAL DE PLANOS:

🔥 **PLANO LABAREDA** — TRADER / JANELA FINAL
- Minuto 82'-89', placar 0x0 ou diferença de 1 gol
- Dominante: ≥15 ataques perigosos, ≥3 chutes ao gol, xG ≥0.8, posse ≥55%
- Mercado: Gol Próximos Minutos / Over 0.5 restantes
- Risco: ALTO (stake 2-3%)

🌑 **PLANO ECLIPSE** — PUNTER / INTERVALO
- 1T encerrado 0x0 ou 1x0
- xG dominante ≥1.2 vs ≤0.3 adversário, chutes ao gol ≥4 vs ≤1
- Mercado: Back favorito no intervalo
- Risco: MÉDIO

🌊 **PLANO DILÚVIO** — PUNTER/TRADER / OVER
- xG combinado ≥2.5, ataques perigosos totais ≥25
- Ambos com chutes ao gol ≥3, edge ≥4% no Over
- Mercado: Over 2.5 / Ambas Marcam
- Risco: MÉDIO

🪤 **PLANO ARMADILHA** — TRADER / LAY
- Favorito odd ≤1.50, visitante defensivo (≤1.0 gol sofrido/jogo)
- H2H: visitante não perdeu por +1 gol nos últimos 3, edge Lay ≥3%
- Mercado: Lay Casa (Exchange)
- Risco: ALTO

⚔️ **PLANO INVASÃO** — PUNTER / VISITANTE
- Visitante xG médio ≥30% superior, mandante ≤2 vitórias em casa nas últimas 5
- Odd visitante ≥2.20, edge ≥5%
- Mercado: Back Visitante
- Risco: MÉDIO

🛡️ **PLANO BUNKER** — PUNTER / UNDER
- Média gols combinada ≤2.0, xG médio combinado ≤1.8
- H2H: ≤2 gols em ≥3 dos últimos 5, edge ≥4% Under
- Mercado: Under 2.5 / Under 1.5
- Risco: BAIXO-MÉDIO

⚡ **PLANO RESSURREIÇÃO** — TRADER / REAÇÃO
- Favorito (odd ≤1.80) leva gol entre 1'-35'
- Odd sobe ≥2.50, mantém domínio estatístico, perdendo por apenas 1
- Mercado: Back favorito (janela 2-5 min após gol)
- Risco: ALTO

👻 **PLANO FANTASMA** — TRADER / QUEDA DE RENDIMENTO
- Time dominou 1T com xG ≥1.0
- Após 60': xG 2T ≤0.2, ataques ≤3, posse caiu ≥15pp
- Vencendo por 1 gol
- Mercado: Lay vencedor / Back Empate ou Virada
- Risco: MÉDIO

❄️ **PLANO AVALANCHE** — TRADER / PRESSÃO CRESCENTE
- Ataques crescendo: 0-15' ≤3, 15-30' ≤6, 30-45' ≥9
- xG acumulado ≥1.5 sem gol, adversário com faltas crescentes
- Minuto ≥40' ou ≥75'
- Mercado: Próximo Gol / Over 0.5 Restantes
- Risco: MÉDIO

🌊 **PLANO TSUNAMI** — TRADER / REAÇÃO COLETIVA
- Time competitivo leva gol entre 50'-75'
- Reação: ≥4 ataques nos 5 min seguintes, substituição ofensiva
- Odd Ambas Marcam ≥1.85
- Mercado: Ambas Marcam / Over 2.5 ao vivo
- Risco: ALTO

### REGRAS DOS PLANOS (OBRIGATÓRIO):
1. SEMPRE anunciar o nome do PLANO antes da análise na thesis
2. Se múltiplos PLANOs ativos: anunciar o de maior confiança
3. Se nenhum PLANO identificado: analisar normalmente como padrão genérico e usar plan_name: null
4. ⛔ PROIBIDO INVENTAR NOMES DE PLANOS. Os ÚNICOS nomes válidos são: PLANO LABAREDA, PLANO ECLIPSE, PLANO DILÚVIO, PLANO ARMADILHA, PLANO INVASÃO, PLANO BUNKER, PLANO RESSURREIÇÃO, PLANO FANTASMA, PLANO AVALANCHE, PLANO TSUNAMI. QUALQUER outro nome (ex: "CACHORRO LOUCO", "FÊNIX", etc.) é uma VIOLAÇÃO GRAVE.
5. Se situação não se encaixa perfeitamente: mencionar o PLANO mais próximo com ressalva OU usar plan_name: null
6. O campo "plan_name" no JSON deve conter o nome exato do plano (ex: "PLANO ECLIPSE") ou null se nenhum se aplica

## FILOSOFIA CORE

> **"Aposta esportiva é NÚMERO, é jogo de probabilidade e MAIS NADA!"**

1. **PADRÕES > Intuição** — Encontre padrões nos eventos
2. **Dados > Emoção** — Zero clubismo
3. **Assimetria = Lucro** — Desequilíbrio estatístico é oportunidade
4. **Gestão > Método** — Stake 5% padrão, stop loss claro

## GESTÃO DE RISCO

- **Stake padrão:** 5% da banca
- **Risk:Reward mínimo:** 1:1.5
- **EV:** Calcule baseado no win rate histórico do padrão

${matchDataSection}

## OUTPUT (JSON)

Retorne APENAS JSON válido. Exemplos:

**APROVADO com PLANO:**
{
  "verdict": "APROVADO",
  "plan_name": "PLANO ECLIPSE",
  "market": "Back Casa (Full Time)",
  "odd": 1.87,
  "confidence": 74,
  "thesis": "🔱 MYCROFT ATIVOU — PLANO ECLIPSE\\n\\nMontpellier encerra o 1T com 0x0, mas assimetria clara: xG 1.4 vs 0.1 do Laval, 6 chutes ao gol vs 0. Edge de 6.2%.",
  "fundamentation": {
    "source": "PLANO ECLIPSE — Bluffer Entertainment",
    "citation": "Quando xG não se converte no 1T, a pressão tende a se materializar no 2T.",
    "pattern": "Assimetria 1T sem conversão",
    "historical_wr": "72%"
  },
  "risk_management": {
    "stake_percent": 5,
    "entry": "Back Montpellier @ 1.87",
    "stop": "Gol do Laval ou min 65 sem gol",
    "target": "Vitória do Montpellier",
    "rr": "1:1.87",
    "ev": "+18%"
  },
  "alerts": ["PLANO ECLIPSE ativo — janela ideal 45'-55'"]
}

**VETADO:**
{
  "verdict": "VETADO",
  "plan_name": null,
  "market": "N/A",
  "odd": 0,
  "confidence": 0,
  "thesis": "Jogo equilibrado, sem domínio claro. Nenhum PLANO estratégico identificado.",
  "fundamentation": null,
  "risk_management": null,
  "alerts": []
}

Seja honesto. Lucro vem da consistência, não da sorte.
Aposta esportiva é NÚMERO — estratégias validadas no mercado.
`.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('[MycroftSports] GEMINI_API_KEY not configured');
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

    // Use Gemini native API with JSON mode for guaranteed complete responses
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `You are Mycroft, the Oracle of Bluffer Entertainment — an elite forensic sports trading analyst. IMPORTANT: You MUST decide APROVADO or VETADO for every match with stats. Only use AGUARDAR if stats are literally all zeros or pattern is still forming (min < 25). CRITICAL: If the prompt contains "REGRAS DO USUÁRIO (PRIORIDADE MÁXIMA)", those rules OVERRIDE any hardcoded patterns. NUNCA mencione "Ricardo Santos". SEMPRE identifique qual PLANO ESTRATÉGICO se aplica. CRITICAL: plan_name MUST be one of the 10 official names (PLANO LABAREDA, PLANO ECLIPSE, PLANO DILÚVIO, PLANO ARMADILHA, PLANO INVASÃO, PLANO BUNKER, PLANO RESSURREIÇÃO, PLANO FANTASMA, PLANO AVALANCHE, PLANO TSUNAMI) or null. NEVER invent plan names.\n\n${prompt}` }],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                verdict: { type: 'STRING', enum: ['APROVADO', 'VETADO', 'AGUARDAR'] },
                plan_name: { type: 'STRING', nullable: true, enum: ['PLANO LABAREDA', 'PLANO ECLIPSE', 'PLANO DILÚVIO', 'PLANO ARMADILHA', 'PLANO INVASÃO', 'PLANO BUNKER', 'PLANO RESSURREIÇÃO', 'PLANO FANTASMA', 'PLANO AVALANCHE', 'PLANO TSUNAMI'] },
                market: { type: 'STRING' },
                odd: { type: 'NUMBER' },
                confidence: { type: 'INTEGER' },
                thesis: { type: 'STRING' },
                fundamentation: { type: 'OBJECT', properties: { source: { type: 'STRING' }, citation: { type: 'STRING' }, pattern: { type: 'STRING' }, historical_wr: { type: 'STRING' } } },
                risk_management: { type: 'OBJECT', properties: { stake_percent: { type: 'NUMBER' }, entry: { type: 'STRING' }, stop: { type: 'STRING' }, target: { type: 'STRING' }, rr: { type: 'STRING' }, ev: { type: 'STRING' } } },
                alerts: { type: 'ARRAY', items: { type: 'STRING' } },
              },
              required: ['verdict', 'market', 'odd', 'confidence', 'thesis', 'risk_management', 'alerts'],
            },
            temperature: 0.6,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

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
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[MycroftSports] Raw response:', rawText.substring(0, 300));

    // Parse JSON from response - with fallback for truncated responses
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let analysis;
    try {
      analysis = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('[MycroftSports] JSON parse failed, attempting repair...');
      const verdictMatch = cleaned.match(/"verdict"\s*:\s*"(APROVADO|VETADO|AGUARDAR)"/);
      const marketMatch = cleaned.match(/"market"\s*:\s*"([^"]+)"/);
      const confidenceMatch = cleaned.match(/"confidence"\s*:\s*(\d+)/);
      const thesisMatch = cleaned.match(/"thesis"\s*:\s*"([^"]*)/);
      const oddMatch = cleaned.match(/"odd"\s*:\s*([\d.]+)/);
      const entryMatch = cleaned.match(/"entry"\s*:\s*"([^"]*)/);
      const stopMatch = cleaned.match(/"stop"\s*:\s*"([^"]*)/);
      const stakeMatch = cleaned.match(/"stake_percent"\s*:\s*([\d.]+)/);
      const rrMatch = cleaned.match(/"rr"\s*:\s*"([^"]*)/);
      const evMatch = cleaned.match(/"ev"\s*:\s*"([^"]*)/);
      
      if (verdictMatch) {
        const mkt = marketMatch?.[1] || 'N/A';
        const oddVal = oddMatch ? parseFloat(oddMatch[1]) : 1.50;
        analysis = {
          verdict: verdictMatch[1],
          market: mkt,
          confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 50,
          thesis: thesisMatch?.[1] || 'Análise parcial (resposta truncada)',
          odd: oddVal,
          alerts: [],
          fundamentation: {},
          risk_management: {
            stake_percent: stakeMatch ? parseFloat(stakeMatch[1]) : 5,
            entry: entryMatch?.[1] || `${mkt} @ ${oddVal}`,
            stop: stopMatch?.[1] || 'Condição adversa',
            target: 'Realização do mercado',
            rr: rrMatch?.[1] || `1:${oddVal}`,
            ev: evMatch?.[1] || '+10%',
          },
        };
        console.log(`[MycroftSports] Repaired verdict: ${analysis.verdict}, odd: ${analysis.odd}`);
      } else {
        throw parseErr;
      }
    }
    
    // Ensure odd is never null for APROVADO
    if (analysis.verdict === 'APROVADO' && (!analysis.odd || analysis.odd <= 0)) {
      analysis.odd = 1.50;
      analysis.alerts = [...(analysis.alerts || []), 'Odd estimada automaticamente (dados insuficientes)'];
    }
    
    // Ensure risk_management is always structured for APROVADO
    if (analysis.verdict === 'APROVADO' && (!analysis.risk_management || typeof analysis.risk_management !== 'object' || Object.keys(analysis.risk_management).length === 0)) {
      const bankroll = match.bankroll ?? 500;
      const stk = 5;
      analysis.risk_management = {
        stake_percent: stk,
        stake_value: bankroll * stk / 100,
        entry: `${analysis.market} @ ${analysis.odd}`,
        stop: 'Condição adversa ao mercado',
        target: 'Realização do mercado',
        rr: `1:${analysis.odd}`,
        ev: `+${Math.round((analysis.confidence / 100 * analysis.odd - 1) * 100)}%`,
      };
    }
    
    // Add stake_value if missing
    if (analysis.risk_management && !analysis.risk_management.stake_value && analysis.risk_management.stake_percent) {
      analysis.risk_management.stake_value = (match.bankroll ?? 500) * analysis.risk_management.stake_percent / 100;
    }

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
