## Diagnóstico

**Futodds COBRE amistosos internacionais.** Acabei de checar a API ao vivo agora (03h11 UTC):

```
event_id: 35660273
home: Mexico  away: Serbia  scores: 2-1  elapsed: 47'
league_name: "International Match"  league_id: 250
```

Ou seja: o jogo está sendo entregue pelo Futodds, mas **está sendo filtrado fora** em dois pontos:

### Bug 1 — Backend (`fetch-live-matches`)
O filtro de ligas (linha 132-156) compara:
1. `league.id` numérico contra `trader_leagues.league_id` (IDs API-Football).
2. Fallback por nome normalizado.

Futodds usa `league_id = 250` (BetsAPI), que **não existe em `trader_leagues`** (lá temos só ID 10 da API-Football para "Amistosos Internacionais", e ele está desabilitado/ausente — confirmei via SQL).
O fallback por nome também falha: Futodds devolve `"International Match"`, normaliza para `"international match"`, e isso não bate (nem por inclusão) com `"amistosos internacionais"` que está no registry.

### Bug 2 — Frontend (`src/hooks/useLiveMatches.ts`)
A whitelist `LIGAS_PERMITIDAS` tem `'International Friendlies'` e `'Friendlies'`, mas **NÃO tem `'International Match'`** (que é o nome literal que o Futodds devolve). Mesmo se o backend deixasse passar, o hook esconderia.

---

## Plano (apenas para Arena Live)

### 1. Habilitar amistosos no `trader_leagues`
Migration `INSERT ... ON CONFLICT DO UPDATE` para garantir 3 linhas habilitadas:

| league_id | name | enabled |
|---|---|---|
| 10 | Amistosos Internacionais | true |
| 250 | International Match | true |
| 667 | Club Friendlies | true |

(IDs 10 e 667 = API-Football; 250 = Futodds/BetsAPI. Como o filtro casa por ID **ou** por nome, cobrir os 3 garante match em qualquer provider.)

### 2. Tornar o fallback de nome do `fetch-live-matches` mais tolerante a aliases de amistosos
Adicionar uma normalização extra que mapeia variantes Futodds → nome canônico antes do match:
- `"international match"` → `"amistosos internacionais"`
- `"international friendly"`, `"int. friendly"`, `"friendly international"` → idem
- `"club friendly"`, `"club friendlies"` → `"club friendlies"`

Mantém a lógica genérica intacta; só evita ter que cadastrar N linhas para cada variação textual que Futodds use.

### 3. Atualizar whitelist do hook `useLiveMatches.ts`
Adicionar à `LIGAS_PERMITIDAS`:
- `'International Match'`
- `'Club Friendly'`, `'Club Friendlies'`
- `'Friendly International'`

(o `includes` é case-insensitive, então a adição cobre os textos que o Futodds usa).

### 4. Verificação pós-deploy
- `curl` em `fetch-live-matches` e conferir log `[FetchLive] ligas_encontradas` incluindo `International Match`.
- Conferir no preview que Mexico × Serbia (e outros amistosos em andamento) aparecem em Arena Live.
- Confirmar que `analyze-live-matches` roda análise IA para esses jogos (já usa o mesmo `live_matches` populado pelo fetch, então herda automaticamente).

---

## Conclusão sobre Sportmonks

**Não precisa criar conta trial nova só por causa de amistosos** — o Futodds já cobre. Os 3 ajustes acima resolvem.

Se aprovar, parto para implementação (migração SQL + 2 edits de código + redeploy do `fetch-live-matches`).