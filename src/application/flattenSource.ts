// The flattened formalism, written in the workshop's own display
// language: the closure of a layer, resolved in place by
// first-winner, serialized as an .ld-looking text — one line per
// key, one indented block per structural child, `abstract` for the
// declared-but-unprovided slots, @addresses for the references.
// The provenance stays: the layer that provides (or declares) each
// key travels as a // comment — the flattened view removes the
// hierarchy, it never hides the winners.
//
// The artifact speaks the language's own words (layer, abstract,
// expect are the grammar's English): the generated text is the
// artifact, not the narration — same discipline as the tutorial's
// code blocks, which feed both tongues unchanged. The pages frame
// it bilingually around it.

import { AddressView, isDictionary } from "../domain/addresses.ts";
import type { LayerName } from "../domain/identifiers.ts";
import type { Space } from "../domain/space.ts";
import { flattenLayer, type FlatNode } from "./flatten.ts";

/** One flattened value, as the display language writes values:
 * numbers and booleans as themselves, strings quoted, references
 * as @<layer>/<path>, dictionaries and arrays in the dump notation —
 * the grammar carries no composite value, the braces say so
 * honestly. */
function writeFlatValue({ value }: { value: unknown }): string {
  if (value instanceof AddressView) return "@" + value.layer + "/" + value.path.join("/");
  if (value === null) return "null";
  if (isDictionary(value)) {
    const dictionary = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(dictionary)
        .map((key) => key + " = " + writeFlatValue({ value: dictionary[key] }))
        .join(", ") +
      "}"
    );
  }
  if (Array.isArray(value)) {
    return "[" + value.map((item) => writeFlatValue({ value: item })).join(", ") + "]";
  }
  if (typeof value === "string") return '"' + value + '"';
  return String(value);
}

/** The provenance comment of one entry: who provides the value, or
 * who declares the slot nobody provides. */
function writeFlatProvenance({ status, winner }: { status: string; winner: string | null }): string {
  const provider = winner ?? "?";
  return status === "fournit" ? "provided by " + provider : "declared by " + provider + ", provided by none";
}

/** The click target of one flattened line — what the cascade card
 * opens: a value line targets the node path with its key (the
 * card shows the winning address, the core sample of the read); a
 * structural line targets the child node itself, key null (the
 * card shows the chain of refined types). */
export interface FlattenedTarget {
  layer: string;
  path: string[];
  key: string | null;
}

/** One flattened entry as the pages render it: the serialized line
 * (without its indent — the depth travels with the walk), and, in
 * order, the indented blocks of its structural children. The
 * entry's parts travel with the line — the widget renders the key,
 * the value and the provenance badge without parsing the text
 * back; the serializer writes the line, the harness pins the
 * agreement between the two. */
export interface FlattenedSection {
  line: string;
  sections: FlattenedSection[];
  /** the entry's key */
  key: string;
  /** the won value as display text, or null for the abstract slot */
  value: string | null;
  /** true when the value is a node — the line opens a block, its
   * target is the node itself; false when it is a plain value */
  node: boolean;
  status: "fournit" | "transparent";
  /** the layer that provides the value, or that declares the slot */
  winner: LayerName | null;
  target: FlattenedTarget;
}

/** The flattened formalism as the pages render it: the artifact's
 * header lines, then the root entries — each with its nested
 * sections. writeFlattenedLayerSource is this structure,
 * serialized; the harness pins the agreement. */
export interface FlattenedLayerText {
  headerLines: string[];
  sections: FlattenedSection[];
}

/** The complete flattened formalism of a layer, as a structure the
 * page can fold: same walk, same lines — the closure of the dinner
 * serializes to twelve thousand lines, the fold keeps the artifact
 * readable without ever truncating it. */
export function writeFlattenedLayerSections({ space, layer }: { space: Space; layer: LayerName }): FlattenedLayerText {
  const flattened = flattenLayer({ space, layer });
  const buildSections = (node: FlatNode): FlattenedSection[] =>
    node.entries.map((entry) => {
      const provenance = writeFlatProvenance({ status: entry.status, winner: entry.winner });
      const value = entry.status === "fournit" ? writeFlatValue({ value: entry.value }) : null;
      const line =
        value === null
          ? "abstract " + entry.key + "  // " + provenance
          : entry.key + " = " + value + "  // " + provenance;
      const child = entry.target !== null ? node.children[entry.key] : undefined;
      const target: FlattenedTarget =
        entry.target !== null
          ? { layer: node.addr[0], path: [...node.addr[1], entry.key], key: null }
          : { layer: node.addr[0], path: [...node.addr[1]], key: entry.key };
      return {
        key: entry.key,
        value,
        node: entry.target !== null,
        status: entry.status,
        winner: entry.winner,
        target,
        line,
        sections: child ? buildSections(child) : [],
      };
    });
  return {
    headerLines: [
      "// " + layer + " — the complete flattened formalism (a view, never a layer of the corpus)",
      "// " +
        flattened.addrs +
        " nodes · " +
        flattened.keys +
        " keys · " +
        flattened.winners.length +
        " contributing layers · root chain: " +
        flattened.chaîne +
        " layers",
      "// first-winner resolved in place — refines is absent: the hierarchy is what this view removes",
      "layer " + layer + "-flat",
    ],
    sections: buildSections(flattened.root),
  };
}

/** The number of text lines a section renders — its own line (a
 * value may carry embedded newlines) and every descendant's: the
 * folded view counts the lines it hides, honestly. */
export function countFlattenedSectionLines({ section }: { section: FlattenedSection }): number {
  return (
    section.line.split("\n").length +
    section.sections.reduce((total, child) => total + countFlattenedSectionLines({ section: child }), 0)
  );
}

/** The complete serialized text of a flattened structure — the
 * artifact the text view writes. */
export function serializeFlattenedLayerText({ text }: { text: FlattenedLayerText }): string {
  const lines: string[] = [...text.headerLines];
  const walk = (section: FlattenedSection, depth: number) => {
    lines.push("  ".repeat(depth) + section.line);
    section.sections.forEach((child) => walk(child, depth + 1));
  };
  text.sections.forEach((section) => walk(section, 1));
  return lines.join("\n");
}

/** The complete flattened formalism of a layer, as display text:
 * `layer <name>-flat` opens the artifact (the -flat suffix says it
 * is a view, never a new layer of the corpus), then the effective
 * state of every address — the root entries, then one indented
 * block per structural child. `refines` is absent by construction:
 * the hierarchy is exactly what this view removes. */
export function writeFlattenedLayerSource({ space, layer }: { space: Space; layer: LayerName }): string {
  return serializeFlattenedLayerText({ text: writeFlattenedLayerSections({ space, layer }) });
}

