// The layered-data kernel: the space.
//
// A space is an assembled stack of layers. Layers refine each other;
// reading at an address walks the refinement chain and returns the
// first-winner value. The kernel is TOTAL: it never throws, it reports
// through the typed diagnostics channel. The only mutable state of the
// whole codebase lives here — the touch journal and the generation
// counters — because invalidatable memoization IS the mechanism.
//
// In scope: per-address closures, first-winner reads, anchors by
// prefix, multi-refinement aliasing (unions), reference resolution
// (re-rooting), invalidatable memoization (touch journal,
// generations, O(1) fast path on an immutable space),
// desugaring support (topological ordering + implicits, late binding
// preserved) and the generic checks (containers, cardinality).
// Out of scope: lens checks.

import {
  type LayerName,
  type LayerPath,
  type PathSegment,
  asLayerName,
  asLayerPath,
} from "./identifiers.ts";
import { fact, type MessageFact } from "./messages.ts";
import {
  type Address,
  AddressView,
  LayerReference,
  PathReference,
  type RawTree,
  type RawValue,
  isDictionary,
} from "./addresses.ts";
import { SPECIAL_KEYS } from "./specialKeys.ts";

/** One trace event of a closure or resolution walk. */
export type TraceEvent = { kind: string; depth?: number } & Record<string, any>;

// ------------------------------------------------------------ trace
/** Collects the events of one traced computation (panel ③ reads them). */
export class Tracer {
  events: TraceEvent[] = [];
  depth = 0;
  record(event: TraceEvent): void {
    event.depth = this.depth;
    this.events.push(event);
  }
}

/** Formats a refinement entry for a trace event — references become
 * plain data, so traces stay serializable and inspectable. */
export function formatEntryForTrace(entry: RawValue): any {
  if (entry instanceof PathReference) return { ref: [entry.anchor, entry.path] };
  if (entry instanceof LayerReference) return { lref: entry.layer };
  return entry;
}

// ------------------------------------------------------------ space
// The invalidatable memo: touch journal, generations, frames.
// Every memo entry carries its own dependencies (layer, path),
// collected during the computation by the raw reads; touch(layer,
// path) lazily invalidates every entry whose dependency lives under
// the touched path. On an immutable space no event is ever recorded:
// the generation fast path validates everything in O(1).
class ClosureFrame {
  collectedDependencies = new Set<number>(); // dependencies collected (interned address ids)
  tainted = false; // a cycle re-entry marked this frame
}

/** One memoized closure: the result, its dependencies, its generation. */
export interface ClosureMemoEntry {
  list: Address[];
  deps: Set<number>; // interned (layer, path) ids of the dependencies
  gen: number;
}

/** Public view of the closure memo. The kernel keys the memo by
 * interned address ids (one number per (layer, path)); the outside
 * world (tests, workbench) addresses entries by the "layer|a/b"
 * string key. The view interns on the fly — a string key resolves
 * to the same id the kernel used, so has/get/set stay correct. */
class ClosureMemoView {
  private space: Space;
  constructor(space: Space) {
    this.space = space;
  }

  get size(): number {
    return this.space.memoMap.size;
  }
  has(key: number | string): boolean {
    return this.space.memoMap.has(this.space.memoKeyToId(key));
  }
  get(key: number | string): ClosureMemoEntry | undefined {
    return this.space.memoMap.get(this.space.memoKeyToId(key));
  }
  set(key: number | string, entry: ClosureMemoEntry): this {
    this.space.memoMap.set(this.space.memoKeyToId(key), entry);
    return this;
  }
  delete(key: number | string): boolean {
    return this.space.memoMap.delete(this.space.memoKeyToId(key));
  }
  clear(): void {
    this.space.memoMap.clear();
  }
  values(): IterableIterator<ClosureMemoEntry> {
    return this.space.memoMap.values();
  }
  keys(): string[] {
    return Array.from(this.space.memoMap.keys(), (id) => this.space.pathKeyOf(id));
  }
  entries(): Array<[string, ClosureMemoEntry]> {
    return Array.from(this.space.memoMap, ([id, entry]) => [this.space.pathKeyOf(id), entry]);
  }
  forEach(fn: (entry: ClosureMemoEntry, key: string) => void): void {
    for (const [id, entry] of this.space.memoMap) fn(entry, this.space.pathKeyOf(id));
  }
}

