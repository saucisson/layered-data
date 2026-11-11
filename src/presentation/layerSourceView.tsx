// The "Language" tab of the formalism panel (②): THE PEN — the
// formalism as written in the grammar, act by act, with coloring.
// The panel ③ shows what the kernel reads at an address, the
// "Flattened" tab shows what the flattened view aggregates; this
// one shows the writing. Every DESIGNATED LINE is clickable: the
// line-target table gives the address written by the line, the
// cascade opens there. Silent lines (comments, empty lines) stay
// silent.

import { useMemo } from "react";
import { extractLayerBlock } from "../application/staging.ts";
import type { LanguageAct, LanguageLayer, ParsedLanguage } from "../domain/language/parser.ts";
import { say } from "./i18n.ts";
import type { Language } from "../domain/messages.ts";

/** The acts of the grammar, as highlighted: keywords, references,
 * strings, numbers, comments, identifiers, punctuation. */
const LANGUAGE_KEYWORDS = new Set([
  "layer",
  "refines",
  "extend",
  "override",
  "bind",
  "check",
  "abstract",
  "then",
]);

/** Where a written line points: the address (layer + path) and,
 * when the line writes one, the key. */
export interface SourceLineTarget {
  layer: string;
  path: string[];
  key: string | null;
}

/** The line-target table: each line of the layer source designates the
 * address it writes. The acts carry their line; the walk is pure,
 * at load time, over the parsed layers. */
export function buildSourceLineTargets({
  parsedLanguage,
}: {
  parsedLanguage: ParsedLanguage;
}): Map<number, SourceLineTarget> {
  const targets = new Map<number, SourceLineTarget>();
  for (const parsedLayer of parsedLanguage.layers) {
    targets.set(parsedLayer.line, { layer: parsedLayer.name, path: [], key: null });
    const walk = (acts: LanguageAct[], path: string[]) => {
      for (const act of acts) {
        if (act.kind === "bind") {
          targets.set(act.line, { layer: parsedLayer.name, path, key: "bindings" });
          continue;
        }
        if (act.kind === "check") {
          targets.set(act.line, { layer: parsedLayer.name, path, key: "checks" });
          continue;
        }
        // a definition is also a pose (ADR-0105): the line designates
        // the checks container, like a plain check
        if (act.kind === "check-definition") {
          targets.set(act.line, { layer: parsedLayer.name, path, key: "checks" });
          continue;
        }
        // "expect" is an act without a block — the line designates
        // the scene it expects (a path read from the layer's root),
        // not a container.
        if (act.kind === "expect") {
          targets.set(act.line, { layer: parsedLayer.name, path: act.path, key: act.key });
          continue;
        }
        if (act.block !== null) {
          targets.set(act.line, { layer: parsedLayer.name, path: [...path, act.key], key: null });
          walk(act.block, [...path, act.key]);
        } else {
          targets.set(act.line, { layer: parsedLayer.name, path, key: act.key });
        }
      }
    };
    walk(parsedLayer.acts, []);
  }
  return targets;
}

/** Coloring: same rules as the tokenizer — what shines in violet
 * is an act of the language, in green an @path, in amber a string,
 * in gray a comment. Fidelity is guaranteed by construction: the
 * spans follow the same boundaries the lexer draws. */
export function highlightSourceLine(line: string): { text: string; kind: string }[] {
  const spans: { text: string; kind: string }[] = [];
  let index = 0;
  while (index < line.length) {
    const character = line[index];
    if (character === undefined) break;
    const next = line[index + 1];
    if (character === "/" && next === "/") {
      spans.push({ text: line.slice(index), kind: "cm" });
      break;
    }
    if (character === '"') {
      let end = index + 1;
      while (end < line.length && line[end] !== '"') end++;
      spans.push({ text: line.slice(index, end + 1), kind: "st" });
      index = end + 1;
      continue;
    }
    if (character === "@") {
      let end = index + 1;
      while (end < line.length && /[A-Za-z0-9_-]/.test(line[end] ?? "")) end++;
      while (
        line[end] === "/" &&
        line[end + 1] !== undefined &&
        /[A-Za-z0-9_-]/.test(line[end + 1] ?? "")
      ) {
        end++;
        while (end < line.length && /[A-Za-z0-9_-]/.test(line[end] ?? "")) end++;
      }
      spans.push({ text: line.slice(index, end), kind: "rf" });
      index = end;
      continue;
    }
    if (/[A-Za-z_]/.test(character)) {
      let end = index;
      while (end < line.length && /[A-Za-z0-9_-]/.test(line[end] ?? "")) end++;
      const word = line.slice(index, end);
      spans.push({
        text: word,
        kind: LANGUAGE_KEYWORDS.has(word)
          ? "kw"
          : word === "true" || word === "false"
            ? "bo"
            : "id",
      });
      index = end;
      continue;
    }
    if (/[0-9]/.test(character)) {
      let end = index;
      while (end < line.length && /[0-9.]/.test(line[end] ?? "")) end++;
      spans.push({ text: line.slice(index, end), kind: "nu" });
      index = end;
      continue;
    }
    spans.push({ text: character, kind: "pu" });
    index++;
  }
  return spans;
}

