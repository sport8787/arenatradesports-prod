/**
 * Edge function: migrate-auth-to-mirror
 *
 * Migra auth.users do projeto Lovable Cloud (origem) para o Supabase espelho.
 * Roda 100% server-side — usa a SERVICE_ROLE_KEY auto-injetada da origem +
 * EXTERNAL_SUPABASE_SERVICE_ROLE do espelho (já configurada como secret).
 *
 * Como invocar (do CLI/sandbox):
 *   curl -X POST "$SUPABASE_URL/functions/v1/migrate-auth-to-mirror" \
 *     -H "Authorization: Bearer $SOURCE_ADMIN_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{"dryRun": false}'
 *
 * Body:
 *   { "dryRun": boolean, "limit": number? }
 *
 * Resposta:
 *   { exported, imported, skipped, failed, failures: [...] }
 *
 * Segurança: protegida por header X-Migration-Token (secreto MIGRATION_TOKEN).
 */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const SRC_URL = Deno.env.get("SUPABASE_URL")!;
const SRC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DST_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const DST_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE")!;
const MIGRATION_TOKEN = Deno.env.get("MIGRATION_TOKEN") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-migration-token, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Trava por token (impede uso indevido)
  const token = req.headers.get("x-migration-token") ?? "";
  if (!MIGRATION_TOKEN || token !== MIGRATION_TOKEN) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun === true;
  const limit: number | null = body.limit ?? null;
  const offset: number = body.offset ?? 0;
  const emailsFilter: string[] | null = Array.isArray(body.emails)
    ? body.emails.map((e: string) => e.toLowerCase().trim()).filter(Boolean)
    : null;

  const src = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } });

  // 1) Listar todos os usuários da origem (paginação 1000)
  const users: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await src.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      return new Response(JSON.stringify({ error: `list: ${error.message}` }), {
        status: 500,
        headers: { ...cors, "content-type": "application/json" },
      });
    }
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
    if (limit && users.length >= limit) break;
  }
  let list = limit ? users.slice(0, limit) : users;
  if (emailsFilter && emailsFilter.length) {
    list = users.filter((u) => u.email && emailsFilter.includes(u.email.toLowerCase()));
  }

  if (dryRun) {
    return new Response(
      JSON.stringify({
        dryRun: true,
        exported: list.length,
        sample: list.slice(0, 3).map((u) => ({ id: u.id, email: u.email })),
      }),
      { headers: { ...cors, "content-type": "application/json" } },
    );
  }

  // 2) Importar no destino preservando UUID + senha (password_hash)
  let imported = 0,
    skipped = 0,
    failed = 0;
  const failures: string[] = [];

  for (const u of list) {
    const payload: Record<string, unknown> = {
      id: u.id, // CRÍTICO: mantém UUID p/ FKs em public.*
      email: u.email ?? undefined,
      phone: u.phone ?? undefined,
      email_confirm: !!u.email_confirmed_at,
      phone_confirm: !!u.phone_confirmed_at,
      user_metadata: u.user_metadata ?? {},
      app_metadata: u.app_metadata ?? {},
    };
    // Preserva senha (somente disponível via admin.listUsers + service_role)
    const pwd = (u as any).encrypted_password;
    if (pwd) payload.password_hash = pwd;

    const resp = await fetch(`${DST_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: DST_KEY,
        Authorization: `Bearer ${DST_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      imported++;
    } else {
      const txt = await resp.text();
      const msg = txt.toLowerCase();
      if (resp.status === 422 || msg.includes("already") || msg.includes("exists")) {
        skipped++;
      } else {
        failed++;
        if (failures.length < 20) {
          failures.push(`${u.email ?? u.id}: HTTP ${resp.status} — ${txt.slice(0, 200)}`);
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      exported: list.length,
      imported,
      skipped,
      failed,
      failures,
      notes: [
        "Senhas migradas via password_hash (hashes bcrypt preservados).",
        "Reseed public.user_roles após esta etapa.",
        "Trigger on_auth_user_created_profile pode ter populado profiles automaticamente.",
      ],
    }),
    { headers: { ...cors, "content-type": "application/json" } },
  );
});
