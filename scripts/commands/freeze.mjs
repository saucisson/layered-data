#!/usr/bin/env node
// CLI subcommand: `node scripts/cli.mjs freeze <formalism-name>`
// (issue #164, ADR-0025). Calls the server's freeze route
// (POST /api/formalisms/:id/freeze, issue #155) authenticated with a
// personal access token (LD_PAT, Bearer, milestone Auth v1) or a
// personal access code (LD_ACCESS_CODE, x-access-code).
//
// Exit codes: 0 frozen, 1 refused (404/409/403), 2 protocol failure.

import { DATABASE_URL } from "../../server/config.ts";

const BASE_URL = process.env.LD_BASE_URL ?? "http://127.0.0.1:8791";

export function run({ args }) {
  const name = args[0];
  if (!name) {
    console.error("Usage: node scripts/cli.mjs freeze <formalism-name>");
    return 2;
  }
  const pat = process.env.LD_PAT ?? "";
  const accessCode = process.env.LD_ACCESS_CODE ?? "";
  if (pat === "" && accessCode === "") {
    console.error("LD_PAT (or LD_ACCESS_CODE) absent — exportez un PAT du service user");
    return 2;
  }
  const headers = pat !== "" ? { Authorization: "Bearer " + pat } : { "x-access-code": accessCode };
  void (async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/formalisms/${encodeURIComponent(name)}/freeze`, {
        method: "POST",
        headers,
      });
      const body = await response.json();
      if (response.status === 201) {
        console.log(`frozen ${body.name}@${body.semver}${body.published ? " (published)" : ""}`);
        process.exit(0);
      }
      console.error(`refused (${response.status}): ${body.erreur ?? JSON.stringify(body)}`);
      process.exit(1);
    } catch (error) {
      console.error("protocol failure: " + String(error?.message ?? error));
      process.exit(2);
    }
  })();
}
