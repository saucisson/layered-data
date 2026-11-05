// The "Flattened" tab of the formalism panel (②): the flattened
// view. The engine (`flattenLayer`, application layer) walks the
// space without React; this module only renders what it returns —
// each address shows its effective state after first-winner: the
// key, the providing layer (badge), the resolved value. Pure
// observer: nothing is ever written back.

import React, { useMemo, useState } from "react";
import { AddressView, isDictionary } from "../domain/addresses.ts";
import { isSpecialKey } from "../domain/specialKeys.ts";
import type { Address } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import { asLayerName } from "../domain/identifiers.ts";
import { DEFAULT_LANGUAGE, type Language } from "../domain/messages.ts";
import { flattenLayer, type FlatNode } from "../application/flatten.ts";
import { FlatValue } from "./valueRendering.tsx";
import { LayerBadge } from "./layerBadge.tsx";
import { say } from "./i18n.ts";

/** The full flattened dump as plain text — the interactive tree and
 * this text share the same engine, the text rendering derives from it. */
export function dumpFlattenedLayer({
  space,
  layer,
  language = DEFAULT_LANGUAGE,
}: {
  space: Space;
  layer: string;
  language?: Language;
}): string {
  const flattened = flattenLayer({ space, layer: asLayerName(layer) });
  const formatValue = (value: unknown): string => {
    if (value instanceof AddressView) return "@" + value.layer + "/" + value.path.join("/");
    if (isDictionary(value)) {
      return "{" + Object.keys(value).map((key) => key + " = " + formatValue(value[key])).join(", ") + "}";
    }
    if (Array.isArray(value)) return "[" + value.map(formatValue).join(", ") + "]";
    const serialized = JSON.stringify(value);
    return serialized === undefined ? "null" : serialized;
  };
  const lines: string[] = [];
  const walk = (node: FlatNode, depth: number) => {
    for (const entry of node.entries) {
      const provenance =
        entry.winner !== null
          ? entry.status === "fournit"
            ? entry.winner
            : entry.winner +
              " (" +
              say({ language, en: "abstract slot ∅", fr: "slot abstrait ∅" }) +
              ")"
          : "?";
      lines.push("  ".repeat(depth) + entry.key + " = " + formatValue(entry.value) + "  ← " + provenance);
      const child = entry.target !== null ? node.children[entry.key] : undefined;
      if (child) walk(child, depth + 1);
    }
  };
  walk(flattened.root, 0);
  return (
    "# " +
    layer +
    say({ language, en: " — flattened formalism\n", fr: " — formalisme aplati\n" }) +
    "# " +
    flattened.addrs +
    say({ language, en: " nodes · ", fr: " nœuds · " }) +
    flattened.keys +
    say({ language, en: " keys · ", fr: " clés · " }) +
    flattened.winners.length +
    say({ language, en: " contributing layers · root chain: ", fr: " couches contributeurs · chaîne de racine : " }) +
    flattened.chaîne +
    say({ language, en: " layers\n", fr: " couches\n" }) +
    lines.join("\n")
  );
}

/** The interactive flattened tree. Follows the current layer of
 * the workshop (no selector: navigation commands, the tab
 * obeys). */
