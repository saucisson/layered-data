// The graphical model editor's reading and drafting services.
//
// GENERICITY IS THE CONTRACT: nothing here knows a formalism name.
// Everything the editor sees comes from the refinement chain of the
// model layer, as FORMALISM DATA:
//   - a member container is a root key that DECLARES a collection
//     (`refines @collection`) and whose chain declares a collection
//     `type` (places, transitions, pre_arcs, post_arcs, positions —
//     while union aliases such as vertices/edges/arcs CITE other
//     containers and stay out of the palette);
//   - an arc container's rules are the `container` overrides of the
//     member record's source/target keys (pre: places -> transitions);
//   - the annotations are the abstract record keys of the member
//     type (marking, weight, identifier);
//   - the position container is the one whose record poses x and y.
//
// Every gesture is drafted as SOURCE TEXT for the living layer's
// block, then judged by the staging (stageLayerEdition): the editor
// proposes, the tribunal decides — the block is the only truth, the
// canvas is a reading of it. The bedrock is never edited (ADR-0103):
// only runtime-added layers open here.

import { asLayerName, asLayerPath, type LayerName, type LayerPath } from "../domain/identifiers.ts";
import { AddressView, isDictionary, LayerReference, type Address } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import { resolvePositionAt } from "./positions.ts";

/** One member container of a model, as the formalism declares it. */
export interface MemberContainer {
  name: string;
  /** the address the members refine (`type` of the collection). */
  memberType: Address;
  /** arc containers pose source and target container rules, vertex
   * containers do not — the kind is read, never assumed. */
  kind: "sommet" | "arc";
  /** the formalism-declared source/target container names of an arc
   * container, null for a vertex container. */
  sourceContainer: string | null;
  targetContainer: string | null;
  /** the abstract record keys of the member type, source/target
   * excluded — the annotations the inspector may edit. */
  annotationKeys: string[];
}

/** The written form of an address: `@layer/path/segments`. */
export function referenceTextOf({ address }: { address: Address }): string {
  const path = address[1].length === 0 ? "" : "/" + address[1].join("/");
  return "@" + address[0] + path;
}

/** The record node of a member type, as the formalism poses it —
 * `specification/record` under the type. Null when the chain poses
 * no record: the container stays out of the editor's palette. */
function recordOfMemberType({ space, memberType }: { space: Space; memberType: Address }): Address | null {
  const specification = space.read({
    layer: memberType[0],
    path: memberType[1],
    key: "specification",
  });
  if (!(specification instanceof AddressView)) return null;
  const record = space.read({
    layer: specification.layer,
    path: specification.path,
    key: "record",
  });
  if (!(record instanceof AddressView)) return null;
  return [record.layer, record.path];
}

/** The container name one record key imposes (`source`/`target` pose
 * a `container` override in the formalism) — null when the key poses
 * no container rule. */
function containerRuleOf({ space, record, key }: { space: Space; record: Address; key: string }): string | null {
  const ruleNode = space.read({ layer: record[0], path: record[1], key });
  if (!(ruleNode instanceof AddressView)) return null;
  const rule = space.read({ layer: ruleNode.layer, path: ruleNode.path, key: "container" });
  if (!(rule instanceof AddressView) || rule.path.length === 0) return null;
  return rule.path[rule.path.length - 1] ?? null;
}

/** Does one root key DECLARE a collection (as opposed to citing other
 * containers)? A member container poses `refines @collection` — an
 * alias (`vertices refines @places then @transitions`) cites other
 * containers and stays out of the palette. The discrimination is the
 * language's own declaration idiom, never a name list. */
function declaresCollection({ space, model, name }: { space: Space; model: LayerName; name: string }): boolean {
  const refines = space.read({ layer: model, path: asLayerPath([name]), key: "refines" });
  if (!Array.isArray(refines)) return false;
  return refines.some((entry) =>
    entry instanceof LayerReference
      ? entry.layer === "collection"
      : isDictionary(entry) && entry["layer"] === "collection",
  );
}

/** The member containers of a model layer: every root key that DECLARES
 * a collection (`refines @collection`) and whose chain declares a
 * collection `type`. Union aliases (vertices, edges, arcs — they cite
 * other containers) and plain data stay out: the discrimination is
 * the formalism's own idiom, not a name list. */
