// ============================================================
// Layered Data — rate limiting (issue #85)
//
// Fixed-window counters per client key. The server is meant to run
// as several instances behind a proxy, so the counters live in
// PostgreSQL (see createPostgresRateLimitStore) — never in process
// memory. The store is an interface so the window logic is testable
// without a database.
// ============================================================
import type { IncomingMessage } from "node:http";

/** A counter store: one row per (key, window), incremented atomically. */
export type RateLimitStore = {
  /** Increment the counter of (key, windowStart) and return the new count. */
  increment({ key, windowStart }: { key: string; windowStart: number }): Promise<number>;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** The pure decision for a counter value — separated from the clock
 * and the store so the window logic is testable without either. */
export function decideOnCount({
  count,
  maxRequests,
  windowStart,
  nowSeconds,
  windowSeconds,
}: {
  count: number;
  maxRequests: number;
  windowStart: number;
  nowSeconds: number;
  windowSeconds: number;
}): RateLimitDecision {
  const allowed = count <= maxRequests;
  return {
    allowed,
    remaining: Math.max(0, maxRequests - count),
    retryAfterSeconds: allowed ? 0 : windowStart + windowSeconds - nowSeconds,
  };
}

/** The fixed-window limiter: at most maxRequests per windowSeconds
 * per key. */
export function createRateLimiter({
  store,
  maxRequests,
  windowSeconds,
}: {
  store: RateLimitStore;
  maxRequests: number;
  windowSeconds: number;
}): (key: string) => Promise<RateLimitDecision> {
  return async (key: string) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds;
    const count = await store.increment({ key, windowStart });
    return decideOnCount({ count, maxRequests, windowStart, nowSeconds, windowSeconds });
  };
}

/** The client key: the first X-Forwarded-For address when a proxy
 * chain is present, otherwise the socket address. */
export function clientKeyOf({ request }: { request: IncomingMessage }): string {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim() !== "") {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.socket.remoteAddress ?? "unknown";
}

/** The PostgreSQL store: one table, upserted atomically so several
 * server instances share the counters safely. */
export async function createPostgresRateLimitStore({
  databaseUrl,
}: {
  databaseUrl: string;
}): Promise<RateLimitStore> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limit (
      key TEXT NOT NULL,
      window_start BIGINT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (key, window_start)
    )
  `);
  return {
    async increment({ key, windowStart }) {
      const result = await pool.query(
        `INSERT INTO rate_limit (key, window_start, count)
         VALUES ($1, $2, 1)
         ON CONFLICT (key, window_start)
         DO UPDATE SET count = rate_limit.count + 1
         RETURNING count`,
        [key, windowStart],
      );
      const rows = result.rows as { count: number }[];
      return rows[0]?.count ?? 1;
    },
  };
}
