# Arena Trade Sports — instruções para Claude Code

## Regras de deploy por tipo de mudança

| Tipo | Para ir ao vivo | `git push` obrigatório? |
|---|---|---|
| Frontend `.tsx/.ts` | `git push origin main` → Vercel auto-deploya | **Sim** |
| Edge function | `npx supabase functions deploy <nome>` | Não (mas commitar para histórico) |
| Migration SQL | `npx supabase db query --linked --file <arquivo>` | Não (mas commitar para histórico) |

**Regra prática:**
- Mudanças de frontend → sempre terminar com `git push origin main`
- Edge functions → deploy direto via CLI, já está ao vivo imediatamente
- Sempre commitar ao final para manter o código em sync com o git, mesmo quando o push não é necessário para funcionar

## Stack

- Frontend: React 18 + Vite + TypeScript — hospedado na Vercel (auto-deploy em push para `main`)
- Backend: Supabase Edge Functions (Deno) — deploy via `npx supabase functions deploy <nome>`
- DB: Supabase PostgreSQL — migrations via `npx supabase db query --linked --file <arquivo.sql>`
- Projeto Supabase: `ogpohiugfkvygcejrzfp`

## Deploy de edge functions

```bash
npx supabase functions deploy <nome-da-função>
# imediatamente ao vivo — não precisa de git push
```

## Migrations

Usar `db query --linked --file` em vez de `db push` para evitar conflitos com migrações antigas:

```bash
npx supabase db query --linked --file supabase/migrations/<arquivo>.sql
```

## Segurança

- Nunca commitar `.env` ou qualquer token/chave secreta
- O token Vercel e o service role key do Supabase são sensíveis — nunca expor em código