export function readMemberContainers({ space, model }: { space: Space; model: string }): MemberContainer[] {
  const containers: MemberContainer[] = [];
  for (const name of space.keys({ layer: asLayerName(model), path: asLayerPath([]) })) {
    if (name.startsWith("__note:")) continue;
    if (!declaresCollection({ space, model: asLayerName(model), name })) continue;
    const memberType = space.read({
      layer: asLayerName(model),
      path: asLayerPath([name, "specification", "collection"]),
      key: "type",
    });
    if (!(memberType instanceof AddressView)) continue;
    const record = recordOfMemberType({ space, memberType: [memberType.layer, memberType.path] });
    if (record === null) continue;
    const recordKeys = space.keys({ layer: record[0], path: record[1] });
    const sourceContainer = containerRuleOf({ space, record, key: "source" });
    const targetContainer = containerRuleOf({ space, record, key: "target" });
    const isArc = sourceContainer !== null && targetContainer !== null;
    containers.push({
      name,
      memberType: [memberType.layer, memberType.path],
      kind: isArc ? "arc" : "sommet",
      sourceContainer,
      targetContainer,
      annotationKeys: recordKeys.filter((recordKey) => !(isArc && (recordKey === "source" || recordKey === "target"))),
    });
  }
  return containers;
}

/** The position container: the vertex container whose record poses
 * x and y — positions-grid and positions-polar both pass, the test
 * is the data, never a layer name. */
export function positionContainerOf({
  containers,
}: {
  containers: readonly MemberContainer[];
}): MemberContainer | null {
  return (
    containers.find(
      (container) =>
        container.kind === "sommet" &&
        container.annotationKeys.includes("x") &&
        container.annotationKeys.includes("y"),
    ) ?? null
  );
}

/** A suggested `refines` clause for a new model, read from the
 * corpus itself — never a hardcoded formalism name: the first layer
 * that declares member containers, plus the first layer that declares
 * a position container (when one exists). */
export function suggestModelRefines({
  space,
  layerNames,
}: {
  space: Space;
  layerNames: readonly string[];
}): string {
  let base: string | null = null;
  let positions: string | null = null;
  for (const layerName of layerNames) {
    const containers = readMemberContainers({ space, model: layerName });
    if (containers.length === 0) continue;
    const positionContainer = positionContainerOf({ containers });
    if (
      base === null &&
      containers.some((container) => container.kind === "sommet" && container.name !== positionContainer?.name)
    ) {
      base = layerName;
    }
    if (positions === null && positionContainer !== null) positions = layerName;
    if (base !== null && positions !== null) break;
  }
  if (base === null) return "";
  return positions !== null && positions !== base
    ? "@" + base + " then @" + positions
    : "@" + base;
}

/** The label key of one arc member: the first of the arc container's
 * declared annotation keys that reads a number at this address — the
 * formalism's own data names the label, never a hardcoded key. */
export function arcLabelKeyOf({
  space,
  model,
  arcContainer,
  arcName,
}: {
  space: Space;
  model: string;
  arcContainer: MemberContainer;
  arcName: string;
}): string | null {
  const layer = asLayerName(model);
  const path = asLayerPath([arcContainer.name, arcName]);
  for (const key of arcContainer.annotationKeys) {
    if (typeof space.read({ layer, path, key }) === "number") return key;
  }
  return null;
}

/** The member names of one container, read through the chain —
 * the cited members surface like the local ones. */
export function readMemberNames({
  space,
  model,
  container,
}: {
  space: Space;
  model: string;
  container: string;
}): string[] {
  return space.keys({ layer: asLayerName(model), path: asLayerPath([container]) });
}

/** A fresh member name inside one container: the container's own
 * name and the next free index — unique, honest about its origin. */
export function nextMemberName({
  space,
  model,
  container,
}: {
  space: Space;
  model: string;
  container: string;
}): string {
  const existing = new Set(readMemberNames({ space, model, container }));
  let index = existing.size + 1;
  while (existing.has(container + index)) index++;
  return container + index;
}