/** What a read reports about one closure source (the flatten view and
 * the panels read this scan; the status values are kernel behavior). */
export interface ReadObservation {
  source: Address;
  status: string;
  raw?: any;
}

/** One diagnostic of the total kernel — observed, never thrown. */
export interface Diagnostic {
  kind: string;
  address: Address;
  fact: MessageFact;
}

export class Space {
  layers: Record<string, RawTree>;
  frames = new Map<number, ClosureFrame>(); // closures in flight (cycle guard, keyed by address id)
  frameStack: number[] = [];
  // The closure memo. Without it, every read recomputed its whole
  // chain — and long chains cost seconds per render. Each entry
  // carries its dependencies and its generation: the memo can be
  // invalidated entry by entry, lazily, without a global flush.
  // Hot side: keyed by interned address ids; `closureMemo` below is
  // the string-keyed public view over this same table.
  memoMap = new Map<number, ClosureMemoEntry>();
  closureMemo = new ClosureMemoView(this);

  /** The frame on top of the stack, if any. */
  private currentFrame(): ClosureFrame | undefined {
    const topId = this.frameStack[this.frameStack.length - 1];
    return topId === undefined ? undefined : this.frames.get(topId);
  }
  touched: number[] = []; // the touch journal (interned event id per event)
  journalBase = 0; // events purged from the journal
  // ---- address interning. Every (layer, path) becomes one number:
  // a node of a global trie whose root is 0 and whose first level
  // is the layers. Interning a child from its parent is O(1), a
  // dependency is one integer, and the touch-prefix test becomes a
  // parent-chain walk — no string is built on the hot paths anymore.
  private segIds = new Map<string, number>(); // segment string -> sym
  private segNames: string[] = []; // sym -> segment string
  private nodeParent: number[] = [-1]; // trie node -> parent node (root = 0)
  private nodeSeg: number[] = [-1]; // trie node -> segment sym (layer name for a layer node)
  private nodeChild: Array<Map<number, number>> = [new Map()]; // trie node -> children (sym -> node)
  private layerNodeIds = new Map<string, number>(); // layer name -> its trie node
  // The observation collector: while an observation is open, every
  // closure and raw read lands in the active dependency set — the
  // caller (the validation session) learns WHAT its observation
  // read, and can invalidate it against the touch journal with the
  // same event-covers-dependency rule the memo uses. Null when no
  // observation is open: the hot paths pay one property check.
  private observationDeps: Set<number> | null = null;
  // The diagnostics channel. The kernel stays total — it never
  // throws — but every ignored event is recorded here: typed data,
  // deduplicated by (kind, address, fact), deterministic order.
  // The channel is a pure observer: it changes no result. The
  // kernel records, it does not judge — severity is a policy of
  // the workbench, never of the kernel.
  diagnostics: Diagnostic[] = [];
  private seenDiagnostics = new Set<string>();

  /** Open a dependency observation. Every closure and raw read
   * until the matching endObservation is recorded as a dependency
   * key in the returned set; the generation is the journal's
   * watermark at the opening — isObservationStale answers whether
   * any event since covers any recorded dependency, exactly the
   * rule the memo applies to its own entries. */
  beginObservation(): { deps: Set<number>; gen: number } {
    this.observationDeps = new Set<number>();
    return { deps: this.observationDeps, gen: this.touched.length + this.journalBase };
  }

  /** Close the observation (the set keeps what was read). */
  endObservation(): void {
    this.observationDeps = null;
  }

  /** Is an observation (its dependency set, its journal watermark)
   * stale? The same scan isMemoEntryValid applies to memo entries. */
  isObservationStale({ deps, gen }: { deps: Set<number>; gen: number }): boolean {
    const eventCount = this.touched.length + this.journalBase;
    for (
      let eventIndex = Math.max(gen, this.journalBase);
      eventIndex < eventCount;
      eventIndex += 1
    ) {
      const eventId = this.touched[eventIndex - this.journalBase];
      if (eventId === undefined) continue;
      for (const dependency of deps) {
        if (this.eventCovers(eventId, dependency)) {
          return true;
        }
      }
    }
    return false;
  }

