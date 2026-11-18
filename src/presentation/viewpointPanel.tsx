// The lenses page panel (issue #227): the tree of lenses and
// viewpoints on the left, the drawing of the chosen model through the
// chosen look on the right, and the dressing detail of the selected
// glyph. Pure presentation — the state lives in the page.

import type { Language } from "../domain/messages.ts";
import { asLayerName, asLayerPath } from "../domain/identifiers.ts";
import { coversAddresses, dressingEntries, type RawGlyph } from "../domain/views.ts";
import type { LayeredDataKernel } from "../application/corpus.ts";
import { AddressView } from "../domain/addresses.ts";
import { localized, say } from "./i18n.ts";
import { LayerBadge } from "./layerBadge.tsx";
import { NodeGlyph, EdgeGlyph } from "./glyphs.tsx";
import {
  bindingOf,
  groupTree,
  lensLayers,
  shapeLabel,
  viewNote,
  viewpointLayers,
} from "./viewTree.ts";
import type { buildWorkshopLook } from "./lensDrawing.ts";
import type { SelectedGlyph } from "./workshop/workshopKernel.ts";

export function ViewpointPanel({
  language,
  kernel,
  look,
  selectedView,
  onSelectView,
  selectedGlyph,
  onSelectGlyph,
}: {
  language: Language;
  kernel: LayeredDataKernel;
  look: ReturnType<typeof buildWorkshopLook>;
  selectedView: string;
  onSelectView: (view: string) => void;
  selectedGlyph: SelectedGlyph | null;
  onSelectGlyph: (glyph: SelectedGlyph | null) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4" role="region" aria-labelledby="panel-viewpoint-heading">
      <h2 id="panel-viewpoint-heading" className="text-sm font-bold text-slate-800 dark:text-slate-100">
        {say({ language, en: "The lenses & viewpoints" })}
        <span className="ml-1 font-normal text-slate-600 dark:text-slate-400">
          {say({
            language,
            en: "the tree on the left, the drawing on the right",
          })}
        </span>
      </h2>
      <p className="mb-3 mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
        {say({
          language,
          en:
            "The viewpoint is chosen in the tree: lenses dress the types with a " +
            "display templates scheme; viewpoints designate a model and " +
            "a lens through LRef fields. A viewpoint imposes its model — " +
            "a lone lens applies to the current model of ①. The " +
            "positions are those of the course when the viewpoint " +
            "decides them, otherwise the circle layout; and the " +
            "inapplicability displays honestly (the lens dresses only " +
            "what it knows, the model stays whole). Among the entries " +
            "dressing a node, the most specific wins — measured by " +
            "closure, not by the order of the chain. Click a shape or " +
            "an arc to see the dressing.",
        })}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* The tree of looks: roots then descendants (refinements
            internal to the group), indentation by depth; a click
            changes the look and deselects the shape */}
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {say({ language, en: "Lenses" })}
            </div>
            <div className="space-y-1">
              {groupTree({ space: kernel.space, members: lensLayers({ space: kernel.space }) }).map(
                ({ layer: viewLayer, depth }) => (
                  <div key={viewLayer} style={{ marginLeft: depth * 14 }}>
                    <button type="button"
                      className={
                        "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] " +
                        (selectedView === viewLayer
                          ? "bg-slate-800 dark:bg-slate-600 text-white"
                          : "bg-white text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-800")
                      }
                      onClick={() => {
                        onSelectView(viewLayer);
                        onSelectGlyph(null);
                      }}
                    >
                      <LayerBadge layer={viewLayer} small />
                      <span className="truncate text-slate-600 dark:text-slate-400">
                        {say({
                          language,
                          en: "lens — model: the chosen one",
                        })}
                      </span>
                    </button>
                  </div>
                ),
              )}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {say({ language, en: "Viewpoints" })}
            </div>
            <div className="space-y-1">
              {groupTree({ space: kernel.space, members: viewpointLayers({ space: kernel.space }) }).map(
                ({ layer: viewLayer, depth }) => (
                  <div key={viewLayer} style={{ marginLeft: depth * 14 }}>
                    <button type="button"
                      className={
                        "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] " +
                        (selectedView === viewLayer
                          ? "bg-slate-800 dark:bg-slate-600 text-white"
                          : "bg-white text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-800")
                      }
                      onClick={() => {
                        onSelectView(viewLayer);
                        onSelectGlyph(null);
                      }}
                    >
                      <LayerBadge layer={viewLayer} small />
                      <span className="truncate text-slate-600 dark:text-slate-400">
                        {bindingOf({ space: kernel.space, view: viewLayer, key: "model" })
                          .value instanceof AddressView
                          ? say({ language, en: "→ designated model" })
                          : say({
                              language,
                              en: "→ model: the chosen one",
                            })}
                      </span>
                    </button>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
        {/* The drawing: the model "seen through" the lens, the
            header says what is imposed, decided or fallback */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-2 md:col-span-2">
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <LayerBadge layer={look.model} small />
            <span className="text-slate-500 dark:text-slate-400">
              {say({ language, en: "seen through" })}
            </span>
            {look.lens !== null ? (
              <LayerBadge layer={look.lens} small />
            ) : (
              <span className="font-mono text-slate-600 dark:text-slate-400">
                {say({ language, en: "∅ without a lens" })}
              </span>
            )}
            <span className="text-slate-500 dark:text-slate-400">·</span>
            <span className="text-slate-500 dark:text-slate-400">
              {look.isLens
                ? say({
                    language,
                    en: "lone lens — the chosen model",
                  })
                : look.viewpointDecidesPositions
                  ? say({ language, en: "dinner-course positions" })
                  : look.modelCarriesPositions
                    ? say({
                        language,
                        en: "model positions — resolved (grid or pole, relative included)",
                      })
                    : say({
                        language,
                        en: "positions: circle layout",
                      })}
            </span>
          </div>
          <svg viewBox={look.frame ?? "0 0 270 220"} className="w-full rounded bg-white dark:bg-slate-800">
            {look.lens !== null &&
              look.edges.map((edge) => {
                const fromVertex =
                  edge.from !== null
                    ? (look.vertices.find((vertex) => vertex.name === edge.from) ?? null)
                    : null;
                const toVertex =
                  edge.to !== null
                    ? (look.vertices.find((vertex) => vertex.name === edge.to) ?? null)
                    : null;
                const from = fromVertex?.position ?? null;
                const to = toVertex?.position ?? null;
                if (!from || !to) return null;
                return (
                  <EdgeGlyph
                    key={edge.name}
                    name={edge.name}
                    shape={edge.drawn ? edge.drawn.spec : null}
                    fnContext={edge.fnContext}
                    weight={edge.weight}
                    from={from}
                    to={to}
                    fromShape={fromVertex?.drawn ? fromVertex.drawn.spec : null}
                    fromSize={fromVertex?.size}
                    toShape={toVertex?.drawn ? toVertex.drawn.spec : null}
                    toSize={toVertex?.size}
                    selected={
                      selectedGlyph !== null &&
                      selectedGlyph.kind === "edge" &&
                      selectedGlyph.name === edge.name
                    }
                    onPick={() =>
                      onSelectGlyph(
                        selectedGlyph &&
                          selectedGlyph.kind === "edge" &&
                          selectedGlyph.name === edge.name
                          ? null
                          : { kind: "edge", name: edge.name },
                      )
                    }
                  />
                );
              })}
            {look.lens !== null &&
              look.vertices.map((vertex) => {
                if (!vertex.position) return null;
                return (
                  <NodeGlyph
                    key={vertex.name}
                    name={vertex.name}
                    shape={vertex.drawn ? vertex.drawn.spec : null}
                    draw={vertex.drawn ? vertex.drawn.draw : null}
                    fnContext={vertex.fnContext}
                    position={vertex.position}
                    size={vertex.size}
                    selected={
                      selectedGlyph !== null &&
                      selectedGlyph.kind === "vertex" &&
                      selectedGlyph.name === vertex.name
                    }
                    onPick={() =>
                      onSelectGlyph(
                        selectedGlyph &&
                          selectedGlyph.kind === "vertex" &&
                          selectedGlyph.name === vertex.name
                          ? null
                          : { kind: "vertex", name: vertex.name },
                      )
                    }
                  />
                );
              })}
          </svg>
          {/* The bindings of the viewpoint: the layer that
                provides each field, the resolved value — a look
                stays a layer, its slots read like the others */}
          {!look.isLens && (
            <div className="mt-1.5 space-y-0.5 text-[10px] leading-4">
              {["model", "display", "zoom"].map((slotKey) => {
                const binding = bindingOf({
                  space: kernel.space,
                  view: selectedView,
                  key: slotKey,
                });
                return (
                  <div key={slotKey} className="flex items-center gap-1">
                    <span className="w-11 shrink-0 font-mono text-slate-600 dark:text-slate-400">{slotKey}</span>
                    {binding.winner ? (
                      <LayerBadge layer={binding.winner[0]} small />
                    ) : (
                      <span className="text-slate-600 dark:text-slate-400">∅</span>
                    )}
                    <span className="truncate text-slate-500 dark:text-slate-400">
                      {binding.value instanceof AddressView
                        ? "→ " + binding.value.layer
                        : binding.value === null
                          ? say({ language, en: "∅ undefined" })
                          : String(binding.value)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {/* Honest applicability: nothing hidden — no lens, no
                graph, blind or partial lens, every case speaks */}
          <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            {look.lens === null
              ? say({
                  language,
                  en: "viewpoint without a lens — no drawing",
                })
              : look.applicability.total === -1
                ? say({
                    language,
                    en: "the model is not a graph — no vertices entry",
                  })
                : say({ language, en: "applicability: " }) +
                  look.applicability.dressed +
                  "/" +
                  look.applicability.total +
                  say({
                    language,
                    en: " vertices dressed",
                  }) +
                  (look.applicability.dressed === look.applicability.total
                    ? say({ language, en: " — applicable lens" })
                    : "") +
                  (look.applicability.dressed === 0
                    ? say({
                        language,
                        en: " — blind lens: dresses no vertex (domain error)",
                      })
                    : "") +
                  (look.applicability.dressed > 0 &&
                  look.applicability.dressed < look.applicability.total
                    ? say({
                        language,
                        en: " — partial: domain error",
                      })
                    : "")}
          </div>
          <p className="mt-1 text-[10px] leading-4 text-slate-600 dark:text-slate-400">
            {localized({ language, text: viewNote({ space: kernel.space, layer: selectedView }) })}
          </p>
        </div>
      </div>

      {selectedGlyph &&
        look.lens !== null &&
        (() => {
          const glyphPath =
            selectedGlyph.kind === "vertex"
              ? ["vertices", selectedGlyph.name]
              : ["edges", selectedGlyph.name];
          const matches = dressingEntries({
            space: kernel.space,
            lens: asLayerName(look.lens),
            layer: asLayerName(look.model),
            path: asLayerPath(glyphPath),
          });
          let best: {
            path: string[];
            spec: RawGlyph[];
            hit: ReturnType<typeof dressingEntries>[number]["hit"];
          } | null = null;
          for (const match of matches) {
            if (
              best === null ||
              coversAddresses({ space: kernel.space, covering: match.hit, covered: best.hit })
            )
              best = match;
          }
          return (
            <div className="mt-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-slate-800 dark:bg-slate-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                  {selectedGlyph.name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {look.model} :: {glyphPath.join("/")} —{" "}
                  {say({ language, en: "dressing by" })}{" "}
                  <span className="font-medium">{look.lens}</span>
                </span>
                <button type="button"
                  className="ml-auto rounded px-2 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 dark:text-slate-200"
                  onClick={() => onSelectGlyph(null)}
                >
                  ×
                </button>
              </div>
              {matches.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {say({
                    language,
                    en:
                      "No entry of the lens dresses this node — it would be " +
                      "drawn “naked” (dotted).",
                  })}
                </p>
              )}
              <div className="space-y-1">
                {matches.map((match, index) => {
                  const isBest = match === best;
                  return (
                    <div
                      key={index}
                      className={
                        "flex flex-wrap items-center gap-1.5 rounded-md px-2 py-1 text-[11px] " +
                        (isBest ? "bg-emerald-50 dark:bg-emerald-950 ring-1 ring-emerald-300 dark:ring-emerald-700" : "bg-white dark:bg-slate-800")
                      }
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {shapeLabel({ shape: match.spec, language })}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {say({ language, en: "← entry" })}
                      </span>
                      <span className="font-mono text-slate-600 dark:text-slate-400">{match.path.join("/")}</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {say({ language, en: "dresses" })}
                      </span>
                      {match.hit.map((hitAddress, hitIndex) => (
                        <span key={hitIndex} className="inline-flex items-center gap-0.5">
                          {hitIndex > 0 && <span className="text-slate-600 dark:text-slate-400">,</span>}
                          <LayerBadge layer={hitAddress[0]} small />
                          <span className="font-mono text-slate-500 dark:text-slate-400">
                            {hitAddress[1].length ? hitAddress[1].join("/") : "()"}
                          </span>
                        </span>
                      ))}
                      {isBest && (
                        <span className="ml-auto rounded bg-emerald-600 dark:bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {say({
                            language,
                            en: "winner — the most specific",
                          })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {matches.length > 1 && (
                <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {language === "fr" ? (
                    <>
                      Deux entrées habillent ce nœud : celle de la famille et le cercle générique.
                      L'entrée la plus spécifique gagne — son type{" "}
                      <span className="font-mono">raffine</span> celui de l'autre, mesuré par
                      fermeture : ce verdict ne dépend pas de l'ordre de la chaîne du nœud (think1
                      porte son type le plus spécifique en fin de chaîne, producer en début).
                    </>
                  ) : (
                    <>
                      Two entries dress this node: the family one and the generic circle. The most
                      specific entry wins — its type <span className="font-mono">refines</span>{" "}
                      the other's, measured by closure: this verdict does not depend on the order
                      of the node's chain (think1 carries its most specific type at the end of the
                      chain, producer at the start).
                    </>
                  )}
                </p>
              )}
              {matches.length === 1 && (
                <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {say({
                    language,
                    en: "A single entry dresses this node: no choice to make.",
                  })}
                </p>
              )}
            </div>
          );
        })()}
    </section>
  );
}
