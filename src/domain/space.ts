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
// generations, O(1) fast path on an immutable space), the opaque mask,
// desugaring support (topological ordering + implicits, late binding
// preserved) and the generic checks (containers, cardinality).
// Out of scope: lens checks.

import { type LayerName, type LayerPath, type PathSegment, asLayerPath } from "./identifiers.ts";
import { fact, type MessageFact } from "./messages.ts";
import { type Address, AddressView, LayerReference, MASK, PathReference, type RawTree, type RawValue, isDictionary,  } from "./addresses.ts";
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
  collectedDependencies = new Set<string>(); // dependencies collected (depKey)
  tainted = false; // a cycle re-entry marked this frame
}

/** One memoized closure: the result, its dependencies, its generation. */
export interface ClosureMemoEntry {
  list: Address[];
  deps: Set<string>;
  gen: number;
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
  frames = new Map<string, ClosureFrame>(); // closures in flight (cycle guard)
  frameStack: string[] = [];
  // The closure memo. Without it, every read recomputed its whole
  // chain — and long chains cost seconds per render. Each entry
  // carries its dependencies and its generation: the memo can be
  // invalidated entry by entry, lazily, without a global flush.
  closureMemo = new Map<string, ClosureMemoEntry>();
  touched: string[] = []; // the touch journal (evKey per event)
  journalBase = 0; // events purged from the journal
  // The diagnostics channel. The kernel stays total — it never
  // throws — but every ignored event is recorded here: typed data,
  // deduplicated by (kind, address, fact), deterministic order.
  // The channel is a pure observer: it changes no result. The
  // kernel records, it does not judge — severity is a policy of
  // the workbench, never of the kernel.
  diagnostics: Diagnostic[] = [];
  private seenDiagnostics = new Set<string>();

  recordDiagnostic({ kind, address, fact }: { kind: string; address: Address; fact: MessageFact }): void {
    const factKey = fact.code + "\u0001" + (fact.params === undefined ? "" : JSON.stringify(fact.params));
    const deduplicationKey =
      kind + "\u0001" + address[0] + "\u0001" + address[1].join("\u0001") + "\u0001" + factKey;
    if (this.seenDiagnostics.has(deduplicationKey)) return;
    this.seenDiagnostics.add(deduplicationKey);
    this.diagnostics.push({ kind, address: [address[0], [...address[1]]], fact });
  }

