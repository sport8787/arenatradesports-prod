/**
 * migrate-table-to-mirror
 *
 * Migração genérica tabela-a-tabela do projeto origem (Lovable Cloud) para o
 * Supabase espelho. Usa PostgREST + service role keys (sem senha de DB).
 *
 * Body:
 *   {
 *     table: string,            // nome da tabela em public.*
 *     pk?: string,              // coluna usada como cursor (default: "id")
 *     order?: "asc" | "desc",   // default: "asc"
 *     pageSize?: number,        // default: 500 (max 1000 — limite PostgREST)
 *     cursor?: string | number, // último PK processado (paginação)
 *     maxPages?: number,        // default: 20 (cap por chamada p/ caber em 60s)
 *     onConflict?: string,      // ex: "id" — usa upsert
 *     dryRun?: boolean,
 *     select?: string,          // default: "*"
 *   }
 *
 * Headers: X-Migration-Token: $MIGRATION_TOKEN
 *
 * Resposta:
 *   { table, migrated, pages, nextCursor, hasMore, errors }
 */

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = req.headers.get("x-migration-token") ?? "";
  if (!MIGRATION_TOKEN || token !== MIGRATION_TOKEN) {
    return json({ error: "forbidden" }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const table: string = body.table;
  if (!table || !/^[a-zA-Z0-9_]+$/.test(table)) {
    return json({ error: "invalid table" }, 400);
  }
  const pk: string = body.pk ?? "id";
  const order: "asc" | "desc" = body.order === "desc" ? "desc" : "asc";
  const pageSize: number = Math.min(Math.max(body.pageSize ?? 500, 1), 1000);
  const maxPages: number = Math.min(Math.max(body.maxPages ?? 20, 1), 200);
  const onConflict: string | undefined = body.onConflict;
  const dryRun: boolean = body.dryRun === true;
  const select: string = body.select ?? "*";
  let cursor: any = body.cursor ?? null;

  const startedAt = Date.now();
  let migrated = 0;
  let pages = 0;
  let hasMore = false;
  const errors: string[] = [];

  try {
    for (let p = 0; p < maxPages; p++) {
      // Hard time cap to ensure we return before 60s timeout
      if (Date.now() - startedAt > 50_000) {
        hasMore = true;
        break;
      }

      const params = new URLSearchParams();
      params.set("select", select);
      params.set("order", `${pk}.${order}`);
      params.set("limit", String(pageSize));
      if (cursor !== null && cursor !== undefined) {
        const op = order === "asc" ? "gt" : "lt";
        params.set(pk, `${op}.${encodeURIComponent(String(cursor)).replace(/%2C/g, ",")}`);
      }

      const srcResp = await fetch(`${SRC_URL}/rest/v1/${table}?${params.toString()}`, {
        headers: {
          apikey: SRC_KEY,
          Authorization: `Bearer ${SRC_KEY}`,
        },
      });
      if (!srcResp.ok) {
        errors.push(`source GET p${p}: HTTP ${srcResp.status} ${await srcResp.text()}`);
        break;
      }
      const rows: any[] = await srcResp.json();
      if (!rows.length) {
        hasMore = false;
        break;
      }
      pages++;

      if (!dryRun) {
        const dstUrl = new URL(`${DST_URL}/rest/v1/${table}`);
        const headers: Record<string, string> = {
          apikey: DST_KEY,
          Authorization: `Bearer ${DST_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        };
        if (onConflict) {
          dstUrl.searchParams.set("on_conflict", onConflict);
          headers["Prefer"] = "resolution=merge-duplicates,return=minimal";
        }
        const dstResp = await fetch(dstUrl.toString(), {
          method: "POST",
          headers,
          body: JSON.stringify(rows),
        });
        if (!dstResp.ok) {
          const txt = await dstResp.text();
          errors.push(`dest POST p${p}: HTTP ${dstResp.status} ${txt.slice(0, 400)}`);
          // stop on first hard error to avoid silent partial migration
          break;
        }
      }

      migrated += rows.length;
      cursor = rows[rows.length - 1][pk];

      if (rows.length < pageSize) {
        hasMore = false;
        break;
      }
      hasMore = true;
    }

    return json({
      table,
      migrated,
      pages,
      nextCursor: cursor,
      hasMore,
      dryRun,
      ms: Date.now() - startedAt,
      errors,
    });
  } catch (e) {
    return json({ table, migrated, pages, nextCursor: cursor, error: (e as Error).message, errors }, 500);
  }
});