  recordDiagnostic({
    kind,
    address,
    fact,
  }: {
    kind: string;
    address: Address;
    fact: MessageFact;
  }): void {
    const factKey =
      fact.code + "\u0001" + (fact.params === undefined ? "" : JSON.stringify(fact.params));
    const deduplicationKey =
      kind + "\u0001" + address[0] + "\u0001" + address[1].join("\u0001") + "\u0001" + factKey;
    if (this.seenDiagnostics.has(deduplicationKey)) return;
    this.seenDiagnostics.add(deduplicationKey);
    this.diagnostics.push({ kind, address: [address[0], [...address[1]]], fact });
  }

  constructor(layers: Record<string, RawTree>) {
    this.layers = layers;
  }

  // --------------------------------------------- address interning
  /** The sym (small integer) of one segment — or layer name. */
  private internSeg(segment: string): number {
    let sym = this.segIds.get(segment);
    if (sym === undefined) {
      sym = this.segNames.length;
      this.segNames.push(segment);
      this.segIds.set(segment, sym);
    }
    return sym;
  }

  /** The trie node of one (layer, path) — interning every node on
   * the way down. The node IS the address: two equal addresses get
   * the same number, forever. */
  internPathId(layer: LayerName, path: LayerPath): number {
    let node: number | undefined = this.layerNodeIds.get(layer);
    if (node === undefined) {
      const sym = this.internSeg(layer);
      const rootChildren = this.nodeChild[0];
      if (rootChildren === undefined)
        throw new Error("trie root missing: nodeChild[0] is always initialized");
      let layerNode: number | undefined = rootChildren.get(sym);
      if (layerNode === undefined) {
        layerNode = this.newTrieNode(0, sym);
        rootChildren.set(sym, layerNode);
      }
      this.layerNodeIds.set(layer, layerNode);
      node = layerNode;
    }
    let current: number = node;
    for (const segment of path) {
      const children = this.nodeChild[current];
      if (children === undefined)
        throw new Error("trie node missing: nodeChild[" + current + "] is always initialized");
      const sym = this.internSeg(segment);
      let child: number | undefined = children.get(sym);
      if (child === undefined) {
        child = this.newTrieNode(current, sym);
        children.set(sym, child);
      }
      current = child;
    }
    return current;
  }

  private newTrieNode(parent: number, sym: number): number {
    const node = this.nodeParent.length;
    this.nodeParent.push(parent);
    this.nodeSeg.push(sym);
    this.nodeChild.push(new Map());
    return node;
  }

  /** A memo key — number (internal) or "layer|a/b" (external) — to
   * its interned id. */
  memoKeyToId(key: number | string): number {
    if (typeof key === "number") return key;
    const bar = key.indexOf("|");
    const rest = key.slice(bar + 1);
    return this.internPathId(
      asLayerName(key.slice(0, bar)),
      (rest === "" ? [] : rest.split("/")) as LayerPath,
    );
  }

  /** The "layer|a/b" string of one interned id (addressKey format). */
  pathKeyOf(id: number): string {
    const syms: number[] = [];
    for (let node = id; node !== 0; node = this.nodeParent[node] ?? 0)
      syms.push(this.nodeSeg[node] ?? -1);
    syms.reverse();
    const [firstSym, ...restSyms] = syms;
    if (firstSym === undefined) return "|";
    let key = (this.segNames[firstSym] ?? "") + "|";
    for (let i = 0; i < restSyms.length; i++)
      key += (i > 0 ? "/" : "") + (this.segNames[restSyms[i] ?? -1] ?? "");
    return key;
  }

  /** Does the event (an interned touch prefix) cover the dependency
   * (an interned address)? The exact-prefix test is a parent-chain
   * walk: an empty-path event is the layer node, ancestor of every
   * address of the layer; a path event covers its descendants only
   * at segment boundaries — never "places" over "places2". */
  private eventCovers(eventId: number, dependencyId: number): boolean {
    for (let node = dependencyId; node !== 0; node = this.nodeParent[node] ?? 0) {
      if (node === eventId) return true;
    }
    return false;
  }

