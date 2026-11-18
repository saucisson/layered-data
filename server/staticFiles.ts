// ============================================================
// Layered Data — static file resolution: MIME table, cache
// policy, SPA fallback. Pure (the checks import it), the routes
// only read its verdict. Site review #292–#295.
// ============================================================
import { existsSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

/** The MIME table — the extensions the build and public/ can emit.
 * Unknown extensions fall back to octet-stream (with nosniff, the
 * safe default). #294 */
export const MIME_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".vsix": "application/octet-stream",
};

export type StaticResolution =
  | { kind: "file"; filePath: string }
  | { kind: "not-found" }
  | { kind: "no-dist" };

/** Resolve a request path against the built dist/. The SPA fallback
 * (index.html) applies ONLY to extensionless navigation paths — a
 * missing asset, robots.txt or sitemap.xml is a real 404 (#293).
 * The resolved path is contained inside dist/ (no traversal). */
export function resolveStaticFile({
  distDirectory,
  pathname,
}: {
  distDirectory: string;
  pathname: string;
}): StaticResolution {
  if (!existsSync(distDirectory)) return { kind: "no-dist" };
  const root = resolve(distDirectory);
  const requestedPath = pathname === "/" ? "index.html" : pathname;
  const candidate = resolve(root, "." + requestedPath);
  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return { kind: "not-found" };
  }
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return { kind: "file", filePath: candidate };
  }
  if (extname(requestedPath) === "") {
    const fallback = join(root, "index.html");
    if (existsSync(fallback)) return { kind: "file", filePath: fallback };
  }
  return { kind: "not-found" };
}

/** Cache policy (#295): the hashed build output under assets/ is
 * immutable for a year; everything else (index.html, logos,
 * locales) is revalidated on every visit. */
export function cacheControlOf({
  distDirectory,
  filePath,
}: {
  distDirectory: string;
  filePath: string;
}): string {
  const inside = relative(resolve(distDirectory), resolve(filePath));
  return inside.startsWith("assets" + sep)
    ? "public, max-age=31536000, immutable"
    : "no-cache";
}