/** The resolved position of a named member of the position container:
 * grid x/y (y optional), polar r/theta (degrees, zero east), and the
 * relative chain (relative_to cites an upstream position and carries
 * an offset) — resolved to the first absolute point, a cycle answers
 * null and nothing is drawn. The resolution idiom is the reader's,
 * as in the workshop's view tree. */
export function readMemberPosition({
  space,
  model,
  positionContainer,
  name,
  visited,
}: {
  space: Space;
  model: string;
  positionContainer: string;
  name: string;
  visited: ReadonlySet<string>;
}): { x: number; y: number } | null {
  return resolvePositionAt({
    space,
    layer: model,
    path: [positionContainer, name],
    visited: new Set(visited),
  });
}

// ---- the source drafting ----------------------------------------------
// Pure text surgery on the living layer's block. The block is the
// truth: every gesture drafts it, the staging judges it whole, the
// accepted edition rewrites the layer in place. The formats are the
// language's own: two-space margins, `extend <container>` sections,
// `name refines <typeReference>` members, `key = value` fields.

const SECTION_PREFIX = "  extend ";
const MEMBER_MARGIN = "    ";
const FIELD_MARGIN = "      ";

interface SectionRange {
  start: number;
  end: number;
}

/** Does one line open the section of the named container? The header
 * is `  extend <container>` — optionally followed by a clause on the
 * same line (`refines @…`, the language's own idiom, as in
 * pn-philosophers-5): the container name must end at a word boundary,
 * never inside a longer name. */
function isSectionHeader({ line, container }: { line: string; container: string }): boolean {
  const trimmed = line.trimEnd();
  if (!trimmed.startsWith(SECTION_PREFIX + container)) return false;
  const rest = trimmed.slice(SECTION_PREFIX.length + container.length);
  return rest.length === 0 || rest.startsWith(" ");
}

/** Is one line any section header (`  extend …`)? */
function isAnySectionHeader({ line }: { line: string }): boolean {
  return line.startsWith(SECTION_PREFIX);
}

/** The line range of one container section of a block: from its
 * `  extend <container>` header to the next section header or the
 * end of the block. */
function sectionRangeOf({ blockLines, container }: { blockLines: string[]; container: string }): SectionRange | null {
  for (let index = 0; index < blockLines.length; index++) {
    if (isSectionHeader({ line: blockLines[index] ?? "", container })) {
      let end = blockLines.length;
      for (let scan = index + 1; scan < blockLines.length; scan++) {
        if (isAnySectionHeader({ line: blockLines[scan] ?? "" })) {
          end = scan;
          break;
        }
      }
      return { start: index, end };
    }
  }
  return null;
}

/** Does one line open the member of the given name? Both idioms count:
 * `    name refines …` and the merge idiom `    extend name …` — the
 * name must end at a word boundary. */
function isMemberHeader({ line, name }: { line: string; name: string }): boolean {
  for (const prefix of [MEMBER_MARGIN + name, MEMBER_MARGIN + "extend " + name]) {
    if (!line.startsWith(prefix)) continue;
    const rest = line.slice(prefix.length);
    if (rest.length === 0 || rest.startsWith(" ")) return true;
  }
  return false;
}

/** Is one line any member header (a key at member margin, not a field)? */
function isAnyMemberHeader({ line }: { line: string }): boolean {
  return line.startsWith(MEMBER_MARGIN) && !line.startsWith(FIELD_MARGIN);
}

/** The line range of one member inside a section: from its
 * `    name refines …` header to the next member header or the end
 * of the section. */
function memberRangeOf({
  blockLines,
  section,
  name,
}: {
  blockLines: string[];
  section: SectionRange;
  name: string;
}): SectionRange | null {
  for (let index = section.start + 1; index < section.end; index++) {
    if (isMemberHeader({ line: blockLines[index] ?? "", name })) {
      let end = section.end;
      for (let scan = index + 1; scan < section.end; scan++) {
        if (isAnyMemberHeader({ line: blockLines[scan] ?? "" })) {
          end = scan;
          break;
        }
      }
      return { start: index, end };
    }
  }
  return null;
}

