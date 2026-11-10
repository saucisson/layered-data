// ============================================================
// Layered Data — server configuration
//
// Node does not read .env on its own; a deployment that has one
// expects it to apply. The real environment wins over the file —
// a variable already set is never overridden.
// ============================================================
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const environmentFilePath = join(import.meta.dirname, "..", ".env");
if (existsSync(environmentFilePath)) {
  for (const line of readFileSync(environmentFilePath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith("#")) continue;
    const variable = match[1] ?? "";
    const value = (match[2] ?? "").replace(/^["']|["']$/g, "");
    if (process.env[variable] === undefined) process.env[variable] = value;
  }
}

export const VERSION = "2.25.0";
export const PORT = Number(process.env.PORT ?? 8791);
export const HOST = process.env.HOST ?? "127.0.0.1";
export const API_TOKEN = process.env.API_TOKEN ?? "changez-moi";
export const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY ?? "";
export const MISTRAL_URL = process.env.MISTRAL_URL ?? "https://api.mistral.ai/v1/chat/completions";
export const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? "codestral-latest";
// The verified geologist loop: the number of proposals the staging may
// judge before the route gives up and answers 422.
export const MAX_PEN_ATTEMPTS = Math.max(1, Number(process.env.PEN_MAX_ATTEMPTS ?? 3));
// The strict arm of the loop (ADR-0100, retired as a semantics by
// ADR-0106): the geologist may no longer propose a read the refines
// order settles between incomparable sources — resolving it is
// restructuring, never signing — set PEN_STRICT_CONFLICTS=1 to arm it.
export const STRICT_CONFLICTS = process.env.PEN_STRICT_CONFLICTS === "1";
// The strict arm of the loop for the carried checks (ADR-0101): the
// geologist may no longer propose a layer whose checks refuse it — set
// PEN_STRICT_CHECKS=1 to arm it.
export const STRICT_CHECKS = process.env.PEN_STRICT_CHECKS === "1";

// ------------------------------------------------------------
// The quarry on disk
//
// The corpus lives in two folders: the kernel (read-only, the
// stratigraphic column of the workshop) and the users (the layers
// written by visitors). The users folder is created at startup so
// the quarry exists even on a fresh clone.
// ------------------------------------------------------------
export const KERNEL_DIRECTORY = join(import.meta.dirname, "..", "formalisms", "kernel");
// LD_USERS_DIRECTORY / LD_DATA_DIRECTORY let the HTTP harness run
// against throwaway directories instead of the real quarry.
export const USERS_DIRECTORY =
  process.env.LD_USERS_DIRECTORY ?? join(import.meta.dirname, "..", "formalisms", "users");
export const DIST_DIRECTORY = join(import.meta.dirname, "..", "dist");
// The persisted state of the shared editor session (ADR-0110) —
// runtime data, never committed (data/ is gitignored).
export const DATA_DIRECTORY =
  process.env.LD_DATA_DIRECTORY ?? join(import.meta.dirname, "..", "data");
export const EDITOR_SESSION_FILE = join(DATA_DIRECTORY, "editor-session.json");
mkdirSync(USERS_DIRECTORY, { recursive: true });
mkdirSync(DATA_DIRECTORY, { recursive: true });

export { environmentFilePath };