  static addressKey({ layer, path }: { layer: LayerName; path: LayerPath }): string {
    return layer + "|" + path.join("/");
  }

  // A dependency (layer, path): \u0001 between segments, \u0002 at the
  // end — so that a touch PREFIX stays exact (the prefix "places"
  // never covers "places2").
  static dependencyKey({ layer, path }: { layer: LayerName; path: LayerPath }): string {
    return layer + "\u0001" + path.join("\u0001") + "\u0002";
  }

  static eventKey({ layer, path }: { layer: LayerName; path: LayerPath }): string {
    return layer + "\u0001" + path.join("\u0001");
  }

  // Does the event (layer, pathPrefix) cover the dependency? The
  // prefix must be an exact path prefix, same layer; an empty path
  // covers the whole layer.
  static eventCoversDependency({
    event,
    eventPathLength,
    dependency,
  }: {
    event: string;
    eventPathLength: number;
    dependency: string;
  }): boolean {
    if (eventPathLength === 0) return dependency.startsWith(event);
    return dependency.startsWith(event + "\u0001") || dependency === event + "\u0002";
  }

  // ------------------------------------------- incremental invalidation
  // Write protocol: an addition declares the added path (zero
  // invalidation — nothing memoized consulted it, the new closures
  // are computed on demand); a removal or restructure declares the
  // parent; a value write declares the written node's path.
  touch({ layer, path = [] }: { layer: LayerName; path?: LayerPath }): void {
    this.touched.push(this.internPathId(layer, path));
    // Purge: events older than the oldest memo entry can never
    // invalidate anyone anymore.
    if (this.memoMap.size) {
      let oldestGeneration = Infinity;
      for (const entry of this.memoMap.values()) {
        if (entry.gen < oldestGeneration) oldestGeneration = entry.gen;
      }
      if (oldestGeneration > this.journalBase) {
        const purged = oldestGeneration - this.journalBase;
        this.touched.splice(0, purged);
        this.journalBase += purged;
      }
    }
  }

  // An entry is valid iff no touch posterior to its computation
  // covers one of its dependencies. O(1) fast path: computed after
  // the last event. An entry that survives the check re-stamps its
  // generation — the events it verified against cannot cover it,
  // it no longer needs to look at them.
  private isMemoEntryValid(entry: ClosureMemoEntry): boolean {
    const eventCount = this.touched.length + this.journalBase;
    if (entry.gen === eventCount) return true;
    for (
      let eventIndex = Math.max(entry.gen, this.journalBase);
      eventIndex < eventCount;
      eventIndex++
    ) {
      const eventId = this.touched[eventIndex - this.journalBase];
      if (eventId === undefined) continue;
      for (const dependency of entry.deps) {
        if (this.eventCovers(eventId, dependency)) {
          return false;
        }
      }
    }
    entry.gen = eventCount;
    return true;
  }

  // Memo entries whose dependency was covered by a posterior touch —
  // their keys, in Map order.
  staleMemoKeys(): string[] {
    const keys: string[] = [];
    for (const [id, entry] of this.memoMap) {
      if (!this.isMemoEntryValid(entry)) keys.push(this.pathKeyOf(id));
    }
    return keys;
  }

  raw({ layer, path }: { layer: LayerName; path: LayerPath }): RawTree | null {
    // Every raw read during a closure is a dependency (layer, path)
    // of the entry being computed — and of any open observation.
    this.observationDeps?.add(this.internPathId(layer, path));
    this.currentFrame()?.collectedDependencies.add(this.internPathId(layer, path));
    let node: any = this.layers[layer];
    if (node === undefined) return null;
    for (const segment of path) {
      if (!isDictionary(node)) return null;
      node = node[segment];
      if (node === undefined) return null;
    }
    return isDictionary(node) ? node : null;
  }