/** The written form of one field value: numbers bare, references
 * (`@layer/path`) bare — they are addresses, not strings — and any
 * other string quoted, the language's own literal syntax. */
function formatFieldValue({ value }: { value: number | string }): string {
  if (typeof value !== "string") return String(value);
  return value.startsWith("@") ? value : JSON.stringify(value);
}

/** Does one line set the named field? `      key = …` or the compact
 * `      key=…` — the key must end at a word boundary. */
function isFieldLine({ line, key }: { line: string; key: string }): boolean {
  if (!line.startsWith(FIELD_MARGIN + key)) return false;
  const rest = line.slice(FIELD_MARGIN.length + key.length);
  return rest.startsWith(" ") || rest.startsWith("=");
}

/** Draft a block with one member added to a container section: the
 * member refines the container's declared type and carries its
 * fields. A missing section is appended; the rest of the block is
 * untouched — comments included. */
export function draftMemberInsertion({
  block,
  container,
  name,
  typeReference,
  fields,
}: {
  block: string;
  container: string;
  name: string;
  typeReference: string;
  fields: Record<string, number | string>;
}): string {
  const memberLines = [
    MEMBER_MARGIN + name + " refines " + typeReference,
    ...Object.entries(fields).map(([key, value]) => FIELD_MARGIN + key + " = " + formatFieldValue({ value })),
  ];
  const blockLines = block.replace(/\n+$/, "").split("\n");
  const section = sectionRangeOf({ blockLines, container });
  if (section === null) {
    const withSection = [
      ...blockLines,
      SECTION_PREFIX + container,
      ...memberLines,
    ];
    return withSection.join("\n") + "\n";
  }
  const drafted = [
    ...blockLines.slice(0, section.end),
    ...memberLines,
    ...blockLines.slice(section.end),
  ];
  return drafted.join("\n") + "\n";
}

/** Draft a block with one member removed from its container section —
 * the member's whole sub-block leaves, the rest stays. */
export function draftMemberRemoval({
  block,
  container,
  name,
}: {
  block: string;
  container: string;
  name: string;
}): string {
  const blockLines = block.replace(/\n+$/, "").split("\n");
  const section = sectionRangeOf({ blockLines, container });
  if (section === null) return block;
  const member = memberRangeOf({ blockLines, section, name });
  if (member === null) return block;
  const drafted = [...blockLines.slice(0, member.start), ...blockLines.slice(member.end)];
  return drafted.join("\n") + "\n";
}

/** Draft a block with one member removed AND its own position entry
 * removed too: deleting `places/p1` also drops `positions/p1`, so no
 * orphan position lingers in the block. The position container is
 * optional — a model without positions drafts the plain removal. */
export function draftMemberRemovalCascade({
  block,
  container,
  name,
  positionContainer,
}: {
  block: string;
  container: string;
  name: string;
  positionContainer: string | null;
}): string {
  let drafted = draftMemberRemoval({ block, container, name });
  if (positionContainer !== null && positionContainer !== container) {
    drafted = draftMemberRemoval({ block: drafted, container: positionContainer, name });
  }
  return drafted;
}

/** Draft a block with a member's fields set: an existing field line
 * is rewritten in place, a missing one is inserted under the member
 * header. The other fields of the member stay untouched. */
export function draftMemberFieldEdition({
  block,
  container,
  name,
  fields,
}: {
  block: string;
  container: string;
  name: string;
  fields: Record<string, number | string>;
}): string {
  const blockLines = block.replace(/\n+$/, "").split("\n");
  const section = sectionRangeOf({ blockLines, container });
  if (section === null) return block;
  const member = memberRangeOf({ blockLines, section, name });
  if (member === null) return block;
  const edited = [...blockLines];
  const pending = new Map(Object.entries(fields));
  for (let index = member.start + 1; index < member.end; index++) {
    for (const [key, value] of [...pending.entries()]) {
      if (isFieldLine({ line: edited[index] ?? "", key })) {
        edited[index] = FIELD_MARGIN + key + " = " + formatFieldValue({ value });
        pending.delete(key);
      }
    }
  }
  if (pending.size > 0) {
    const insertions = [...pending.entries()].map(
      ([key, value]) => FIELD_MARGIN + key + " = " + formatFieldValue({ value }),
    );
    edited.splice(member.start + 1, 0, ...insertions);
  }
  return edited.join("\n") + "\n";
}

