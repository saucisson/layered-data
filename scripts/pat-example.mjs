#!/usr/bin/env node
// ============================================================
// Layered Data — machine access example (LD-5, milestone Auth v1)
//
// Scripts and CI do not log in through a browser: they hold a
// personal access token (PAT) of a Zitadel service user and send it
// as `Authorization: Bearer <pat>`. The server validates it by
// introspection at the IdP (POST, Basic auth with the app's API
// credentials) — never by trusting the token itself.
//
// Usage:
//   PAT=<service-user-pat> API_BASE=https://layered-data.linard.fr \
//     node scripts/pat-example.mjs
//
// The PAT comes from the owner through a secure channel — never
// committed, never in a URL.
// ============================================================

const apiBase = (process.env.API_BASE ?? "http://127.0.0.1:8791").replace(/\/+$/, "");
const pat = process.env.PAT ?? "";

if (pat === "") {
  console.error("PAT missing — export PAT=<the service user's personal access token>");
  process.exit(1);
}

const response = await fetch(apiBase + "/api/whoami", {
  headers: { Authorization: "Bearer " + pat, Accept: "application/json" },
});

if (response.status === 401) {
  console.error("401 — the PAT is refused (revoked or unknown to the IdP)");
  process.exit(1);
}
if (!response.ok) {
  console.error("HTTP " + response.status + " — " + (await response.text()));
  process.exit(1);
}
console.log("connected as machine: " + JSON.stringify(await response.json()));