  // Raw (unresolved) value of a key, first-winner — desugaring uses
  // it to copy implicits entries without resolving them (late
  // binding preserved). Port of the original `_raw_value`.
  rawValue({ layer, path, key }: { layer: LayerName; path: LayerPath; key: string }): RawValue {
    for (const [sourceLayer, sourcePath] of this.closure({ layer, path })) {
      const node = this.raw({ layer: sourceLayer, path: sourcePath });
      if (isDictionary(node) && key in node) {
        const value = node[key];
        if (value !== null && value !== undefined) return value;
      }
    }
    return null;
  }

  // ---------------------------------------------------------- anchors
  anchorsAt({
    layer,
    path,
    tracer,
  }: {
    layer: LayerName;
    path: LayerPath;
    tracer: Tracer | null;
  }): string[] {
    const key = this.internPathId(layer, path);
    if (this.frames.has(key)) return []; // in flight: unknown, skip
    const anchors: string[] = [];
    for (const [sourceLayer, sourcePath] of this.closure({ layer, path, tracer })) {
      const anchor = sourcePath.length
        ? (sourcePath[sourcePath.length - 1] ?? sourceLayer)
        : sourceLayer;
      if (!anchors.includes(anchor)) anchors.push(anchor);
    }
    return anchors;
  }

  // ------------------------------------------------------- closures
  // trace=true bypasses the memo for THIS level only (panel ③ needs
  // the depth-1 events); nested levels use the memo — their events
  // are of depth ≥ 2, filtered by the panel anyway.
  closure({
    layer,
    path,
    tracer = null,
    trace = false,
  }: {
    layer: LayerName;
    path: LayerPath;
    tracer?: Tracer | null;
    trace?: boolean;
  }): Address[] {
    this.observationDeps?.add(this.internPathId(layer, path));
    const key = this.internPathId(layer, path);
    if (!trace) {
      const entry = this.memoMap.get(key);
      if (entry !== undefined && this.isMemoEntryValid(entry)) {
        // Composition: the parent inherits the dependencies of the
        // entry it reads — otherwise its own memo would be blind.
        const parentFrame = this.currentFrame();
        if (parentFrame !== undefined) {
          for (const dependency of entry.deps) parentFrame.collectedDependencies.add(dependency);
        }
        return entry.list;
      }
    }
    if (this.frames.has(key)) {
      // Cycle guard: taint the re-entered frame and those above it.
      const reentryIndex = this.frameStack.indexOf(key);
      for (let i = reentryIndex; i < this.frameStack.length; i++) {
        const frameId = this.frameStack[i];
        if (frameId === undefined) continue;
        this.frames.get(frameId)!.tainted = true;
      }
      // A truncated closure is not mute. The guard records [layer,
      // path] — the pair being closed; reading special keys of the
      // flattened view (specification, bindings) can lead here:
      // the guard records, it does not decide.
      this.recordDiagnostic({
        kind: "garde-de-cycle",
        address: [layer, path],
        fact: fact("cycle-guard"),
      });
      return [];
    }
    if (tracer) tracer.depth++;
    const frame = new ClosureFrame();
    // The own raw node is always read: dependency on the own path.
    frame.collectedDependencies.add(this.internPathId(layer, path));
    this.frames.set(key, frame);
    this.frameStack.push(key);
    let result: Address[];
    try {
      result = this.computeClosure({ layer, path, id: key, tracer });
    } finally {
      this.frameStack.pop();
      this.frames.delete(key);
      // The parent inherits the collected dependencies — even from a
      // tainted frame: one must know what it read, to avoid memoizing
      // a result born from a truncated computation.
      const parentFrame = this.currentFrame();
      if (parentFrame !== undefined) {
        for (const dependency of frame.collectedDependencies) {
          parentFrame.collectedDependencies.add(dependency);
        }
      }
      if (tracer) tracer.depth--;
    }
    // A tainted frame is not memoized (faithful port: a result born
    // from a cycle guard depends on the call order).
    if (!frame.tainted) {
      this.memoMap.set(key, {
        list: result,
        deps: new Set(frame.collectedDependencies),
        gen: this.touched.length + this.journalBase,
      });
    }
    return result;
  }