/** Draft the position of a named member: the position container holds
 * one position member per named object; an existing position is
 * edited in place (its other fields stay), a missing one is inserted
 * with the position type the formalism declares. */
export function draftMemberPosition({
  block,
  positionContainer,
  name,
  x,
  y,
  typeReference,
}: {
  block: string;
  positionContainer: string;
  name: string;
  x: number;
  y: number;
  typeReference: string;
}): string {
  const blockLines = block.replace(/\n+$/, "").split("\n");
  const section = sectionRangeOf({ blockLines, container: positionContainer });
  const existingMember =
    section !== null ? memberRangeOf({ blockLines, section, name }) : null;
  if (existingMember !== null && section !== null) {
    return draftMemberFieldEdition({
      block,
      container: positionContainer,
      name,
      fields: { x, y },
    });
  }
  return draftMemberInsertion({
    block,
    container: positionContainer,
    name,
    typeReference,
    fields: { x, y },
  });
}

/** The arc container the formalism poses for one direction: the
 * container whose source and target rules match the two vertex
 * containers — pre for places -> transitions, post the other way.
 * The answer is formalism data; no direction is hardcoded. */
export function arcContainerBetween({
  containers,
  fromContainer,
  toContainer,
}: {
  containers: readonly MemberContainer[];
  fromContainer: string;
  toContainer: string;
}): MemberContainer | null {
  return (
    containers.find(
      (container) =>
        container.kind === "arc" &&
        container.sourceContainer === fromContainer &&
        container.targetContainer === toContainer,
    ) ?? null
  );
}

/** The references of one member, as an arc's source or target poses
 * it: `@<model>/<container>/<member>`. */
export function memberReferenceText({
  model,
  container,
  member,
}: {
  model: string;
  container: string;
  member: string;
}): string {
  return "@" + model + "/" + container + "/" + member;
}

/** One citation of a member by another member: the citing member's
 * container and name, and the key through which it cites (source,
 * target, relative_to, … — any key posing a reference). */
export interface MemberCitation {
  container: string;
  name: string;
  via: string;
}

/** The members that cite one member, read through the chain — EVERY
 * key of every member is scanned, not only the arcs' source/target:
 * a position's `relative_to` cites its upstream seat just as much.
 * The kernel judges declared EXPECTATIONS, not reference integrity:
 * deleting a cited member betrays no `tests` line and the staging
 * accepts it. The editor still holds the gesture at the palette —
 * not as a second tribunal, as an AFFORDANCE: the message names the
 * citing members, the language mode edits the raw truth, and the
 * deletion goes through once the citing members have left. */
export function readMemberCitations({
  space,
  model,
  containers,
  container,
  name,
}: {
  space: Space;
  model: string;
  containers: readonly MemberContainer[];
  container: string;
  name: string;
}): MemberCitation[] {
  const citations: MemberCitation[] = [];
  const modelLayer = asLayerName(model);
  for (const citingContainer of containers) {
    for (const citingName of space.keys({ layer: modelLayer, path: asLayerPath([citingContainer.name]) })) {
      if (citingContainer.name === container && citingName === name) continue;
      for (const key of space.keys({ layer: modelLayer, path: asLayerPath([citingContainer.name, citingName]) })) {
        if (key.startsWith("__note:")) continue;
        const reference = space.read({
          layer: modelLayer,
          path: asLayerPath([citingContainer.name, citingName]),
          key,
        });
        if (
          reference instanceof AddressView &&
          reference.layer === modelLayer &&
          reference.path.length === 2 &&
          reference.path[0] === container &&
          reference.path[1] === name
        ) {
          citations.push({ container: citingContainer.name, name: citingName, via: key });
        }
      }
    }
  }
  return citations;
}

/** The type reference of an address' tail, as a member's `refines`
 * poses it: `@<layer>/<path…>` with a leading type path preserved. */
export function typeReferenceText({ address }: { address: Address }): string {
  return referenceTextOf({ address });
}

export type { LayerName, LayerPath };
