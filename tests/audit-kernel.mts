// The kernel audit harness.
//
// The kernel behavior is a contract: every observable read over the
// whole bedrock corpus, dumped deterministically and compared bit by
// bit against tests/baseline-kernel.txt. The baseline was captured
// before the refactoring; any difference is a regression. Run from
// the repository root:
//
//     npm test
//     node tests/audit-kernel.mts > /tmp/dump.txt
//     diff tests/baseline-kernel.txt /tmp/dump.txt

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assembleLayeredDataKernel, KERNEL_LAYER_NAMES } from "../src/application/corpus.ts";
import { MESSAGE_LANGUAGES, renderMessage, type Language } from "../src/domain/messages.ts";
import { AddressView, LayerReference, PathReference, type Address } from "../src/domain/addresses.ts";
import { SPECIAL_KEYS } from "../src/domain/specialKeys.ts";
import { walkAddresses } from "../src/domain/views.ts";

// ---- corpus loading under Node: one fs read per layer file ----
const corpusDirectory = join(import.meta.dirname, "..", "formalisms", "kernel");
const layerSources = Object.fromEntries(
  KERNEL_LAYER_NAMES.map((layerName) => [
    layerName,
    readFileSync(join(corpusDirectory, layerName + ".ld"), "utf8"),
  ]),
);
const kernel = assembleLayeredDataKernel({ layerSources });

// ---- canonical serializer: value shapes only, no addresses of
// opportunity, insertion order preserved (it is observable too) ----
function dumpRepresentation(value: any): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value instanceof AddressView) {
    return "@" + value.layer + (value.path.length ? "/" + value.path.join("/") : "");
  }
  if (value instanceof LayerReference) return "@L:" + value.layer;
  if (value instanceof PathReference) {
    return "@R:" + value.anchor + (value.path.length ? "/" + value.path.join("/") : "");
  }
  if (Array.isArray(value)) return "[" + value.map(dumpRepresentation).join(", ") + "]";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return "{" + keys.map((key: string) => JSON.stringify(key) + ": " + dumpRepresentation(value[key])).join(", ") + "}";
  }
  return String(value);
}

function addressRepresentation(address: Address): string {
  return address[0] + (address[1].length ? "/" + address[1].join("/") : "");
}

function readObservation(layer: string, path: any[], key: string): any {
  try {
    return kernel.space.read({ layer: layer as any, path, key });
  } catch (error) {
    return "THROW:" + String(error);
  }
}

// ---- the dump itself: every observable read, deterministically,
// once per language — the kernel facts render in English and in
// French; the French half must stay byte-identical to the historic
// monolingual baseline ----
function dumpOf(language: Language): string[] {
  const dumpLines: string[] = [];
  dumpLines.push("stats " + JSON.stringify(kernel.validation.stats));
  dumpLines.push("verdicts " + kernel.validation.verdicts.length);
  for (const verdict of kernel.validation.verdicts) {
    dumpLines.push(
      "verdict " + verdict.kind + " :: " + renderMessage({ message: verdict.fact, language }),
    );
  }
  dumpLines.push("diag " + kernel.space.diagnostics.length);
  for (const diagnostic of kernel.space.diagnostics) {
    dumpLines.push(
      "diag " + diagnostic.kind + " :: " + addressRepresentation(diagnostic.address) + " :: " +
        renderMessage({ message: diagnostic.fact, language }),
    );
  }

  for (const layerName of kernel.layerNames) {
    dumpLines.push("LAYER " + layerName);
    dumpLines.push(
      "closure @ => " + kernel.space.closure({ layer: layerName, path: [] }).map(addressRepresentation).join(" "),
    );
    for (const [addressLayer, addressPath] of walkAddresses({ space: kernel.space, layer: layerName })) {
      const where = addressRepresentation([addressLayer, addressPath]);
      dumpLines.push(
        "closure " + where + " => " +
          kernel.space.closure({ layer: addressLayer, path: addressPath }).map(addressRepresentation).join(" "),
      );
      const visibleKeys = kernel.space.keys({ layer: addressLayer, path: addressPath });
      dumpLines.push("keys " + where + " => " + visibleKeys.join(" "));
      for (const key of visibleKeys) {
        dumpLines.push("read " + where + " :: " + key + " => " + dumpRepresentation(readObservation(addressLayer, addressPath, key)));
      }
      for (const specialKey of SPECIAL_KEYS) {
        if (specialKey === "note" || specialKey === "tests") continue;
        dumpLines.push(
          "special " + where + " :: " + specialKey + " => " + dumpRepresentation(readObservation(addressLayer, addressPath, specialKey)),
        );
      }
    }
  }
  return dumpLines;
}

for (const language of MESSAGE_LANGUAGES) {
  console.log("=== language " + language + " ===");
  console.log(dumpOf(language).join("\n"));
}
