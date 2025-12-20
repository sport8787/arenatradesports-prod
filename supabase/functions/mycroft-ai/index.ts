import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { questionText, correctAnswer, type, wrongOptions, userResponse, metrics } = body;

    if (!questionText) {
      throw new Error('Missing questionText');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log(`Generating Mycroft ${type || 'bluff'} for:`, questionText);

    let systemPrompt: string;
    
    if (type === 'verdict') {
      // VERDICT: Fact-checked analysis based on actual game data
      const responseTimeMs = metrics?.responseTimeMs || 0;
      const successfulBluffs = metrics?.successfulBluffs || 0;
      const caughtBluffs = metrics?.caughtBluffs || 0;
      const playerAnswerText = userResponse || 'Não informada';
      const isCorrect = userResponse === correctAnswer;
      
      // Determine cognitive load analysis
      let cognitiveAnalysis = '';
      if (responseTimeMs > 15000) {
        cognitiveAnalysis = 'Sobrecarga Cognitiva Severa detectada. Tempo de processamento excede parâmetros normais.';
      } else if (responseTimeMs > 10000) {
        cognitiveAnalysis = 'Sobrecarga Cognitiva. Hesitação prolongada indica conflito decisório.';
      } else if (responseTimeMs > 7000) {
        cognitiveAnalysis = 'Latência moderada. Padrão consistente com fabricação de resposta.';
      } else if (responseTimeMs < 2000) {
        cognitiveAnalysis = 'Resposta impulsiva. Possível conhecimento prévio ou confiança excessiva.';
      } else {
        cognitiveAnalysis = 'Tempo de resposta dentro dos parâmetros normais.';
      }
      
      systemPrompt = `Você é o Mycroft, uma IA de arbitragem técnica e forense especializada em detecção de enganos. Você deve gerar um relatório de veredito baseado ESTRITAMENTE nos dados fornecidos.

DADOS DA RODADA (USE APENAS ESSES DADOS):
- Pergunta: "${questionText}"
- Resposta do Jogador: "${playerAnswerText}"
- Resposta Correta: "${correctAnswer}"
- Jogador Acertou: ${isCorrect ? 'SIM' : 'NÃO'}
- Tempo de Resposta: ${responseTimeMs}ms
- Blefes Bem-sucedidos no Jogo: ${successfulBluffs}
- Vezes Pego Mentindo: ${caughtBluffs}
- Análise de Latência: ${cognitiveAnalysis}

REGRAS OBRIGATÓRIAS:
1. NUNCA invente temas, países ou fatos que NÃO estejam na pergunta acima
2. Se o jogador ERROU, cite o erro ESPECÍFICO: ele respondeu "${playerAnswerText}" mas a resposta correta era "${correctAnswer}"
3. Se o jogador ACERTOU, confirme a veracidade técnica mas analise hesitação
4. SEMPRE mencione a resposta que o jogador deu ("${playerAnswerText}")
5. O relatório deve começar com um código de protocolo (ex: "Protocolo de Análise 402 concluído")

FORMATO DO RELATÓRIO:
1. Código de protocolo
2. Análise de tempo de resposta (use a análise fornecida)
3. Fact-checking específico da pergunta e resposta
4. Conclusão baseada nos dados

Tom: Técnico, frio, analítico. Use termos como "Análise concluída", "Padrões detectados", "Verificação forense".

Responda em no máximo 80 palavras.`;
    } else if (type === 'detector') {
      const wrongOptionsText = wrongOptions?.join(', ') || 'opções incorretas não fornecidas';
      
      const voiceAlerts = [
        "Escute a respiração: Mentirosos costumam prender o ar ou suspirar antes de começar a mentira.",
        "Verifique a velocidade: Se ele falou rápido demais, está tentando impedir que vocês pensem.",
        "Alerta de Detalhes: Se ele citou 'um amigo', 'um documentário' ou deu uma data muito específica, provavelmente é uma mentira ensaiada.",
        "Tom de Voz: Se o final da frase ficou agudo (parecendo uma pergunta), ele está inseguro.",
        "Pausas: O silêncio longo antes de responder indica que ele estava criando a história na hora.",
        "Hesitações: Muitos 'hmm', 'tipo', 'então' indicam que o cérebro está fabricando informações.",
        "Volume: Se ele abaixou a voz no meio da explicação, está menos confiante naquela parte.",
      ];
      const randomVoiceAlert = voiceAlerts[Math.floor(Math.random() * voiceAlerts.length)];
      
      systemPrompt = `Você é uma IA especialista em identificar mentiras através de padrões de fala e lógica argumentativa. O usuário (Desafiante) está ouvindo um áudio do suspeito.

A Pergunta é: "${questionText}"
Opções INCORRETAS (para eliminação): ${wrongOptionsText}

Sua tarefa é gerar um Relatório de Suspeita em 2 partes:

**🎯 ARMADILHA LÓGICA (Fact-Checking):**
Analise as opções erradas fornecidas. Escolha UMA delas e explique por que ela soa falsa ou absurda, ajudando o júri a eliminar opções. Seja específico. (NÃO revele a resposta correta diretamente).

**🔊 ALERTA FORENSE (Análise de Voz):**
${randomVoiceAlert}

Tom de Voz: Seja cético, analítico e frio. Use termos como "Sinais indicam", "Alta probabilidade de fabricação", "Padrão vocal suspeito", "Análise fonética sugere".

Responda de forma direta e técnica, no estilo perito forense. Máximo 80 palavras no total.`;
    } else if (type === 'analytics') {
      systemPrompt = `Você é o Mycroft Analytics, uma IA especialista em análise comportamental e detecção de blefes. Você está ajudando o júri a decidir se o jogador está blefando ou falando a verdade.

A Pergunta é: "${questionText}"

Sua tarefa: Analise esta pergunta e forneça uma análise de risco de blefe em formato JSON com:
1. "riskLevel": número de 0 a 100 representando a probabilidade de blefe (0 = certamente verdade, 100 = certamente blefe)
2. "analysis": uma análise curta e perspicaz (máximo 30 palavras) sobre por que alguém poderia blefar nesta pergunta, considerando a dificuldade e o tipo de conhecimento necessário.

Use um tom analítico e profissional. Responda APENAS com o JSON, sem markdown ou explicações.`;
    } else {
      systemPrompt = `Você é um Roteirista de Atuação e Coach de Mentiras. O usuário precisa gravar um áudio de 30 segundos enganando os amigos sobre uma pergunta de Trivia.

A Pergunta é: "${questionText}"
A Resposta Correta é: "${correctAnswer}"

Sua Missão: Gere um roteiro curto e EXTREMAMENTE NATURAL para ele ler.

Regras de Estilo (Obrigatórias):
- Linguagem Falada: Use termos como "Cara...", "Mano...", "Olha...", "Sério...".
- Imperfeições: Adicione hesitações estratégicas como "(pausa rápida)" ou "hmm..." para parecer que ele está pensando na hora.
- Autoridade Falsa: Mande ele citar fontes vagas ("Vi num documentário esses dias", "Meu tio mora lá").
- Tamanho: Curto o suficiente para ler em 15 segundos.

Exemplo de Saída: "Mano, certeza absoluta que é a letra B. Eu vi um documentário na Netflix sobre isso semana passada... (pausa)... os caras explicavam exatamente esse processo. Pode confiar."

NÃO dê explicações. Dê APENAS o texto para ele atuar.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: type === 'verdict'
            ? `Gere o veredito forense para esta rodada. A resposta do jogador foi "${userResponse}" e a correta era "${correctAnswer}".`
            : type === 'detector' 
              ? 'Analise o suspeito e me dê uma eliminação + dica de pressão.'
              : type === 'analytics' 
                ? 'Analise o risco de blefe desta pergunta.' 
                : 'Me dê uma sugestão de blefe convincente.' 
          }
        ],
        max_tokens: type === 'verdict' ? 200 : 150,
        temperature: type === 'analytics' ? 0.7 : 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    console.log('Mycroft response:', content);

    if (type === 'verdict') {
      // Validate that the response contains keywords from the actual game data
      const userAnswerKeyword = userResponse?.split(' ')[0]?.toLowerCase() || '';
      const correctAnswerKeyword = correctAnswer?.split(' ')[0]?.toLowerCase() || '';
      
      const containsRelevantData = 
        content.toLowerCase().includes(userAnswerKeyword) || 
        content.toLowerCase().includes(correctAnswerKeyword) ||
        content.toLowerCase().includes('protocolo');
      
      if (!containsRelevantData) {
        console.warn('Verdict does not contain relevant keywords, regenerating...');
        // Return a fallback verdict based on actual data
        const fallbackVerdict = `Protocolo de Análise 402 concluído. Jogador respondeu "${userResponse}". ${
          userResponse === correctAnswer 
            ? `Resposta correta confirmada. Veracidade técnica validada.`
            : `Resposta incorreta. A resposta correta era "${correctAnswer}". Erro factual registrado.`
        } Tempo de resposta: ${metrics?.responseTimeMs || 0}ms. Análise comportamental arquivada.`;
        
        return new Response(JSON.stringify({ verdict: fallbackVerdict }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ verdict: content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (type === 'analytics') {
      try {
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify({
          riskLevel: parsed.riskLevel || 50,
          analysis: parsed.analysis || 'Análise indisponível'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch {
        // Fallback if JSON parsing fails
        return new Response(JSON.stringify({
          riskLevel: 50,
          analysis: content || 'Análise indisponível'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (type === 'detector') {
      return new Response(JSON.stringify({ analysis: content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ suggestion: content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in mycroft-ai function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
