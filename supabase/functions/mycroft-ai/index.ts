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
    const { questionText, correctAnswer, type } = await req.json();

    if (!questionText) {
      throw new Error('Missing questionText');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log(`Generating Mycroft ${type || 'bluff'} for:`, questionText);

    let systemPrompt: string;
    
    if (type === 'detector') {
      systemPrompt = `Você é uma IA analítica de verificação de fatos (Fact-Checking) no estilo Sherlock Holmes. O objetivo é desmascarar um mentiroso.

A Pergunta é: "${questionText}"
A Resposta Correta (Verdade) é: "${correctAnswer}"

Sua tarefa: Explique de forma curta e direta (máximo 25 palavras) qual é a verdade científica ou histórica sobre esse fato, para provar que qualquer outra coisa é mentira. Use um tom de 'Sherlock Holmes' desvendando um mistério - perspicaz, confiante e ligeiramente dramático.

Responda apenas com a explicação, sem introduções.`;
    } else if (type === 'analytics') {
      systemPrompt = `Você é o Mycroft Analytics, uma IA especialista em análise comportamental e detecção de blefes. Você está ajudando o júri a decidir se o jogador está blefando ou falando a verdade.

A Pergunta é: "${questionText}"

Sua tarefa: Analise esta pergunta e forneça uma análise de risco de blefe em formato JSON com:
1. "riskLevel": número de 0 a 100 representando a probabilidade de blefe (0 = certamente verdade, 100 = certamente blefe)
2. "analysis": uma análise curta e perspicaz (máximo 30 palavras) sobre por que alguém poderia blefar nesta pergunta, considerando a dificuldade e o tipo de conhecimento necessário.

Use um tom analítico e profissional. Responda APENAS com o JSON, sem markdown ou explicações.`;
    } else {
      systemPrompt = `Você é o Mycroft, uma IA especialista em blefe e manipulação psicológica. O usuário precisa mentir sobre uma pergunta de trivia. A Pergunta é: "${questionText}". A Resposta Correta é: "${correctAnswer}". Sua tarefa: Crie uma mentira curta, criativa e muito convincente (máximo 20 palavras) que pareça a resposta certa, mas esteja errada. Use um tom confiante e levemente arrogante. Responda apenas com a sugestão de blefe, sem explicações adicionais.`;
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
          { role: 'user', content: type === 'detector' 
            ? 'Revele a verdade sobre este fato.'
            : type === 'analytics' 
              ? 'Analise o risco de blefe desta pergunta.' 
              : 'Me dê uma sugestão de blefe convincente.' 
          }
        ],
        max_tokens: 150,
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
      return new Response(JSON.stringify({ truth: content }), {
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