  refinesAt({ address, tracer }: { address: Address; tracer: Tracer | null }): RawValue[] {
    for (const [layer, path] of this.closure({ layer: address[0], path: address[1], tracer })) {
      const node = this.raw({ layer, path });
      if (isDictionary(node) && "refines" in node) return node["refines"] as RawValue[];
    }
    return [];
  }

  private computeClosure({
    layer,
    path,
    id,
    tracer,
  }: {
    layer: LayerName;
    path: LayerPath;
    id: number;
    tracer: Tracer | null;
  }): Address[] {
    const currentAddress: Address = [layer, path];
    tracer?.record({ kind: "start", addr: currentAddress });

    // ---- base: own node + the father's members, in the father's order
    const base: Address[] = [];
    if (this.raw({ layer, path }) !== null) base.push([layer, path]);
    const lastSegment = path[path.length - 1];
    if (path.length && lastSegment !== undefined) {
      for (const [parentLayer, parentPath] of this.closure({
        layer,
        path: path.slice(0, -1),
        tracer,
      })) {
        const candidate: Address = [parentLayer, [...parentPath, lastSegment]];
        if (
          (parentLayer !== layer || this.internPathId(parentLayer, parentPath) !== id) &&
          this.raw({ layer: candidate[0], path: candidate[1] }) !== null
        ) {
          base.push(candidate);
        }
      }
    }
    tracer?.record({
      kind: "base",
      own: this.raw({ layer, path }) !== null,
      fatherMembers: base.slice(1).map((address) => [address[0], address[1]]),
    });

    // ---- the address's refines: the first base member defining them
    let entries: RawValue[] = [];
    let entriesHolder: Address = currentAddress;
    let entriesFrom: Address | null = null;
    for (const baseAddress of base) {
      const node = this.raw({ layer: baseAddress[0], path: baseAddress[1] });
      if (isDictionary(node) && "refines" in node) {
        entries = node["refines"] as RawValue[];
        if (baseAddress[0] === layer) {
          entriesHolder = [layer, baseAddress[1]];
        } else if (
          baseAddress[1].length > 1 &&
          this.raw({ layer: baseAddress[0], path: baseAddress[1].slice(0, -1) }) !== null
        ) {
          entriesHolder = [layer, baseAddress[1]];
        } else {
          entriesHolder = currentAddress;
        }
        entriesFrom = baseAddress;
        break;
      }
    }
    tracer?.record({
      kind: "entries",
      from: entriesFrom,
      holder: entriesHolder,
      entries: entries.map(formatEntryForTrace),
    });

    const output: Address[] = [];
    const seen = new Set<number>();

    const normalize = (targetAddress: Address): Address | null => {
      if (this.raw({ layer: targetAddress[0], path: targetAddress[1] }) === null) {
        const closure = this.closure({ layer: targetAddress[0], path: targetAddress[1], tracer });
        return closure.length ? (closure[0] ?? null) : null;
      }
      return targetAddress;
    };

    const pushTarget = (address: Address, viewAddress: Address) => {
      const key = this.internPathId(address[0], address[1]);
      if (seen.has(key)) return;
      seen.add(key);
      output.push(address);
      tracer?.record({ kind: "push", addr: address, vaddr: viewAddress, via: "cible" });
      // Partial shadow of a union: every concrete source of the
      // designated view participates.
      for (const source of this.closure({ layer: viewAddress[0], path: viewAddress[1], tracer })) {
        const sourceKey = this.internPathId(source[0], source[1]);
        if (!seen.has(sourceKey)) {
          seen.add(sourceKey);
          output.push(source);
          tracer?.record({ kind: "push", addr: source, via: "union" });
        }
      }
      for (const entry of this.refinesAt({ address: viewAddress, tracer })) {
        const resolved = this.resolveRefinementEntry({ entry, holder: viewAddress, tracer });
        if (resolved === null) continue;
        const normalized = normalize(resolved[0]);
        if (normalized === null) {
          this.recordDiagnostic({
            kind: "entrée-ignorée",
            address: viewAddress,
            fact: fact("no-concrete-target"),
          });
          continue;
        }
        pushTarget(normalized, resolved[1]);
      }
    };

    // ---- 1) own node
    const ownAddress = base[0];
    if (ownAddress !== undefined) {
      seen.add(this.internPathId(ownAddress[0], ownAddress[1]));
      output.push(ownAddress);
      tracer?.record({ kind: "push", addr: ownAddress, via: "propre" });
    }
    // ---- 2) the refinement chain of the address
    for (const entry of entries) {
      const resolved = this.resolveRefinementEntry({ entry, holder: entriesHolder, tracer });
      if (resolved === null) continue;
      const normalized = normalize(resolved[0]);
      if (normalized === null) {
        this.recordDiagnostic({
          kind: "entrée-ignorée",
          address: currentAddress,
          fact: fact("no-concrete-target"),
        });
        continue;
      }
      pushTarget(normalized, resolved[1]);
    }
    // ---- 3) the father's members, without re-expansion
    for (const baseAddress of base.slice(1)) {
      const key = this.internPathId(baseAddress[0], baseAddress[1]);
      if (!seen.has(key)) {
        seen.add(key);
        output.push(baseAddress);
        tracer?.record({ kind: "push", addr: baseAddress, via: "membre-du-père" });
      }
    }
    tracer?.record({
      kind: "done",
      addr: currentAddress,
      out: output.map((address) => [address[0], address[1]]),
    });
    return output;
  }