export function FlatView({
  space,
  layer,
  onPick,
  language,
}: {
  space: Space;
  layer: string;
  onPick: (layer: string, path: string[]) => void;
  language: Language;
}) {
  const [showProvenance, setShowProvenance] = useState(true);
  const [showSpecialKeys, setShowSpecialKeys] = useState(true);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const flattened = useMemo(() => flattenLayer({ space, layer: asLayerName(layer) }), [space, layer]);
  const needle = filter.trim().toLowerCase();
  const keyMatches = (key: string) => !needle || key.toLowerCase().includes(needle);
  const nodeMatches = (node: FlatNode): boolean =>
    node.entries.some(
      (entry) => (showSpecialKeys || !isSpecialKey(entry.key)) && keyMatches(entry.key),
    ) ||
    Object.values(node.children).some(nodeMatches);
  const folderKey = (address: Address) => address[0] + "::" + address[1].join("/");
  const isOpenAt = (node: FlatNode, depth: number) =>
    needle ? true : (expanded[folderKey(node.addr)] ?? depth < 2);

  // The recursive tree renderer: one call per node. Depth drives the
  // indentation; the filter either prunes a whole branch (nothing
  // matches inside) or keeps the entries that match, directly or
  // through a child.
  const RenderedNode = ({ node, depth }: { node: FlatNode; depth: number }) => {
    if (needle && !nodeMatches(node)) {
      return depth === 0 ? (
        <div className="py-1 text-xs text-slate-400">
          {say({
            language,
            en: "No key of " + layer + " matches the filter.",
            fr: "Aucune clé de " + layer + " ne correspond au filtre.",
          })}
        </div>
      ) : null;
    }
    const baseEntries = showSpecialKeys
      ? node.entries
      : node.entries.filter((entry) => !isSpecialKey(entry.key));
    const shownEntries = needle
      ? baseEntries.filter(
          (entry) =>
            keyMatches(entry.key) ||
            (node.children[entry.key] && nodeMatches(node.children[entry.key])),
        )
      : baseEntries;
    return (
      <div className={depth > 0 ? "ml-3 border-l border-slate-100 pl-2" : ""}>
        {shownEntries.length === 0 && !needle && node.entries.length === 0 && (
          <div className="py-0.5 text-[10px] text-slate-400">
            {say({
              language,
              en: "declaration node (no visible key)",
              fr: "nœud de déclaration (aucune clé visible)",
            })}
          </div>
        )}
        {shownEntries.map((entry) => {
          const child = (entry.target !== null && node.children[entry.key]) || null;
          const childOpen = child !== null && isOpenAt(child, depth + 1);
          return (
            <div key={entry.key} className="py-0.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {child !== null && !needle && (
                  <button
                    onClick={() =>
                      setExpanded({ ...expanded, [folderKey(child.addr)]: !childOpen })
                    }
                    aria-label={childOpen ? say({ language, en: "collapse", fr: "replier" }) : say({ language, en: "expand", fr: "déplier" })}
                    className="w-4 shrink-0 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    {childOpen ? "▾" : "▸"}
                  </button>
                )}
                <span
                  className={
                    "font-mono font-semibold " +
                    (isSpecialKey(entry.key) ? "text-amber-600" : "text-slate-800")
                  }
                >
                  {entry.key}
                </span>
                {showProvenance && entry.status === "fournit" && entry.winner !== null && (
                  <LayerBadge layer={entry.winner} small />
                )}
                {showProvenance && entry.status === "transparent" && entry.winner !== null && (
                  <span
                    className="flex items-center gap-0.5"
                    title={say({
                      language,
                      en: "abstract slot: the key is declared, no layer provides its value",
                      fr: "slot abstrait : la clé est déclarée, aucune couche n'en fournit la valeur",
                    })}
                  >
                    <span className="text-[10px] text-slate-400">∅</span>
                    <LayerBadge layer={entry.winner} small />
                  </span>
                )}
                <span className="min-w-0">
                  {entry.status === "transparent" ? (
                    <span className="text-slate-400">
                      {say({ language, en: "abstract slot", fr: "slot abstrait" })}
                    </span>
                  ) : (
                    <FlatValue value={entry.value} language={language} />
                  )}
                </span>
                {entry.target !== null && (
                  <button
                    onClick={() => onPick(entry.target![0], entry.target![1])}
                    title={say({
                      language,
                      en: "open this address in panel ③ — the detailed read: chain, scan, winner",
                      fr: "ouvrir cette adresse dans le panneau ③ — la lecture détaillée : chaîne, scan, gagnant",
                    })}
                    className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-slate-600 hover:text-slate-800"
                  >
                    {say({ language, en: "→ go there", fr: "→ y aller" })}
                  </button>
                )}
              </div>
              {child !== null && childOpen && (
                <div className="mt-0.5">
                  <RenderedNode node={child} depth={depth + 1} />
                </div>
              )}
              {child !== null && !childOpen && !needle && (
                <div className="ml-4 text-[10px] text-slate-400">
                  {"+ "}
                  {child.nAddrs}{" "}
                  {say({ language, en: child.nAddrs > 1 ? "nodes" : "node", fr: "nœud" + (child.nAddrs > 1 ? "s" : "") })}
                  {" · "}
                  {child.nKeys}{" "}
                  {say({ language, en: child.nKeys > 1 ? "keys" : "key", fr: "clé" + (child.nKeys > 1 ? "s" : "") })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  function copyDump() {
    // Silent copy: outside a browser (render harness) nothing
    // happens — the tool lives in the canvas, the button is
    // measured there.
    try {
      (globalThis as any).navigator?.clipboard?.writeText?.(
        dumpFlattenedLayer({ space, layer, language }),
      );
    } catch {}
    setCopied(true);
  }

  return (
    <div>
      <p className="mb-2 text-[11px] leading-4 text-slate-500">
        {say({
          language,
          en: "The whole formalism, without hierarchy: every node shows the effective state of its address after first-wins — the key, the layer providing the value (badge), the resolved value. The special keys appear there; only refines is absent: the hierarchy is precisely what the view removes. An abstract slot shows ∅ with its declarer; a resolved reference stays a leaf — its content opens by « go there ». Pure observer: nothing is written.",
          fr: "Le formalisme entier, sans hiérarchie : chaque nœud montre l'état effectif de son adresse après premier-gagné — la clé, la couche qui fournit la valeur (badge), la valeur résolue. Les clés spéciales y figurent ; seul refines est absent : la hiérarchie est précisément ce que la vue retire. Un slot abstrait se montre ∅ avec son déclarant ; une référence résolue reste une feuille — son contenu s'ouvre par « y aller ». Observateur pur : rien n'est écrit.",
        })}
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400">
          {layer} — {flattened.addrs}{" "}
          {say({ language, en: flattened.addrs > 1 ? "nodes" : "node", fr: "nœud" + (flattened.addrs > 1 ? "s" : "") })}
          {" · "}
          {flattened.keys}{" "}
          {say({ language, en: flattened.keys > 1 ? "keys" : "key", fr: "clé" + (flattened.keys > 1 ? "s" : "") })}
          {" · "}
          {flattened.winners.length}{" "}
          {say({ language, en: "contributing layers", fr: "couches contributeurs" })}
        </span>
        <label className="flex items-center gap-1 text-slate-500">
          <input
            type="checkbox"
            checked={showProvenance}
            onChange={(event) => setShowProvenance(event.target.checked)}
          />
          {say({ language, en: "provenance", fr: "provenance" })}
        </label>
        <label className="flex items-center gap-1 text-slate-500">
          <input
            type="checkbox"
            checked={showSpecialKeys}
            onChange={(event) => setShowSpecialKeys(event.target.checked)}
          />
          {say({ language, en: "special keys", fr: "clés spéciales" })}
        </label>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={say({ language, en: "filter keys…", fr: "filtrer les clés…" })}
          className="min-w-32 flex-1 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
        />
        <span className="text-slate-400">
          {say({ language, en: "root chain: ", fr: "chaîne de racine : " })}
          {flattened.chaîne}{" "}
          {say({ language, en: flattened.chaîne > 1 ? "layers" : "layer", fr: "couche" + (flattened.chaîne > 1 ? "s" : "") })}
        </span>
        <button
          onClick={copyDump}
          title={say({
            language,
            en: "copy the complete flattened dump — every key, its resolved value, its winning layer",
            fr: "copier le dump complet de l'aplatissement — chaque clé, sa valeur résolue, sa couche gagnante",
          })}
          className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-600 hover:border-slate-600 hover:text-slate-800"
        >
          {copied
            ? say({ language, en: "✓ dump copied", fr: "✓ dump copié" })
            : say({ language, en: "⧉ copy the dump", fr: "⧉ copier le dump" })}
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-slate-100 bg-slate-50/50 p-2">
        <RenderedNode node={flattened.root} depth={0} />
      </div>
    </div>
  );
}
