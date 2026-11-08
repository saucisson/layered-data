// The `serve` subcommand: two processes, one command —
// the wardrobe API (server.ts, 127.0.0.1:8791) and the Vite dev
// server (hot reload on http://localhost:5173, /api proxied to the
// wardrobe by vite.config.ts). No new dependency: both children are
// spawned with the running Node and the local vite bin. The former
// static-only behavior stays available as `npm run serve:prod`.
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Spawn one child, prefixing every output line with its tag. */
function start({ tag, args }) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: ["inherit", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) console.log(tag + line);
    });
    stream.on("end", () => {
      if (buffer) console.log(tag + buffer);
    });
  }
  return child;
}

/** Entry point of the `serve` subcommand (ADR-0025). */
export function run() {
  const armoire = start({ tag: "[armoire] ", args: [join(root, "server.ts")] });
  const vite = start({ tag: "[vite]    ", args: [join(root, "node_modules", "vite", "bin", "vite.js")] });

  let stopping = false;

  function stopAll({ reason, exitCode }) {
    if (stopping) return;
    stopping = true;
    console.log("serve: " + reason);
    armoire.kill("SIGTERM");
    vite.kill("SIGTERM");
    process.exit(exitCode);
  }

  process.on("SIGINT", () => stopAll({ reason: "SIGINT reçu — arrêt de l'armoire et de vite", exitCode: 0 }));
  process.on("SIGTERM", () => stopAll({ reason: "SIGTERM reçu — arrêt de l'armoire et de vite", exitCode: 0 }));

  armoire.on("exit", (code, signal) => stopAll({ reason: "l'armoire s'est arrêtée (code " + code + (signal ? ", " + signal : "") + ") — arrêt de vite", exitCode: code ?? 1 }));
  vite.on("exit", (code, signal) => stopAll({ reason: "vite s'est arrêté (code " + code + (signal ? ", " + signal : "") + ") — arrêt de l'armoire", exitCode: code ?? 1 }));
}