  // ------------------------------------------------------ resolutions
  /** Resolve one refinement entry against a holder address. Public:
   * the application lint pass resolves root entries to inspect the
   * refinement order. Returns [designated, resolved] or null. */
  resolveRefinementEntry({
    entry,
    holder,
    tracer,
  }: {
    entry: RawValue;
    holder: Address;
    tracer: Tracer | null;
  }): [Address, Address] | null {
    if (entry instanceof LayerReference) {
      const root: Address = [entry.layer, asLayerPath([])];
      return [root, root];
    }
    if (entry instanceof PathReference) {
      const resolved = this.resolveReference({ reference: entry, holder, tracer });
      if (resolved === null) {
        // An ignored entry is recorded with its reason — the
        // behavior is unchanged, the ignorance becomes listable.
        this.recordDiagnostic({
          kind: "entrée-ignorée",
          address: holder,
          fact: fact("ref-not-found", { ref: entry.anchor + "::" + entry.path.join("/") }),
        });
        return null;
      }
      if (Array.isArray(resolved)) return [resolved as Address, resolved as Address];
      this.recordDiagnostic({
        kind: "entrée-ignorée",
        address: holder,
        fact: fact("ref-scalar", { ref: entry.anchor + "::" + entry.path.join("/") }),
      });
      return null; // scalar: not an address
    }
    this.recordDiagnostic({
      kind: "entrée-ignorée",
      address: holder,
      fact: fact("entry-not-designating", { entry: JSON.stringify(formatEntryForTrace(entry)) }),
    });
    return null;
  }

  resolveReference({
    reference,
    holder,
    tracer,
  }: {
    reference: PathReference;
    holder: Address;
    tracer: Tracer | null;
  }): Address | RawValue | null {
    const holderLayer = holder[0];
    const holderPath = holder[1];
    const search: any[] = [];
    let result: any = "introuvable";
    for (let prefixLength = holderPath.length; prefixLength >= 0; prefixLength--) {
      const prefix = holderPath.slice(0, prefixLength);
      const anchors = this.anchorsAt({ layer: holderLayer, path: prefix, tracer });
      const anchorFound = anchors.includes(reference.anchor);
      search.push({ prefix, anchors, hit: anchorFound });
      if (!anchorFound) continue;
      let position: Address;
      if (prefixLength === 0) {
        // Root anchor: a layer name.
        const chain = this.closure({ layer: holderLayer, path: asLayerPath([]), tracer }).map(
          (address) => address[0],
        );
        const anchorInChain = chain.includes(reference.anchor);
        position = anchorInChain
          ? [holderLayer, asLayerPath([])]
          : [reference.anchor, asLayerPath([])];
        search[search.length - 1].reroot = anchorInChain ? "vue-courante" : "couche-étrangère";
      } else {
        position = [holderLayer, prefix];
      }
      for (const segment of reference.path) {
        // Path reads: untraced (only the anchor search of this
        // reference is traced).
        const value = this.read({
          layer: position[0],
          path: position[1],
          key: segment,
        });
        if (value === null) {
          tracer?.record({
            kind: "refsearch",
            ref: [reference.anchor, reference.path],
            holder,
            search,
            result: "chemin interrompu",
          });
          return null;
        }
        if (value instanceof AddressView) {
          position = [value.layer, value.path];
        } else {
          tracer?.record({
            kind: "refsearch",
            ref: [reference.anchor, reference.path],
            holder,
            search,
            result: value,
          });
          return value; // scalar at the end of the path
        }
      }
      tracer?.record({
        kind: "refsearch",
        ref: [reference.anchor, reference.path],
        holder,
        search,
        result: [position[0], position[1]],
      });
      return position;
    }
    tracer?.record({
      kind: "refsearch",
      ref: [reference.anchor, reference.path],
      holder,
      search,
      result,
    });
    return null;
  }

