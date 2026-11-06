// The .ld linter CLI: the same kernel the workshop runs, answering
// in JSON. The extension (extension.js) spawns it and maps the
// entries to VS Code diagnostics; the harness (tests/vscode-checks.mts)
// pins the contract on real corpora, clean and broken.
//
//     node vscode/linter.mts --root <repo> [--language fr] [--kernel <src>]
//
// --kernel points at the kernel sources (the repo's src/): the default
// is the src/ next to this script, which only exists in a repo checkout
// — an extension installed as a .vsix passes the workspace's src/.
//
// Three passes, all reusing the kernel — nothing is re-derived here:
//   - syntax, per file (parseLanguage): every .ld under formalisms/,
//     line-precise (the parser's messages carry their line);
//   - assembly (assembleLayeredDataKernel): the kernel corpus alone —
//     the app assembles exactly those layers, in that order;
//   - verdicts (validation): the refused-assembly facts (surcharge
//     implicite, déclaration fantôme, attendu trahi…), each mapped
//     to its layer's file — a betrayed expect points at its line.
//
// Output: one JSON object on stdout — { version, language,
// diagnostics: [{ file, line, severity, message, code }] }, file
// paths relative to the root, forward slashes. Exit 0 whether or
// not the corpus is clean (diagnostics are data); exit 1 on crash.
// Needs Node with native type stripping (22.18+), like the repo's
// own harnesses.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

import type { Language } from "../src/domain/messages.ts";

// ---- the arguments ---------------------------------------------------

const arguments_ = process.argv.slice(2);
const optionValue = ({ name }: { name: string }): string | undefined => {
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
};
const rootDirectory = optionValue({ name: "--root" }) ?? ".";
const language: Language = optionValue({ name: "--language" }) === "en" ? "en" : "fr";
const kernelDirectory = optionValue({ name: "--kernel" }) ?? join(import.meta.dirname, "..", "src");

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
      "layered-data linter: noyau introuvable (" + kernelDirectory + "/" + modulePath + ") — " +
        "passez --kernel <dossier src du dépôt> : " + String((error as Error).message),
    );
    process.exit(1);
  }
};

const { parseLanguage } = await kernelModule<typeof import("../src/domain/language/parser.ts")>("domain/language/parser.ts");
const { renderMessage } = await kernelModule<typeof import("../src/domain/messages.ts")>("domain/messages.ts");
const { assembleLayeredDataKernel, KERNEL_LAYER_NAMES } = await kernelModule<typeof import("../src/application/corpus.ts")>(
  "application/corpus.ts",
);

// ---- the ledger ------------------------------------------------------

interface LintEntry {
  file: string;
  line: number;
  severity: "error";
  message: string;
  code: string;
}

const diagnostics: LintEntry[] = [];
const relativeFileOf = ({ file }: { file: string }): string => relative(rootDirectory, file).split(sep).join("/");

// ---- pass 1: syntax, every .ld under formalisms/ ---------------------

const formalismsDirectory = join(rootDirectory, "formalisms");
const layerFiles = readdirSync(formalismsDirectory, { recursive: true })
  .filter((entry) => String(entry).endsWith(".ld"))
  .map((entry) => join(formalismsDirectory, String(entry)));

const lineOfMessage = ({ message }: { message: string }): number => {
  const match = /l\.(\d+)/.exec(message);
  return match === null ? 1 : Number(match[1]);
};

let kernelSyntaxErrors = 0;
for (const file of layerFiles) {
  const source = readFileSync(file, "utf8");
  let errors: string[] = [];
  try {
    errors = parseLanguage(source, language).errors;
  } catch (error) {
    errors = [String((error as Error).message)];
  }
  for (const error of errors) {
    diagnostics.push({ file: relativeFileOf({ file }), line: lineOfMessage({ message: error }), severity: "error", message: error, code: "syntaxe" });
    if (relativeFileOf({ file }).startsWith("formalisms/kernel/")) kernelSyntaxErrors++;
  }
}

// ---- pass 2 and 3: the kernel assembly and its verdicts --------------

const layerFile = new Map<string, string>();
for (const layerName of KERNEL_LAYER_NAMES) {
  layerFile.set(layerName, "formalisms/kernel/" + layerName + ".ld");
}

const layerSources: Record<string, string> = {};
for (const layerName of KERNEL_LAYER_NAMES) {
  try {
    layerSources[layerName] = readFileSync(join(rootDirectory, "formalisms", "kernel", layerName + ".ld"), "utf8");
  } catch {
    diagnostics.push({
      file: layerFile.get(layerName) ?? "formalisms/kernel",
      line: 1,
      severity: "error",
      message: "couche du socle absente du dossier noyau : " + layerName,
      code: "assemblage",
    });
  }
}

if (kernelSyntaxErrors === 0) {
  try {
    const kernel = assembleLayeredDataKernel({ layerSources });
    for (const verdict of kernel.validation.verdicts) {
      const parameters = verdict.fact.params ?? {};
      // The layer of a verdict: the structured params carry it —
      // params.layer, or an address ("layer::path" or "layer/path")
      // inside params.where — else the first value naming a layer.
      let layer: string | null = null;
      if (typeof parameters.layer === "string" && layerFile.has(parameters.layer)) layer = parameters.layer;
      if (layer === null) {
        for (const value of Object.values(parameters)) {
          if (typeof value !== "string") continue;
          const head = value.split("/")[0].split("::")[0];
          if (layerFile.has(head)) {
            layer = head;
            break;
          }
        }
      }
      let file = layer === null ? "formalisms/kernel/check-registry.ld" : layerFile.get(layer) ?? "formalisms/kernel/check-registry.ld";
      let line = 1;
      // A betrayed expect points at its own line — the source wrote
      // "expect <address>", the verdict carries that address.
      if (verdict.kind === "attendu-trahi" && layer !== null && typeof parameters.address === "string") {
        const source = layerSources[layer] ?? "";
        const expectPrefix = "expect " + parameters.address;
        const found = source.split("\n").findIndex((sourceLine) => sourceLine.trim().startsWith(expectPrefix));
        if (found >= 0) line = found + 1;
      }
      diagnostics.push({
        file,
        line,
        severity: "error",
        message: verdict.kind + " : " + renderMessage({ message: verdict.fact, language }),
        code: verdict.kind,
      });
    }
  } catch (error) {
    // Assembly crashes on an otherwise clean corpus: a hard fact of
    // its own, pinned on the first layer file.
    diagnostics.push({
      file: layerFile.get(KERNEL_LAYER_NAMES[0]) ?? "formalisms/kernel",
      line: 1,
      severity: "error",
      message: String((error as Error).message),
      code: "assemblage",
    });
  }
}

// ---- the answer ------------------------------------------------------

console.log(JSON.stringify({ version: 1, language, diagnostics }));
