/**
 * migrate-storage-to-mirror
 *
 * Copia objetos de um bucket do projeto origem (Lovable Cloud) para o mesmo
 * bucket no projeto Supabase espelho. Cria o bucket no destino se faltar.
 *
 * Body:
 *   {
 *     bucket: string,
 *     public?: boolean,          // usado só na criação do bucket no destino (default: igual a origem se conhecido, senão false)
 *     prefix?: string,           // listar somente esse prefixo
 *     cursor?: string,           // último "name" processado (paginação)
 *     pageSize?: number,         // default 100 (max 1000)
 *     maxObjects?: number,       // cap por chamada (default 80) p/ caber em 60s
 *     overwrite?: boolean,       // default true (upsert)
 *     dryRun?: boolean,
 *   }
 *
 * Header: X-Migration-Token
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
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });

async function ensureBucket(bucket: string, isPublic: boolean) {
  // GET bucket; create if missing
  const r = await fetch(`${DST_URL}/storage/v1/bucket/${bucket}`, {
    headers: { apikey: DST_KEY, Authorization: `Bearer ${DST_KEY}` },
  });
  if (r.ok) return { created: false };
  const c = await fetch(`${DST_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { apikey: DST_KEY, Authorization: `Bearer ${DST_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ id: bucket, name: bucket, public: isPublic }),
  });
  if (!c.ok) throw new Error(`create bucket failed: HTTP ${c.status} ${await c.text()}`);
  return { created: true };
}

async function listObjects(bucket: string, prefix: string, cursor: string | null, limit: number): Promise<any[]> {
  // POST /object/list/{bucket}
  const r = await fetch(`${SRC_URL}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { apikey: SRC_KEY, Authorization: `Bearer ${SRC_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      prefix: prefix ?? "",
      limit,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
      ...(cursor ? { search: undefined } : {}),
    }),
  });
  if (!r.ok) throw new Error(`list failed: HTTP ${r.status} ${await r.text()}`);
  return await r.json();
}

// Recursive walk: storage list returns folders as entries without metadata
async function walk(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [prefix];
  while (stack.length) {
    const p = stack.pop()!;
    let offset = 0;
    while (true) {
      const r = await fetch(`${SRC_URL}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: { apikey: SRC_KEY, Authorization: `Bearer ${SRC_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({ prefix: p, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
      });
      if (!r.ok) throw new Error(`list ${p}: HTTP ${r.status} ${await r.text()}`);
      const items: any[] = await r.json();
      if (!items.length) break;
      for (const it of items) {
        const full = p ? `${p}${p.endsWith("/") ? "" : "/"}${it.name}` : it.name;
        if (it.id === null || it.metadata === null) {
          // folder
          stack.push(full);
        } else {
          out.push(full);
        }
      }
      if (items.length < 1000) break;
      offset += items.length;
    }
  }
  return out.sort();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if ((req.headers.get("x-migration-token") ?? "") !== MIGRATION_TOKEN || !MIGRATION_TOKEN) {
    return json({ error: "forbidden" }, 403);
  }
  const body = await req.json().catch(() => ({}));
  const bucket: string = body.bucket;
  if (!bucket) return json({ error: "bucket required" }, 400);
  const isPublic: boolean = body.public ?? false;
  const prefix: string = body.prefix ?? "";
  const cursor: string | null = body.cursor ?? null;
  const maxObjects: number = Math.min(Math.max(body.maxObjects ?? 80, 1), 500);
  const overwrite: boolean = body.overwrite !== false;
  const dryRun: boolean = body.dryRun === true;

  const startedAt = Date.now();
  const errors: string[] = [];
  let copied = 0;
  let skipped = 0;
  let lastKey: string | null = cursor;
  let hasMore = false;

  try {
    const bk = await ensureBucket(bucket, isPublic);
    const all = await walk(bucket, prefix);
    // start after cursor
    const startIdx = cursor ? all.findIndex((k) => k > cursor) : 0;
    const slice = startIdx === -1 ? [] : all.slice(startIdx);

    for (let i = 0; i < slice.length; i++) {
      if (Date.now() - startedAt > 50_000 || copied + skipped >= maxObjects) {
        hasMore = i < slice.length;
        break;
      }
      const key = slice[i];
      lastKey = key;
      if (dryRun) {
        skipped++;
        continue;
      }
      // download from source
      const dl = await fetch(`${SRC_URL}/storage/v1/object/${bucket}/${encodeURI(key)}`, {
        headers: { apikey: SRC_KEY, Authorization: `Bearer ${SRC_KEY}` },
      });
      if (!dl.ok) {
        errors.push(`download ${key}: HTTP ${dl.status}`);
        continue;
      }
      const ct = dl.headers.get("content-type") ?? "application/octet-stream";
      const buf = await dl.arrayBuffer();

      // upload to destination
      const up = await fetch(`${DST_URL}/storage/v1/object/${bucket}/${encodeURI(key)}`, {
        method: "POST",
        headers: {
          apikey: DST_KEY,
          Authorization: `Bearer ${DST_KEY}`,
          "content-type": ct,
          "x-upsert": overwrite ? "true" : "false",
          "cache-control": "3600",
        },
        body: buf,
      });
      if (!up.ok) {
        const t = await up.text();
        // treat duplicate-no-overwrite as skipped
        if (up.status === 409 && !overwrite) {
          skipped++;
          continue;
        }
        errors.push(`upload ${key}: HTTP ${up.status} ${t.slice(0, 200)}`);
        continue;
      }
      copied++;
    }

    return json({
      bucket,
      created: bk.created,
      total: all.length,
      copied,
      skipped,
      nextCursor: hasMore ? lastKey : null,
      hasMore,
      ms: Date.now() - startedAt,
      errors,
    });
  } catch (e) {
    return json({ bucket, copied, skipped, error: (e as Error).message, errors }, 500);
  }
});
