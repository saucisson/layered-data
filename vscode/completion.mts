// The .ld completion CLI: the same kernel the workshop runs, answering
// in JSON. The extension (extension.js) spawns it with the document
// text on stdin — unsaved keystrokes included — and the cursor
// position as arguments; the harness (tests/vscode-checks.mts) pins
// the contract on real shapes.
//
//     node vscode/completion.mts --root <repo> --line <n> --character <c> [--language fr] [--kernel <src>] < source.ld
//
// --kernel points at the kernel sources (the repo's src/): the default
// is the src/ next to this script, which only exists in a repo
// checkout — an extension installed as a .vsix passes the workspace's
// src/. The kernel corpus under formalisms/kernel/ is assembled to
// give the space the path completions read; a corpus that does not
// assemble degrades to acts and layer names (completion never fails
// on a broken draft — the linter is the one that reports).
//
// Output: one JSON object on stdout — { version, language,
// completions: [{ label, kind, detail }] }, kind in act|layer|key.
// Exit 0 whether or not anything is suggested (completions are data);
// exit 1 on crash. Needs Node with native type stripping (22.18+),
// like the repo's own harnesses.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Language } from "../src/domain/messages.ts";
import type { Space } from "../src/domain/space.ts";

// ---- the arguments ---------------------------------------------------

const arguments_ = process.argv.slice(2);
const optionValue = ({ name }: { name: string }): string | undefined => {
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
};
const rootDirectory = optionValue({ name: "--root" }) ?? ".";
const language: Language = optionValue({ name: "--language" }) === "en" ? "en" : "fr";
const kernelDirectory = optionValue({ name: "--kernel" }) ?? join(import.meta.dirname, "..", "src");
const line = Number(optionValue({ name: "--line" }) ?? "1");
const character = Number(optionValue({ name: "--character" }) ?? "0");

// ---- the edited document, on stdin ------------------------------------

const readStdin = async (): Promise<string> => {
  let source = "";
  for await (const chunk of process.stdin) source += chunk;
  return source;
};
const source = await readStdin();

// ---- the kernel, loaded from the kernel directory --------------------
// Dynamic imports on purpose: installed as a .vsix, the extension lives
// outside the repo, so the kernel cannot be a static ../src import —
// it is addressed by --kernel (the extension passes the workspace's
// src/), defaulting to the repo's own src/ in a checkout.

const kernelModule = async <T>(modulePath: string): Promise<T> => {
  try {
    return (await import(pathToFileURL(join(kernelDirectory, modulePath)).href)) as T;
  } catch (error) {
    console.error(
      "layered-data completion: noyau introuvable (" + kernelDirectory + "/" + modulePath + ") — " +
        "passez --kernel <dossier src du dépôt> : " + String((error as Error).message),
    );
    process.exit(1);
  }
};

const { completeLanguage } = await kernelModule<typeof import("../src/domain/language/completion.ts")>(
  "domain/language/completion.ts",
);
const { assembleLayeredDataKernel, KERNEL_LAYER_NAMES } = await kernelModule<typeof import("../src/application/corpus.ts")>(
  "application/corpus.ts",
);

// ---- the space: the kernel corpus, when it assembles ------------------

const layerSources: Record<string, string> = {};
for (const layerName of KERNEL_LAYER_NAMES) {
  try {
    layerSources[layerName] = readFileSync(join(rootDirectory, "formalisms", "kernel", layerName + ".ld"), "utf8");
  } catch {
    // A missing kernel layer degrades the space, it does not crash
    // the completion — the linter reports it.
  }
}

let space: Space | null = null;
try {
  space = assembleLayeredDataKernel({ layerSources }).space;
} catch {
  space = null;
}

// ---- the answer ------------------------------------------------------

const completions = completeLanguage({
  source,
  line,
  character,
  space,
  layerNames: KERNEL_LAYER_NAMES,
  language,
});

console.log(JSON.stringify({ version: 1, language, completions }));
