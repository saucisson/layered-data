// ONE CARD of the cascade strip — the semantics follow the clicked
// line: a value line shows the provenance (the winning address,
// where the value is provided); a type or container line shows
// the chain of refined types; only the last card is active, the
// others are the history.

import { useMemo } from "react";
import { LayerReference, PathReference } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import { asLayerName, asLayerPath } from "../domain/identifiers.ts";
import { LayerBadge } from "./layerBadge.tsx";
import { labelOf, say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";
import type { SourceLineTarget } from "./layerSourceView.tsx";

/** The chain of refined types — the refines DECLARED at an
 * address, followed step by step (cycle guard, bounded depth:
 * the chain is read crank by crank, a click extends it); the
 * @paths of the layer source are addresses, the kernel read returns them
 * as-is. */
export function refinementChainOf({
  space,
  layer,
  path,
}: {
  space: Space;
  layer: string;
  path: string[];
}): { layer: string; path: string[] }[] {
  const chain: { layer: string; path: string[] }[] = [];
  const seen = new Set<string>();
  let current: { layer: string; path: string[] } = { layer, path };
  while (chain.length < 8) {
    const key = current.layer + "::" + current.path.join("/");
    if (seen.has(key)) break;
    seen.add(key);
    let next: { layer: string; path: string[] } | null = null;
    try {
      const refines = space.read({
        layer: asLayerName(current.layer),
        path: asLayerPath(current.path),
        key: "refines",
      });
      if (Array.isArray(refines)) {
        for (const candidate of refines) {
          if (candidate instanceof PathReference) {
            next = { layer: candidate.anchor, path: [...candidate.path] };
            break;
          }
          if (candidate instanceof LayerReference) {
            next = { layer: candidate.layer, path: [] };
            break;
          }
        }
      }
    } catch {
      break;
    }
    if (next === null) break;
    chain.push(next);
    current = next;
  }
  return chain;
}

/** One card of the cascade: the target address, its winning
 * provenance (for a value) or its refinement chain (for a type or
 * container), and — on the last card — the clicks that move the
 * cascade. */
export function CascadeCard({
  space,
  target,
  isLast,
  isSecondToLast,
  onOpen,
  language,
}: {
  space: Space;
  target: SourceLineTarget;
  isLast: boolean;
  isSecondToLast: boolean;
  onOpen: (layer: string, path: string[]) => void;
  language: Language;
}) {
  const chain = useMemo(
    () =>
      target.key === null
        ? refinementChainOf({ space, layer: target.layer, path: target.path })
        : [],
    [space, target.layer, target.path.join("/"), target.key],
  );
  const provenance = useMemo(() => {
    if (target.key === null) return null;
    const scan: any[] = [];
    space.read({
      layer: asLayerName(target.layer),
      path: asLayerPath(target.path),
      key: target.key,
      scan,
    });
    const last = scan.length ? scan[scan.length - 1] : null;
    return {
      readCount: scan.length,
      winner: last && last.status === "fournit" ? last.source : null,
      status: last ? last.status : null,
    };
  }, [space, target.layer, target.path.join("/"), target.key]);
  return (
    <div
      className={
        "w-64 shrink-0 rounded-lg border p-2 " +
        (isLast
          ? "border-slate-500 bg-slate-50 dark:bg-slate-900 ring-2 ring-slate-400"
          : isSecondToLast
            ? "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 ring-1 ring-slate-300"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-50")
      }
    >
      <div className="flex flex-wrap items-center gap-1 text-[11px]">
        <LayerBadge layer={target.layer} small />
        <span className="min-w-0 break-all font-mono text-slate-700 dark:text-slate-200">
          {target.path.length ? target.path.join("/") : "()"}
        </span>
      </div>
      {target.key !== null && (
        <div className="mt-1 text-[11px] leading-4">
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{target.key}</span> ←{" "}
          {provenance && provenance.winner !== null ? (
            isLast ? (
              <button type="button"
                onClick={() => onOpen(provenance.winner!, target.path)}
                title={say({
                  language,
                  en: "the winning address — the value is provided there; this crank moves left, it opens on the right",
                  fr: "l'adresse gagnante — la valeur y est fournie ; ce cran passe à gauche, elle s'ouvre à droite",
                })}
                className="rounded hover:ring-1 hover:ring-slate-500"
              >
                <LayerBadge layer={provenance.winner} small />
              </button>
            ) : (
              <LayerBadge layer={provenance.winner} small />
            )
          ) : (
            <span className="text-slate-600">
              {provenance && provenance.status
                ? labelOf({ code: provenance.status, language })
                : say({ language, en: "not provided", fr: "non fournie" })}
            </span>
          )}
          {provenance && (
            <span className="ml-1 text-slate-600">
              ({provenance.readCount}{" "}
              {say({
                language,
                en: provenance.readCount > 1 ? "sources consulted" : "source consulted",
                fr:
                  "source" +
                  (provenance.readCount > 1 ? "s" : "") +
                  " consultée" +
                  (provenance.readCount > 1 ? "s" : ""),
              })}
              )
            </span>
          )}
        </div>
      )}
      {chain.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] leading-4">
          <span className="text-slate-600">{say({ language, en: "refines", fr: "raffine" })}</span>
          {chain.map((step, index) => (
            <span key={index} className="flex flex-wrap items-center gap-1">
              {index > 0 && <span className="text-slate-500">→</span>}
              {isLast ? (
                <button type="button"
                  onClick={() => onOpen(step.layer, step.path)}
                  title={say({
                    language,
                    en: "the next crank of the chain — it opens on the right",
                    fr: "le cran suivant de la chaîne — il s'ouvre à droite",
                  })}
                  className="rounded hover:ring-1 hover:ring-slate-500"
                >
                  <LayerBadge layer={step.layer} small />
                </button>
              ) : (
                <LayerBadge layer={step.layer} small />
              )}
              <span className="font-mono text-slate-500">
                {step.path.length ? step.path.join("/") : "()"}
              </span>
            </span>
          ))}
        </div>
      )}
      {target.key === null && chain.length === 0 && (
        <div className="mt-1 text-[11px] text-slate-600">
          {say({ language, en: "closure: ", fr: "fermeture : " })}
          {
            space.closure({ layer: asLayerName(target.layer), path: asLayerPath(target.path) })
              .length
          }{" "}
          {say({
            language,
            en:
              space.closure({ layer: asLayerName(target.layer), path: asLayerPath(target.path) })
                .length > 1
                ? "sources"
                : "source",
            fr:
              "source" +
              (space.closure({ layer: asLayerName(target.layer), path: asLayerPath(target.path) })
                .length > 1
                ? "s"
                : ""),
          })}
        </div>
      )}
    </div>
  );
}
