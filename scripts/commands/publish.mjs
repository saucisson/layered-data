#!/usr/bin/env node
// CLI subcommand: `node scripts/cli.mjs publish <layer-name>`
// (issue #164, ADR-0025). Calls the server's publish route
// (POST /api/layers/:name/publish, issue #146) — requires a personal
// account access code (LD_ACCESS_CODE).
//
// Exit codes: 0 published, 1 refused (403/404), 2 protocol failure.

import { API_TOKEN } from "../../server/config.ts";

const BASE_URL = process.env.LD_BASE_URL ?? "http://127.0.0.1:8791";

export function run({ args }) {
  const name = args[0];
  if (!name) {
    console.error("Usage: node scripts/cli.mjs publish <layer-name>");
    return 2;
  }
  const accessCode = process.env.LD_ACCESS_CODE ?? API_TOKEN;
  void (async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/layers/${encodeURIComponent(name)}/publish`, {
        method: "POST",
        headers: { "x-access-code": accessCode },
      });
      const body = await response.json();
      if (response.status === 200) {
        console.log(`published ${body.name} (visibility: ${body.visibility})`);
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
