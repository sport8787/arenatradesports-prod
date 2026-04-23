INSERT INTO public.mycroft_planos (codigo, nome, emoji, categoria, mercado, janela, risco, conceito, execucao, observacao, criterios, vetos, ativo, versao)
VALUES (
  'OVER05HT',
  'Plano Over 0.5 HT',
  '⚡',
  'Gols 1º Tempo',
  'Over 0.5 HT',
  '10'' - 25''',
  'MÉDIO',
  'Captura jogos no 1º tempo (10-25min) com placar 0x0 onde existe alta probabilidade de sair gol antes do intervalo, seja por dominância clara do favorito (Cenário 1) ou por jogo aberto e movimentado dos dois lados (Cenário 2).',
  'Entrar em Over 0.5 HT quando QUALQUER um dos dois cenários abaixo for atendido 100%. Stake padrão (5%). Aprovar com confiança >= 65%.',
  'Cenário 1 = dominância isolada do favorito. Cenário 2 = jogo equilibrado com volume ofensivo bilateral (somatório das estatísticas dos dois times).',
  '[
    "Placar obrigatoriamente 0x0",
    "CENÁRIO 1 (Favorito Dominando) — todos os critérios: Minuto entre 10 e 25; Posse do favorito > 60%; Ataques perigosos por minuto do favorito >= 1; xG do favorito >= 0.75; Chutes a gol do favorito >= 3; Pressão do favorito = ALTA",
    "CENÁRIO 2 (Jogo Equilibrado e Movimentado) — todos os critérios: Minuto entre 10 e 25; Soma de ataques perigosos por minuto (casa + fora) >= 1.5; Soma de xG (casa + fora) >= 1.0; Soma de chutes a gol (casa + fora) >= 5; Pressão somada = ALTA",
    "Aprovar Over 0.5 HT se Cenário 1 OU Cenário 2 estiver 100% atendido"
  ]'::jsonb,
  '[
    "Minuto fora da janela 10-25 — não é Over 0.5 HT",
    "Já existe gol no placar — mercado morto, não é Over 0.5 HT",
    "Cenário 1 e Cenário 2 ambos incompletos — não nomear este plano",
    "Pressão classificada como BAIXA ou MÉDIA em ambos cenários — não é Over 0.5 HT"
  ]'::jsonb,
  true,
  1
)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  emoji = EXCLUDED.emoji,
  categoria = EXCLUDED.categoria,
  mercado = EXCLUDED.mercado,
  janela = EXCLUDED.janela,
  risco = EXCLUDED.risco,
  conceito = EXCLUDED.conceito,
  execucao = EXCLUDED.execucao,
  observacao = EXCLUDED.observacao,
  criterios = EXCLUDED.criterios,
  vetos = EXCLUDED.vetos,
  ativo = true,
  atualizado_em = now();