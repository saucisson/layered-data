// The expected-reads contract, replayed in the fold of the
// formalism panel (②): every expectation of the current layer is
// replayed here, against the living space — matching or betrayed,
// and where the read comes from (the provenance tells which layer
// carried it). A layer without tests shows nothing — the fold only
// speaks when the layer holds a contract.

import { useMemo, useState } from "react";
import { asLayerName, asLayerPath } from "../domain/identifiers.ts";
import { isDictionary } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import { expectationsOf, readMatchesExpectation, formatExpectation } from "../domain/validation.ts";
import { say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

/** Replay the tests contract of one layer against the living
 * space, with the provenance of each read. */
export function LayerContractTests({
  space,
  layer,
  language,
}: {
  space: Space;
  layer: string;
  language: Language;
}) {
  const [open, setOpen] = useState(false);
  const expectations = useMemo(() => expectationsOf(space.layers[layer] ?? null), [space, layer]);
  const rows = useMemo(() => {
    return expectations.map((expectation) => {
      // The kernel never throws, but the replay must stay total too:
      // a broken read is shown as a betrayed expectation, not a crash.
      let read: unknown;
      try {
        read = space.read({
          layer: asLayerName(layer),
          path: asLayerPath(expectation.path),
          key: expectation.key,
        });
      } catch {
        read = undefined;
      }
      // Provenance: the first closure layer that actually carries the
      // key is the one that "provides" the read — the UI shows it so
      // the reader sees which layer signed the contract.
      let provenance: string | null = null;
      for (const [sourceLayer, sourcePath] of space.closure({
        layer: asLayerName(layer),
        path: asLayerPath(expectation.path),
      })) {
        const node = space.raw({ layer: sourceLayer, path: sourcePath });
        if (
          isDictionary(node) &&
          Object.prototype.hasOwnProperty.call(node, expectation.key) &&
          node[expectation.key] !== null
        ) {
          provenance = sourceLayer + "::" + (sourcePath.join("/") || ".");
          break;
        }
      }
      return {
        expectation,
        read,
        provenance,
        matching: readMatchesExpectation(read, expectation.expectation),
      };
    });
  }, [expectations, space, layer]);
  if (expectations.length === 0) return null;
  const betrayed = rows.filter((row) => !row.matching).length;
  return (
    <div className="mb-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
      <button type="button"
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold text-slate-800 dark:text-slate-100"
        onClick={() => setOpen(!open)}
      >
        <span>
          {say({ language, en: "Tests", fr: "Tests" })}
          <span className="ml-1 font-normal text-slate-600">
            {expectations.length}{" "}
            {say({
              language,
              en: expectations.length > 1 ? "expectations" : "expectation",
              fr: "attendu" + (expectations.length > 1 ? "s" : ""),
            })}
            {" · "}
            {betrayed === 0
              ? say({ language, en: "all met", fr: "tous conformes" })
              : String(betrayed) +
                " " +
                say({
                  language,
                  en: "betrayed",
                  fr: "trahi" + (betrayed > 1 ? "s" : ""),
                })}
          </span>
        </span>
        <span className="shrink-0 text-slate-600">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {rows.map((row, index) => (
            <div key={index} className="font-mono text-[11px] leading-4">
              <span className={row.matching ? "text-emerald-600" : "text-red-600"}>
                {row.matching ? "✓" : "✗"}
              </span>{" "}
              <span className="text-slate-700 dark:text-slate-200">{row.expectation.address}</span>
              <span className="text-slate-600">
                {" " +
                  say({ language, en: "— expected ", fr: "— attendu " }) +
                  formatExpectation(row.expectation.expectation)}
              </span>
              {!row.matching && (
                <span className="text-red-600">
                  {", " + say({ language, en: "read ", fr: "lu " }) + formatExpectation(row.read)}
                </span>
              )}
              {row.provenance !== null && (
                <span className="text-slate-600">
                  {" (" + say({ language, en: "by ", fr: "par " }) + row.provenance + ")"}
                </span>
              )}
            </div>
          ))}
          <p className="pt-1 text-[10px] leading-4 text-slate-600">
            {say({
              language,
              en: "the contract lives in the layer (special key « tests ») — it travels with it, file, disk, staging; the validation replays it at every assembly, a betrayed read is a verdict",
              fr: "le contrat vit dans la couche (clé spéciale « tests ») — il voyage avec elle, fichier, disque, staging ; la validation le rejoue à chaque assemblage, une lecture trahie est un verdict",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
