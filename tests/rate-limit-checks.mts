// The rate-limit checks (issue #85): fixed-window counters per client
// key, decided by a pure function (decideOnCount) so the window logic
// is pinned without a clock or a database, and exercised end-to-end
// through createRateLimiter with a fake store. The PostgreSQL store
// itself is a thin upsert — no live database is available in this
// environment, which the PR states honestly.
//
//     node tests/rate-limit-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  clientKeyOf,
  createRateLimiter,
  decideOnCount,
  type RateLimitStore,
} from "../server/rateLimit.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the pure window decision ---------------------------------------

const WINDOW = 60;
const MAX = 3;
// window [120, 180), now = 150
check(
  "count within the limit is allowed with the remaining count",
  decideOnCount({ count: 2, maxRequests: MAX, windowStart: 120, nowSeconds: 150, windowSeconds: WINDOW }).allowed &&
    decideOnCount({ count: 2, maxRequests: MAX, windowStart: 120, nowSeconds: 150, windowSeconds: WINDOW }).remaining === 1,
);
const atLimit = decideOnCount({ count: MAX, maxRequests: MAX, windowStart: 120, nowSeconds: 150, windowSeconds: WINDOW });
check("count at the limit is still allowed", atLimit.allowed && atLimit.remaining === 0);
const over = decideOnCount({ count: MAX + 1, maxRequests: MAX, windowStart: 120, nowSeconds: 150, windowSeconds: WINDOW });
check("count over the limit is denied", !over.allowed && over.remaining === 0);
check("retryAfter counts down to the end of the window", over.retryAfterSeconds === 30);
const nextWindow = decideOnCount({ count: 1, maxRequests: MAX, windowStart: 180, nowSeconds: 181, windowSeconds: WINDOW });
check("a new window resets the counter", nextWindow.allowed && nextWindow.remaining === MAX - 1);

// ---- the limiter over a fake store -----------------------------------

const counters = new Map<string, number>();
const fakeStore: RateLimitStore = {
  async increment({ key, windowStart }) {
    const id = key + "@" + windowStart;
    const next = (counters.get(id) ?? 0) + 1;
    counters.set(id, next);
    return next;
  },
};
const limiter = createRateLimiter({ store: fakeStore, maxRequests: 2, windowSeconds: 3600 });
check("first request allowed", (await limiter("client-a")).allowed);
check("second request allowed", (await limiter("client-a")).allowed);
const third = await limiter("client-a");
check("third request in the same window denied", !third.allowed && third.retryAfterSeconds > 0);
check("another client has its own counter", (await limiter("client-b")).allowed);

// ---- the client key ---------------------------------------------------

check(
  "X-Forwarded-For wins, first address of the chain",
  clientKeyOf({ request: { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } } as never }) ===
    "203.0.113.7",
);
check(
  "without the header the socket address is the key",
  clientKeyOf({ request: { headers: {}, socket: { remoteAddress: "127.0.0.1" } } as never }) === "127.0.0.1",
);

// ---- the wiring --------------------------------------------------------

const rootDirectory = join(import.meta.dirname, "..");
const routesSource = readFileSync(join(rootDirectory, "server/routes.ts"), "utf8");
const packageSource = readFileSync(join(rootDirectory, "package.json"), "utf8");
check("routes.ts rate-limits POST /api before auth", /request\.method === "POST"\)\s*\{[\s\S]*429/.test(routesSource));
check("the 429 carries a Retry-After header", routesSource.includes('response.setHeader("Retry-After"'));
check("without DATABASE_URL the limiters are disabled", routesSource.includes("if (!DATABASE_URL) return { generate: null, post: null }"));
check("pg is a declared dependency", packageSource.includes('"pg":'));
check("package.json runs this harness", packageSource.includes("test:rate-limit"));

// ---- report ----------------------------------------------------------

console.log(`rate-limit checks: ${assertions - failures.length}/${assertions} passed, ${failures.length} failed`);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
