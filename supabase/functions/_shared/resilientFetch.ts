// Shared resilient HTTP client with exponential backoff + circuit breaker.
//
// - Retries on network errors and HTTP 408/425/429/5xx (configurable).
// - Honors `Retry-After` (seconds OR HTTP-date) on 429/503.
// - Per-host circuit breaker: after N consecutive failures, opens for `cooldownMs`
//   so we stop hammering an unhealthy upstream. Half-open lets one probe through.
// - Module-scoped state -> shared across calls inside the same isolate
//   (which is exactly what we want for cron-like Edge Functions).

export interface ResilientFetchOptions extends RequestInit {
  retries?: number;             // default 3
  baseDelayMs?: number;         // default 400
  maxDelayMs?: number;          // default 4000
  timeoutMs?: number;           // per-attempt timeout, default 15_000
  retryOnStatuses?: number[];   // default [408, 425, 429, 500, 502, 503, 504]
  breakerKey?: string;          // override host-derived breaker key
}

type BreakerState = 'closed' | 'open' | 'half_open';

interface BreakerEntry {
  state: BreakerState;
  failures: number;
  openedAt: number;
}

const FAILURE_THRESHOLD = 5;       // consecutive failures before opening
const COOLDOWN_MS = 30_000;        // open duration before half-open probe
const breakers = new Map<string, BreakerEntry>();

function getBreakerKey(url: string, override?: string): string {
  if (override) return override;
  try { return new URL(url).host; } catch { return url; }
}

function getBreaker(key: string): BreakerEntry {
  let b = breakers.get(key);
  if (!b) {
    b = { state: 'closed', failures: 0, openedAt: 0 };
    breakers.set(key, b);
  }
  return b;
}

function checkBreaker(key: string) {
  const b = getBreaker(key);
  if (b.state === 'open') {
    if (Date.now() - b.openedAt >= COOLDOWN_MS) {
      b.state = 'half_open';
    } else {
      const err = new Error(`circuit_open:${key}`);
      (err as any).code = 'CIRCUIT_OPEN';
      throw err;
    }
  }
}

function recordSuccess(key: string) {
  const b = getBreaker(key);
  b.state = 'closed';
  b.failures = 0;
  b.openedAt = 0;
}

function recordFailure(key: string) {
  const b = getBreaker(key);
  b.failures += 1;
  if (b.state === 'half_open' || b.failures >= FAILURE_THRESHOLD) {
    b.state = 'open';
    b.openedAt = Date.now();
    console.warn(`[resilientFetch] 🔌 circuit OPEN for "${key}" after ${b.failures} failures`);
  }
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const asInt = Number(header);
  if (Number.isFinite(asInt)) return Math.max(0, asInt * 1000);
  const asDate = Date.parse(header);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

function backoff(attempt: number, base: number, max: number): number {
  const exp = Math.min(max, base * Math.pow(2, attempt));
  // Full jitter: random in [0, exp]
  return Math.floor(Math.random() * exp);
}

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];

export async function resilientFetch(
  url: string,
  init: ResilientFetchOptions = {},
): Promise<Response> {
  const {
    retries = 3,
    baseDelayMs = 400,
    maxDelayMs = 4000,
    timeoutMs = 15_000,
    retryOnStatuses = DEFAULT_RETRY_STATUSES,
    breakerKey,
    ...fetchInit
  } = init;

  const key = getBreakerKey(url, breakerKey);
  checkBreaker(key);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...fetchInit, signal: ctrl.signal });
      clearTimeout(t);

      if (retryOnStatuses.includes(res.status) && attempt < retries) {
        const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
        const wait = retryAfter ?? backoff(attempt, baseDelayMs, maxDelayMs);
        console.warn(`[resilientFetch] ${res.status} on ${key} — retry ${attempt + 1}/${retries} in ${wait}ms`);
        // Drain body to free the connection
        try { await res.arrayBuffer(); } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      // Any non-retried response counts as breaker success (even 4xx — the upstream is up)
      recordSuccess(key);
      return res;
    } catch (err) {
      clearTimeout(t);
      lastError = err;
      if ((err as any)?.code === 'CIRCUIT_OPEN') throw err;
      if (attempt < retries) {
        const wait = backoff(attempt, baseDelayMs, maxDelayMs);
        console.warn(`[resilientFetch] network err on ${key} — retry ${attempt + 1}/${retries} in ${wait}ms:`, (err as Error)?.message);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
    }
  }

  recordFailure(key);
  throw lastError instanceof Error
    ? lastError
    : new Error(`resilientFetch failed after retries: ${String(lastError)}`);
}

export function getCircuitState(key: string): BreakerEntry {
  return getBreaker(key);
}
