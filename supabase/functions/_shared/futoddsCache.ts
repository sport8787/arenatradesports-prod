// Cache em memória + dedup de requisições para endpoints Futodds.
// Mantém uma única fetch em vôo por endpoint mesmo sob bursts (request coalescing).
// TTL configurável e contador simples para auditoria/rate-limit.

const FUTODDS_BASE = "https://csv.futodds.com/functions/v1";

type CacheEntry = { ts: number; data: any };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();
const counters = new Map<string, number>();

export interface FutoddsCacheOptions {
  ttlMs?: number; // padrão 30s
  forceRefresh?: boolean;
}

export function getFutoddsStats() {
  return {
    cached_keys: Array.from(cache.keys()),
    counters: Object.fromEntries(counters),
  };
}

export async function fetchFutoddsCached(
  path: string,
  params: Record<string, string> = {},
  options: FutoddsCacheOptions = {},
): Promise<any> {
  const key = Deno.env.get("FUTODDS_API_KEY");
  if (!key) throw new Error("FUTODDS_API_KEY missing");

  const ttl = options.ttlMs ?? 30_000;
  const url = new URL(FUTODDS_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const cacheKey = url.toString();
  const now = Date.now();

  if (!options.forceRefresh) {
    const hit = cache.get(cacheKey);
    if (hit && now - hit.ts < ttl) {
      counters.set(`hit:${path}`, (counters.get(`hit:${path}`) ?? 0) + 1);
      return hit.data;
    }
  }

  // Coalesce concurrent requests for the same key
  const existing = inflight.get(cacheKey);
  if (existing) {
    counters.set(`coalesced:${path}`, (counters.get(`coalesced:${path}`) ?? 0) + 1);
    return existing;
  }

  counters.set(`miss:${path}`, (counters.get(`miss:${path}`) ?? 0) + 1);

  const promise = (async () => {
    const t0 = Date.now();
    let status = 0;
    let errMsg: string | null = null;
    let json: any = null;
    try {
      const res = await fetch(cacheKey, {
        headers: { Authorization: `Bearer ${key}`, "X-API-Key": key, Accept: "application/json" },
      });
      status = res.status;
      if (!res.ok) {
        errMsg = `futodds_http_${res.status}`;
        throw new Error(errMsg);
      }
      json = await res.json();
      cache.set(cacheKey, { ts: Date.now(), data: json });
      return json;
    } catch (e) {
      if (!errMsg) errMsg = (e as Error).message;
      throw e;
    } finally {
      // Log de saúde best-effort. Não bloqueia a resposta.
      const latency = Date.now() - t0;
      const items = Array.isArray(json) ? json.length : Array.isArray(json?.data) ? json.data.length : 0;
      logHealth({ endpoint: path, status_code: status, latency_ms: latency, ok: !errMsg, error: errMsg, items_count: items }).catch(() => {});
    }
  })().finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, promise);
  return promise;
}

async function logHealth(row: Record<string, unknown>): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const srv = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !srv) return;
    await fetch(`${url}/rest/v1/futodds_health_log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: srv,
        Authorization: `Bearer ${srv}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch { /* swallow */ }
}

/** Conveniência: lista do payload `{data: []}` da Futodds. */
export async function fetchFutoddsList(
  path: string,
  options: FutoddsCacheOptions = {},
): Promise<any[]> {
  const j = await fetchFutoddsCached(path, {}, options);
  return Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
}
