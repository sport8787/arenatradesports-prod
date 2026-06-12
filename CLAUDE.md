# Arena Trade Sports — instruções para Claude Code

## Regra obrigatória: sempre commitar e fazer push ao final

**Toda sessão de trabalho deve terminar com `git add → git commit → git push origin main`.**

- Vercel faz deploy automático apenas quando há push no GitHub
- Mudanças não commitadas nunca chegam em produção
- Não encerre uma tarefa sem confirmar que o push foi feito
- Se houver dúvida sobre o que commitar, mostre o `git diff --stat` e confirme com o usuário antes de commitar

## Stack

- Frontend: React 18 + Vite + TypeScript — hospedado na Vercel (auto-deploy em push para `main`)
- Backend: Supabase Edge Functions (Deno) — deploy via `npx supabase functions deploy <nome>`
- DB: Supabase PostgreSQL — migrations via `npx supabase db query --linked --file <arquivo.sql>`
- Projeto Supabase: `ogpohiugfkvygcejrzfp`

## Deploy de edge functions

Sempre que alterar um arquivo em `supabase/functions/<nome>/index.ts`, fazer deploy:

```bash
npx supabase functions deploy <nome-da-função>
```

## Migrations

Usar `db query --linked --file` em vez de `db push` para evitar conflitos com migrações antigas:

```bash
npx supabase db query --linked --file supabase/migrations/<arquivo>.sql
```

## Segurança

- Nunca commitar `.env` ou qualquer token/chave secreta
- O token Vercel e o service role key do Supabase são sensíveis — nunca expor em código
