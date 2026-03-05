

## Atualizar a chave THE_ODDS_API_KEY

A chave já existe no projeto e é usada por 2 funções backend:
- **mycroft-punter-analysis** — busca odds em tempo real para gerar sinais
- **settle-bets** — busca placares finais para liquidar apostas

### O que precisa ser feito

1. **Atualizar o segredo** `THE_ODDS_API_KEY` com a nova chave da assinatura paga (usando a ferramenta de adição de segredos, que sobrescreve o valor atual)

2. **Testar a conexão** chamando a edge function `settle-bets` ou `mycroft-punter-analysis` para confirmar que a nova chave está funcionando

Nenhuma alteração de código é necessária — a infraestrutura já está pronta para usar a chave. Basta substituir o valor do segredo.

### Onde encontrar sua chave
- Acesse [the-odds-api.com](https://the-odds-api.com) → faça login → **Account** → copie sua **API Key**

### Plano que você assinou
Confirme qual plano escolheu para que eu possa otimizar as chamadas de API de acordo com os limites de requests do seu plano.