  // Dedicated trace: resolution of one reference, outside a closure.
  traceReferenceResolution({
    reference,
    holder,
  }: {
    reference: PathReference;
    holder: Address;
  }): any {
    const tracer = new Tracer();
    tracer.depth++; // the events of this search are at depth 1
    const result = this.resolveReference({ reference, holder, tracer });
    return { result, events: tracer.events };
  }

  // -------------------------------------------------------- readings
  private valueOf({
    layer,
    path,
    key,
    raw,
    tracer,
  }: {
    layer: LayerName;
    path: LayerPath;
    key: string;
    raw: RawValue;
    tracer: Tracer | null;
  }): RawValue {
    if (isDictionary(raw)) return new AddressView(layer, [...path, key as PathSegment]);
    if (raw instanceof LayerReference) return new AddressView(raw.layer, asLayerPath([]));
    if (raw instanceof PathReference) {
      const resolved = this.resolveReference({ reference: raw, holder: [layer, path], tracer });
      if (resolved === null) return null;
      if (Array.isArray(resolved)) {
        const resolvedAddress = resolved as Address;
        return new AddressView(resolvedAddress[0], resolvedAddress[1]);
      }
      return resolved;
    }
    return raw;
  }

  read({
    layer,
    path,
    key,
    tracer = null,
    scan = null,
  }: {
    layer: LayerName;
    path: LayerPath;
    key: string;
    tracer?: Tracer | null;
    scan?: ReadObservation[] | null;
  }): RawValue {
    for (const [sourceLayer, sourcePath] of this.closure({ layer, path, tracer })) {
      const node = this.raw({ layer: sourceLayer, path: sourcePath });
      if (node !== null && key in node) {
        const raw = node[key];
        if (raw !== null && raw !== undefined) {
          scan?.push({ source: [sourceLayer, sourcePath], status: "fournit", raw });
          return this.valueOf({ layer, path, key, raw, tracer });
        }
      }
      const status = node !== null && key in node ? "transparent" : "absent";
      scan?.push({ source: [sourceLayer, sourcePath], status });
    }
    return null;
  }

  // The optional nodes collector receives, in closure order, the raw
  // node of each scanned source — one scan feeds the keys AND the
  // caller (the observed walk), the node is never walked twice.
  keys({
    layer,
    path,
    tracer = null,
    nodes = null,
  }: {
    layer: LayerName;
    path: LayerPath;
    tracer?: Tracer | null;
    nodes?: (RawTree | null)[] | null;
  }): string[] {
    const collected: string[] = [];
    const seen = new Set<string>();
    for (const [sourceLayer, sourcePath] of this.closure({ layer, path, tracer })) {
      const node = this.raw({ layer: sourceLayer, path: sourcePath });
      nodes?.push(node);
      if (isDictionary(node)) {
        for (const key of Object.keys(node)) {
          if (!(SPECIAL_KEYS as readonly string[]).includes(key) && !seen.has(key)) {
            seen.add(key);
            collected.push(key);
          }
        }
      }
    }
    return collected;
  }
}