  constructor(layers: Record<string, RawTree>) {
    this.layers = layers;
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
  static eventCoversDependency({ event, eventPathLength, dependency }: { event: string; eventPathLength: number; dependency: string }): boolean {
    if (eventPathLength === 0) return dependency.startsWith(event);
    return dependency.startsWith(event + "\u0001") || dependency === event + "\u0002";
  }

  // ------------------------------------------- incremental invalidation
  // Write protocol: an addition declares the added path (zero
  // invalidation — nothing memoized consulted it, the new closures
  // are computed on demand); a removal or restructure declares the
  // parent; a value write declares the written node's path.
  touch({ layer, path = [] }: { layer: LayerName; path?: LayerPath }): void {
    this.touched.push(Space.eventKey({ layer, path }));
    // Purge: events older than the oldest memo entry can never
    // invalidate anyone anymore.
    if (this.closureMemo.size) {
      let oldestGeneration = Infinity;
      for (const entry of this.closureMemo.values()) {
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
      const event = this.touched[eventIndex - this.journalBase];
      const eventPathLength = event.length - event.indexOf("\u0001") - 1;
      for (const dependency of entry.deps) {
        if (
          Space.eventCoversDependency({
            event,
            eventPathLength,
            dependency,
          })
        ) {
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
    for (const [key, entry] of this.closureMemo) {
      if (!this.isMemoEntryValid(entry)) keys.push(key);
    }
    return keys;
  }

  raw({ layer, path }: { layer: LayerName; path: LayerPath }): RawTree | typeof MASK | null {
    // Every raw read during a closure is a dependency (layer, path)
    // of the entry being computed.
    if (this.frameStack.length) {
      this.frames
        .get(this.frameStack[this.frameStack.length - 1])!
        .collectedDependencies.add(Space.dependencyKey({ layer, path }));
    }
    let node: any = this.layers[layer];
    if (node === undefined) return null;
    for (const segment of path) {
      if (node === MASK) return MASK;
      if (!isDictionary(node)) return null;
      node = node[segment];
      if (node === undefined) return null;
    }
    return node === MASK || isDictionary(node) ? node : null;
  }

  // Raw (unresolved) value of a key, first-winner — desugaring uses
  // it to copy implicits entries without resolving them (late
  // binding preserved). Port of the original `_raw_value`.
  rawValue({ layer, path, key }: { layer: LayerName; path: LayerPath; key: string }): RawValue {
    for (const [sourceLayer, sourcePath] of this.closure({ layer, path })) {
      const node = this.raw({ layer: sourceLayer, path: sourcePath });
      if (isDictionary(node) && key in node && node[key] !== null) {
        return node[key];
      }
    }
    return null;
  }

  // ---------------------------------------------------------- anchors
  anchorsAt({ layer, path, tracer }: { layer: LayerName; path: LayerPath; tracer: Tracer | null }): string[] {
    const key = Space.addressKey({ layer, path });
    if (this.frames.has(key)) return []; // in flight: unknown, skip
    const anchors: string[] = [];
    for (const [sourceLayer, sourcePath] of this.closure({ layer, path, tracer })) {
      const anchor = sourcePath.length ? sourcePath[sourcePath.length - 1] : sourceLayer;
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
    const key = Space.addressKey({ layer, path });
    if (!trace) {
      const entry = this.closureMemo.get(key);
      if (entry !== undefined && this.isMemoEntryValid(entry)) {
        // Composition: the parent inherits the dependencies of the
        // entry it reads — otherwise its own memo would be blind.
        if (this.frameStack.length) {
          const parentFrame = this.frames.get(this.frameStack[this.frameStack.length - 1])!;
          for (const dependency of entry.deps) parentFrame.collectedDependencies.add(dependency);
        }
        return entry.list;
      }
    }
    if (this.frames.has(key)) {
      // Cycle guard: taint the re-entered frame and those above it.
      const reentryIndex = this.frameStack.indexOf(key);
      for (let i = reentryIndex; i < this.frameStack.length; i++) {
        this.frames.get(this.frameStack[i])!.tainted = true;
      }
      // A truncated closure is not mute. The guard records [layer,
      // path] — the pair being closed; reading special keys of the
      // flattened view (specification, bindings) can lead here:
      // the guard records, it does not decide.
      this.recordDiagnostic({ kind: "garde-de-cycle", address: [layer, path], fact: fact("cycle-guard") });
      return [];
    }
    if (tracer) tracer.depth++;
    const frame = new ClosureFrame();
    // The own raw node is always read: dependency on the own path.
    frame.collectedDependencies.add(Space.dependencyKey({ layer, path }));
    this.frames.set(key, frame);
    this.frameStack.push(key);
    let result: Address[];
    try {
      result = this.computeClosure({ layer, path, tracer });
    } finally {
      this.frameStack.pop();
      this.frames.delete(key);
      // The parent inherits the collected dependencies — even from a
      // tainted frame: one must know what it read, to avoid memoizing
      // a result born from a truncated computation.
      if (this.frameStack.length) {
        const parentFrame = this.frames.get(this.frameStack[this.frameStack.length - 1])!;
        for (const dependency of frame.collectedDependencies) {
          parentFrame.collectedDependencies.add(dependency);
        }
      }
      if (tracer) tracer.depth--;
    }
    // A tainted frame is not memoized (faithful port: a result born
    // from a cycle guard depends on the call order).
    if (!frame.tainted) {
      this.closureMemo.set(key, {
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

  private computeClosure({ layer, path, tracer }: { layer: LayerName; path: LayerPath; tracer: Tracer | null }): Address[] {
    const currentAddress: Address = [layer, path];
    tracer?.record({ kind: "start", addr: currentAddress });

    // ---- base: own node + the father's members, in the father's order
    const base: Address[] = [];
    if (this.raw({ layer, path }) !== null) base.push([layer, path]);
    if (path.length) {
      for (const [parentLayer, parentPath] of this.closure({
        layer,
        path: path.slice(0, -1),
        tracer,
      })) {
        const candidate: Address = [parentLayer, [...parentPath, path[path.length - 1]]];
        if (
          (parentLayer !== layer || parentPath.join("/") !== path.join("/")) &&
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
    const seen = new Set<string>();

    const normalize = (targetAddress: Address): Address | null => {
      if (this.raw({ layer: targetAddress[0], path: targetAddress[1] }) === null) {
        const closure = this.closure({ layer: targetAddress[0], path: targetAddress[1], tracer });
        return closure.length ? closure[0] : null;
      }
      return targetAddress;
    };

    const pushTarget = (address: Address, viewAddress: Address) => {
      const key = Space.addressKey({ layer: address[0], path: address[1] });
      if (seen.has(key)) return;
      seen.add(key);
      output.push(address);
      tracer?.record({ kind: "push", addr: address, vaddr: viewAddress, via: "cible" });
      // Partial shadow of a union: every concrete source of the
      // designated view participates.
      for (const source of this.closure({ layer: viewAddress[0], path: viewAddress[1], tracer })) {
        const sourceKey = Space.addressKey({ layer: source[0], path: source[1] });
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
          this.recordDiagnostic({ kind: "entrée-ignorée", address: viewAddress, fact: fact("no-concrete-target") });
          continue;
        }
        pushTarget(normalized, resolved[1]);
      }
    };

    // ---- 1) own node
    if (base.length) {
      seen.add(Space.addressKey({ layer: base[0][0], path: base[0][1] }));
      output.push(base[0]);
      tracer?.record({ kind: "push", addr: base[0], via: "propre" });
    }
    // ---- 2) the refinement chain of the address
    for (const entry of entries) {
      const resolved = this.resolveRefinementEntry({ entry, holder: entriesHolder, tracer });
      if (resolved === null) continue;
      const normalized = normalize(resolved[0]);
      if (normalized === null) {
        this.recordDiagnostic({ kind: "entrée-ignorée", address: currentAddress, fact: fact("no-concrete-target") });
        continue;
      }
      pushTarget(normalized, resolved[1]);
    }
    // ---- 3) the father's members, without re-expansion
    for (const baseAddress of base.slice(1)) {
      const key = Space.addressKey({ layer: baseAddress[0], path: baseAddress[1] });
      if (!seen.has(key)) {
        seen.add(key);
        output.push(baseAddress);
        tracer?.record({ kind: "push", addr: baseAddress, via: "membre-du-père" });
      }
    }
    tracer?.record({ kind: "done", addr: currentAddress, out: output.map((address) => [address[0], address[1]]) });
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
      if (resolved === MASK) {
        this.recordDiagnostic({
          kind: "entrée-ignorée",
          address: holder,
          fact: fact("ref-masked", { ref: entry.anchor + "::" + entry.path.join("/") }),
        });
        return null;
      }
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
  }): Address | RawValue | typeof MASK | null {
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
        position = anchorInChain ? [holderLayer, asLayerPath([])] : [reference.anchor, asLayerPath([])];
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
        if (value === MASK) {
          tracer?.record({
            kind: "refsearch",
            ref: [reference.anchor, reference.path],
            holder,
            search,
            result: "MASK",
          });
          return MASK;
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
  traceReferenceResolution({ reference, holder }: { reference: PathReference; holder: Address }): any {
    const tracer = new Tracer();
    tracer.depth++; // the events of this search are at depth 1
    const result = this.resolveReference({ reference, holder, tracer });
    return { result, events: tracer.events };
  }

  // -------------------------------------------------------- readings
  private valueOf({ layer, path, key, raw, tracer }: { layer: LayerName; path: LayerPath; key: string; raw: RawValue; tracer: Tracer | null }): RawValue {
    if (isDictionary(raw)) return new AddressView(layer, [...path, key as PathSegment]);
    if (raw instanceof LayerReference) return new AddressView(raw.layer, asLayerPath([]));
    if (raw instanceof PathReference) {
      const resolved = this.resolveReference({ reference: raw, holder: [layer, path], tracer });
      if (resolved === null) return null;
      if (Array.isArray(resolved)) return new AddressView(resolved[0], resolved[1]);
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
      // Opaque mask: short-circuits before any key (unlike the
      // transparent abstract slot null).
      if (node === MASK) {
        scan?.push({ source: [sourceLayer, sourcePath], status: "masqué" });
        return MASK;
      }
      if (node !== null && key in node && node[key] !== null) {
        const raw = node[key];
        scan?.push({
          source: [sourceLayer, sourcePath],
          status: "fournit",
          raw: raw === MASK ? "MASK" : raw,
        });
        if (raw === MASK) return MASK;
        return this.valueOf({ layer, path, key, raw, tracer });
      }
      const status = node !== null && key in node ? "transparent" : "absent";
      scan?.push({ source: [sourceLayer, sourcePath], status });
    }
    return null;
  }

  keys({ layer, path, tracer = null }: { layer: LayerName; path: LayerPath; tracer?: Tracer | null }): string[] {
    const collected: string[] = [];
    for (const [sourceLayer, sourcePath] of this.closure({ layer, path, tracer })) {
      const node = this.raw({ layer: sourceLayer, path: sourcePath });
      if (isDictionary(node)) {
        for (const key of Object.keys(node)) {
          if (!(SPECIAL_KEYS as readonly string[]).includes(key) && !collected.includes(key)) {
            collected.push(key);
          }
        }
      }
    }
    // A key read as MASK is not visible (masked keys excluded).
    const visible: string[] = [];
    for (const key of collected) {
      if (this.read({ layer, path, key, tracer }) !== MASK) visible.push(key);
    }
    return visible;
  }
}