export const SPAN_CLASSES: Record<string, string> = {
  kw: "font-semibold text-violet-700",
  bo: "font-semibold text-violet-700",
  rf: "text-emerald-700",
  st: "text-amber-700",
  nu: "text-sky-700",
  cm: "italic text-slate-600",
  id: "text-slate-800 dark:text-slate-100",
  pu: "text-slate-500",
};

/** The "Language" tab of ②: the source follows the current layer of
 * the workshop, no selector. Added layers are read too — their
 * block lives in the additions, same color, same extraction; their
 * lines are not clickable (the line-target table stays that of the
 * loaded corpus). */
export function LayerSourceView({
  layer,
  languageSource,
  addedLayerSources,
  parsedLayer,
  sourceLineTargets,
  onLine,
  language,
}: {
  layer: string;
  languageSource: string;
  addedLayerSources: Record<string, string>;
  parsedLayer: LanguageLayer | null;
  sourceLineTargets: Map<number, SourceLineTarget>;
  onLine: (target: SourceLineTarget) => void;
  language: Language;
}) {
  const block = useMemo(
    () => addedLayerSources[layer] ?? extractLayerBlock({ name: layer, source: languageSource }),
    [layer, languageSource, addedLayerSources],
  );
  return (
    <div>
      <p className="mb-2 text-[11px] leading-4 text-slate-500">
        {say({
          language,
          en: "The grammar as it writes itself. « refines @a then @b »: the parents in their consultation order — the first wins, the closure follows the list; « abstract key » declares an unbound slot; « bind slot -&gt; name » binds a check slot to the concrete key name — on the left the checks' stable API, on the right the layer's vocabulary. What shines in violet is an act, in green an @path, in amber a string.",
          fr: "La grammaire telle qu'elle s'écrit. « refines @a then @b » : les parents dans leur ordre de consultation — le premier gagne, la fermeture suit la liste ; « abstract clé » déclare un slot non tranché ; « bind slot -&gt; nom » lie un slot de check au nom de clé concret — à gauche l'API stable des checks, à droite le vocabulaire de la couche. Ce qui brille en violet est un acte, en vert un @chemin, en ambre une chaîne.",
        })}
      </p>
      <div className="max-h-80 overflow-auto rounded-md border border-slate-100 bg-slate-50 dark:bg-slate-900/50 p-2 font-mono text-[11px] leading-4">
        {block === null ? (
          <div className="py-1 text-xs text-slate-600">
            {say({
              language,
              en: "layer unknown to the geologist",
              fr: "couche inconnue du géologue",
            })}
          </div>
        ) : (
          block.split("\n").map((line, index) => {
            // Displayed line `index` (0-based) is the source line
            // parsedLayer.line + index: the block is extracted from
            // its "layer" line.
            const lineTarget =
              parsedLayer !== null ? sourceLineTargets.get(parsedLayer.line + index) : undefined;
            return (
              <div
                key={index}
                className={
                  "flex " +
                  (lineTarget !== undefined ? "cursor-pointer hover:bg-slate-100 dark:bg-slate-800 rounded" : "")
                }
                onClick={lineTarget !== undefined ? () => onLine(lineTarget) : undefined}
                title={
                  lineTarget !== undefined
                    ? say({
                        language,
                        en:
                          "open what this line writes — address " +
                          lineTarget.layer +
                          "/" +
                          (lineTarget.path.length ? lineTarget.path.join("/") : "()") +
                          (lineTarget.key !== null ? " :: " + lineTarget.key : "") +
                          " : the cascade opens there",
                        fr:
                          "ouvrir ce que cette ligne écrit — adresse " +
                          lineTarget.layer +
                          "/" +
                          (lineTarget.path.length ? lineTarget.path.join("/") : "()") +
                          (lineTarget.key !== null ? " :: " + lineTarget.key : "") +
                          " : la cascade s'y ouvre",
                      })
                    : undefined
                }
              >
                <span className="mr-3 w-8 shrink-0 select-none text-right text-slate-500">
                  {index + 1}
                </span>
                <span className="whitespace-pre">
                  {highlightSourceLine(line).map((span, spanIndex) => (
                    <span key={spanIndex} className={SPAN_CLASSES[span.kind]}>
                      {span.text}
                    </span>
                  ))}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
