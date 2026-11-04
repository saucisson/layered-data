// The check registry and every semantic check.
//
// The registry extends beyond the two generic checks of the original
// kernel — that divergence is recorded. One rule throughout: a check
// is a TAG carried by the data; only the registry resolving it lives
// here. The tag names and the error messages are kernel behavior:
// they are what the panels display, so they stay in French.
//
//   - dag / arbre: hoisted into the kernel — same algorithms, same
//     messages, driven per-address on the arcs (source/target).
//   - simple / nonempty / sperner / k-partite: the checks of the
//     hypergraph layers (E is a set of non-empty parts, unique edges)
//     generalized from the ordered pair to the set of ends.
//
// A generic check reads NO domain name in hard — neither collection,
// nor role, nor layer name. It declares its slots; the carrying
// layers bind them under the special key `bindings` (an abstract slot
// at the generic level, bound by the formalism that fixes it),
// first-winner per slot across the closure. The registry knows only
// the algorithm and the slot contract; an unbound slot is never
// guessed — the check withdraws, recording check-vacant.
//
// The placement rule follows from the closure: a binding lives at the
// level where the check READS it. Layer-level checks (simple,
// nonempty, sperner, k-partite, connectivity) read their operands at
// the root — their bindings live at roots. Arc checks (oriented, dag)
// and the ordered pair read at the arc address — their bindings live
// on the TYPE: the type is in the arc's closure, the root never is.
// A renaming follows for free: the renaming formalism rebinds the slot.

import { type LayerName, type LayerPath, asPathSegment } from "./identifiers.ts";
import { type Address, AddressView, MASK, type RawValue, addressesEqual, isDictionary,  } from "./addresses.ts";
import { Space } from "./space.ts";
import { designatedAddress } from "./desugaring.ts";
import { walkAddresses } from "./views.ts";
import { fact } from "./messages.ts";

// ---- address algebra (shared vocabulary of the checks) --------------

// Membership is enumeration: value ∈ container iff the concrete node
// designated by the value is also designated by a member of the
// container. The shortcut holds only for a direct child — port of the
// original `member_of`.
function isMemberOf({ space, value, container }: { space: Space; value: AddressView; container: AddressView }): boolean {
  const containerPath = container.path;
  if (
    value.layer === container.layer &&
    value.path.length === containerPath.length + 1 &&
    containerPath.every((segment, index) => value.path[index] === segment)
  ) {
    return true;
  }
  const wanted = designatedAddress({ space, layer: value.layer, path: value.path });
  if (wanted === null) return false;
  for (const key of space.keys({ layer: container.layer, path: container.path })) {
    if (
      addressesEqual(
        designatedAddress({
          space,
          layer: container.layer,
          path: [...containerPath, asPathSegment(key)],
        }),
        wanted,
      )
    ) {
      return true;
    }
  }
  return false;
}

// Repr of a view — mirror of the original `AddrView.__repr__`
// ("%s::%s", "/" join or ".").
function addressViewRepr(view: AddressView): string {
  return view.layer + "::" + (view.path.join("/") || ".");
}

// Minimal Python %r (check parameters are integers).
function pythonRepr(value: any): string {
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return "'" + value + "'";
  return String(value);
}

// The concrete node designated by a view — mirror of the original
// `node_of`: the first closure source, or the view's own address.
function concreteNodeOf({ space, view }: { space: Space; view: AddressView }): Address {
  const designated = designatedAddress({ space, layer: view.layer, path: view.path });
  return designated !== null ? designated : [view.layer, view.path];
}

// str() of a Python (layer, path) tuple — the check messages quote it.
function pythonTupleRepr(address: Address): string {
  return (
    "('" + address[0] + "', (" + address[1].map((segment) => "'" + segment + "'").join(", ") +
    (address[1].length === 1 ? "," : "") + "))"
  );
}

// ---- the two generic checks of the original kernel -------------------

// Record check: every field with a `container` must reference an
// element of that container — port of `check_containers`.
function checkContainers({ space, view }: { space: Space; view: AddressView }): string[] {
  const specification = space.read({ layer: view.layer, path: view.path, key: "specification" });
  if (!(specification instanceof AddressView)) return [];
  const record = space.read({ layer: specification.layer, path: specification.path, key: "record" });
  if (!(record instanceof AddressView)) return [];
  const errors: string[] = [];
  for (const field of space.keys({ layer: record.layer, path: record.path })) {
    const fieldSpecification = space.read({ layer: record.layer, path: record.path, key: field });
    if (!(fieldSpecification instanceof AddressView)) continue;
    const container = space.read({
      layer: fieldSpecification.layer,
      path: fieldSpecification.path,
      key: "container",
    });
    if (!(container instanceof AddressView)) continue;
    const value = space.read({ layer: view.layer, path: view.path, key: field });
    if (value === null || value === MASK || !(value instanceof AddressView)) continue;
    if (!isMemberOf({ space, value, container })) {
      errors.push(
        "conteneur: champ '" + field + "' = " + addressViewRepr(value) + " hors de " + addressViewRepr(container),
      );
    }
  }
  return errors;
}

// Collection check: minimum/maximum read across the view (inherited) —
// port of `check_cardinality`.
function checkCardinality({ space, view }: { space: Space; view: AddressView }): string[] {
  const specification = space.read({ layer: view.layer, path: view.path, key: "specification" });
  if (!(specification instanceof AddressView)) return [];
  const collection = space.read({
    layer: specification.layer,
    path: specification.path,
    key: "collection",
  });
  if (!(collection instanceof AddressView)) return [];
  const minimum = space.read({ layer: collection.layer, path: collection.path, key: "minimum" });
  const maximum = space.read({ layer: collection.layer, path: collection.path, key: "maximum" });
  if (minimum === null && maximum === null) return [];
  const count = space.keys({ layer: view.layer, path: view.path }).length;
  const errors: string[] = [];
  if (minimum !== null && count < minimum) {
    errors.push("cardinalité: " + count + " < min=" + pythonRepr(minimum));
  }
  if (maximum !== null && count > maximum) {
    errors.push("cardinalité: " + count + " > max=" + pythonRepr(maximum));
  }
  return errors;
}

// ---- slot bindings ---------------------------------------------------

// First-winner bound value of a slot across the closure of an address.
function boundSlotValue({ space, view, slot }: { space: Space; view: AddressView; slot: string }): RawValue {
  for (const [sourceLayer, sourcePath] of space.closure({ layer: view.layer, path: view.path })) {
    const node = space.raw({ layer: sourceLayer, path: sourcePath });
    if (
      isDictionary(node) &&
      isDictionary(node["bindings"]) &&
      (node["bindings"] as Record<string, RawValue>)[slot] != null
    ) {
      return (node["bindings"] as Record<string, RawValue>)[slot];
    }
  }
  return null;
}

// ---- the end algebra of edges and arcs -------------------------------

// The ends of an edge = its arrows → vertices, deduplicated; a masked
// arrow is neutralized (mirror of checkContainers' neutralization);
// empty: the edge declares no visible arrow. The arrow and
// vertex-role names are resolved by the CALLER (at the check's
// invocation level) and passed as parameters — the edge address is
// too deep to see the roots.
function edgeEnds({ space, view, arrows, vertexRole }: { space: Space; view: AddressView; arrows: string; vertexRole: string }): { ends: Address[]; empty: boolean } {
  const arrowPath = [...view.path, asPathSegment(arrows)];
  const arrowKeys = space.keys({ layer: view.layer, path: arrowPath });
  const ends: Address[] = [];
  for (const arrowKey of arrowKeys) {
    const vertex = space.read({
      layer: view.layer,
      path: [...arrowPath, asPathSegment(arrowKey)],
      key: vertexRole,
    });
    if (vertex === null || vertex === MASK || !(vertex instanceof AddressView)) continue;
    const concrete = concreteNodeOf({ space, view: vertex });
    if (!ends.some((existing) => addressesEqual(existing, concrete))) ends.push(concrete);
  }
  return { ends, empty: arrowKeys.length === 0 };
}

// The ordered pair (source, target) — the multidigraph idiom. The role
// names are bindings (`end-source` / `end-target`), never constants —
// and the binding lives on the TYPE, not at the root: the type is in
// the arc's closure, the root never is. Resolved at the arc address,
// first-winner across its closure.
function orderedEnds({ space, view }: { space: Space; view: AddressView }): [Address, Address] | null {
  const sourceRole = boundSlotValue({ space, view, slot: "end-source" });
  const targetRole = boundSlotValue({ space, view, slot: "end-target" });
  if (sourceRole === null || targetRole === null) return null;
  const source = space.read({ layer: view.layer, path: view.path, key: sourceRole as string });
  const target = space.read({ layer: view.layer, path: view.path, key: targetRole as string });
  if (source instanceof AddressView && target instanceof AddressView) {
    return [concreteNodeOf({ space, view: source }), concreteNodeOf({ space, view: target })];
  }
  return null;
}

// ---- the extended checks ---------------------------------------------

// simple (generalized): unique edges. Layer level; the view designated
// by the `edges` binding (the alias, if any) is authoritative; ordered
// (binding `ordered`) → ordered pair + loop (the "simple digraph");
// else → set of ends + intra-edge repetition forbidden (an edge is a
// SET of vertices, not a multiset).
function checkSimple({ space, view }: { space: Space; view: AddressView }): string[] {
  const edgesSlot = boundSlotValue({ space, view, slot: "edges" });
  if (edgesSlot === null) {
    space.recordDiagnostic({ kind: "check-vacant", address: [view.layer, view.path], fact: fact("edges-slot-unbound") });
    return [];
  }
  const arrowsSlot = boundSlotValue({ space, view, slot: "arrows" });
  const vertexSlot = boundSlotValue({ space, view, slot: "arrow-vertex" });
  const edges = space.read({ layer: view.layer, path: view.path, key: edgesSlot as string });
  if (!(edges instanceof AddressView)) return [];
  // Order is a binding (true bound by multidigraph, false by the
  // base) — no layer name is tested here.
  const directed = boundSlotValue({ space, view, slot: "ordered" }) === true;
  const errors: string[] = [];
  const seen: { key: string; signature: string }[] = [];
  for (const edgeKey of space.keys({ layer: edges.layer, path: edges.path })) {
    const edgeView = new AddressView(edges.layer, [...edges.path, asPathSegment(edgeKey)]);
    if (arrowsSlot !== null && space.read({ layer: edgeView.layer, path: edgeView.path, key: arrowsSlot as string }) === MASK) {
      continue;
    }
    if (directed) {
      const pair = orderedEnds({ space, view: edgeView });
      if (pair === null) continue;
      const [source, target] = pair;
      if (addressesEqual(source, target)) {
        errors.push("simple: boucle (" + edgeKey + " : " + pythonTupleRepr(source) + ")");
        continue;
      }
      const signature =
        source[0] + "\u0001" + source[1].join("\u0001") + "\u0002" + target[0] + "\u0001" + target[1].join("\u0001");
      const duplicate = seen.find((entry) => entry.signature === signature);
      if (duplicate) {
        errors.push(
          "simple: arête multiple (" + duplicate.key + " == " + edgeKey + " : (" +
            pythonTupleRepr(source) + ", " + pythonTupleRepr(target) + "))",
        );
      } else seen.push({ key: edgeKey, signature });
    } else {
      // Intra-edge repetition: the RAW arrows, before deduplication.
      if (arrowsSlot === null || vertexSlot === null) {
        space.recordDiagnostic({
          kind: "check-vacant",
          address: [view.layer, view.path],
          fact: fact("slots-unbound", { slots: "arrows / arrow-vertex" }),
        });
        continue;
      }
      const arrowPath = [...edgeView.path, asPathSegment(arrowsSlot as string)];
      const rawEnds: Address[] = [];
      let repeated = false;
      for (const arrowKey of space.keys({ layer: view.layer, path: arrowPath })) {
        const vertex = space.read({
          layer: view.layer,
          path: [...arrowPath, asPathSegment(arrowKey)],
          key: vertexSlot as string,
        });
        if (vertex === null || vertex === MASK || !(vertex instanceof AddressView)) continue;
        const concrete = concreteNodeOf({ space, view: vertex });
        if (rawEnds.some((existing) => addressesEqual(existing, concrete))) {
          errors.push("simple: sommet répété (" + edgeKey + " : " + pythonTupleRepr(concrete) + ")");
          repeated = true;
          break;
        }
        rawEnds.push(concrete);
      }
      if (repeated) continue;
      const ends = edgeEnds({ space, view: edgeView, arrows: arrowsSlot as string, vertexRole: vertexSlot as string });
      if (ends.empty) continue; // empty: that is the nonempty check
      const signature = ends.ends
        .map((address) => address[0] + "\u0001" + address[1].join("\u0001"))
        .sort()
        .join("\u0002");
      const duplicate = seen.find((entry) => entry.signature === signature);
      if (duplicate) {
        errors.push(
          "simple: arête multiple (" + duplicate.key + " == " + edgeKey + " : {" +
            ends.ends.map(pythonTupleRepr).join(", ") + "})",
        );
      } else seen.push({ key: edgeKey, signature });
    }
  }
  return errors;
}

// nonempty: E is a set of non-empty parts — every edge has at least
// one visible arrow.
function checkNonempty({ space, view }: { space: Space; view: AddressView }): string[] {
  const edgesSlot = boundSlotValue({ space, view, slot: "edges" });
  const arrowsSlot = boundSlotValue({ space, view, slot: "arrows" });
  const vertexSlot = boundSlotValue({ space, view, slot: "arrow-vertex" });
  if (edgesSlot === null || arrowsSlot === null || vertexSlot === null) {
    space.recordDiagnostic({
      kind: "check-vacant",
      address: [view.layer, view.path],
      fact: fact("slots-unbound", { slots: "edges / arrows / arrow-vertex" }),
    });
    return [];
  }
  const edges = space.read({ layer: view.layer, path: view.path, key: edgesSlot as string });
  if (!(edges instanceof AddressView)) return [];
  const errors: string[] = [];
  for (const edgeKey of space.keys({ layer: edges.layer, path: edges.path })) {
    const edgeView = new AddressView(edges.layer, [...edges.path, asPathSegment(edgeKey)]);
    if (space.read({ layer: edgeView.layer, path: edgeView.path, key: arrowsSlot as string }) === MASK) continue;
    const ends = edgeEnds({ space, view: edgeView, arrows: arrowsSlot as string, vertexRole: vertexSlot as string });
    if (ends.empty) errors.push("nonempty: arête vide (" + edgeKey + ")");
  }
  return errors;
}

// oriented: no pair of opposite arcs — the strict sense of "oriented
// graph" (without 2-cycles), per arc address.
function checkOriented({ space, view }: { space: Space; view: AddressView }): string[] {
  if (view.path.length < 2) return [];
  const pair = orderedEnds({ space, view });
  if (pair === null) return [];
  const [source, target] = pair;
  const container = new AddressView(view.layer, view.path.slice(0, -1));
  for (const siblingKey of space.keys({ layer: container.layer, path: container.path })) {
    const sibling = orderedEnds({
      space,
      view: new AddressView(view.layer, [...container.path, asPathSegment(siblingKey)]),
    });
    if (sibling !== null && addressesEqual(sibling[0], target) && addressesEqual(sibling[1], source)) {
      return [
        "oriented: 2-cycle (" + pythonTupleRepr(source) + " ⇝ " + pythonTupleRepr(target) + " et inverse)",
      ];
    }
  }
  return [];
}

// sperner: antichain — no edge contains another.
function checkSperner({ space, view }: { space: Space; view: AddressView }): string[] {
  const edgesSlot = boundSlotValue({ space, view, slot: "edges" });
  if (edgesSlot === null) {
    space.recordDiagnostic({ kind: "check-vacant", address: [view.layer, view.path], fact: fact("edges-slot-unbound") });
    return [];
  }
  const edges = space.read({ layer: view.layer, path: view.path, key: edgesSlot as string });
  if (!(edges instanceof AddressView)) return [];
  const sets: { key: string; endKeys: Set<string> }[] = [];
  const arrowsSlot = boundSlotValue({ space, view, slot: "arrows" });
  const vertexSlot = boundSlotValue({ space, view, slot: "arrow-vertex" });
  for (const edgeKey of space.keys({ layer: edges.layer, path: edges.path })) {
    const edgeView = new AddressView(edges.layer, [...edges.path, asPathSegment(edgeKey)]);
    if (
      arrowsSlot === null ||
      space.read({ layer: edgeView.layer, path: edgeView.path, key: arrowsSlot as string }) === MASK
    ) {
      continue;
    }
    const ends = edgeEnds({ space, view: edgeView, arrows: arrowsSlot as string, vertexRole: vertexSlot as string });
    if (ends.empty) continue;
    sets.push({
      key: edgeKey,
      endKeys: new Set(ends.ends.map((address) => address[0] + "\u0001" + address[1].join("\u0001"))),
    });
  }
  const errors: string[] = [];
  for (const first of sets) {
    for (const second of sets) {
      if (first === second || first.endKeys.size <= second.endKeys.size) continue;
      let isSuperset = true;
      for (const endKey of second.endKeys) {
        if (!first.endKeys.has(endKey)) {
          isSuperset = false;
          break;
        }
      }
      if (isSuperset) errors.push("sperner: " + first.key + " contient " + second.key);
    }
  }
  return errors;
}

// k-partite: the vertices partition into k classes — the concrete
// sources of the `vertices` view (the partition alias: places/
// transitions, left/right…); every edge touches at most one vertex
// per class. Without a declared partition (a simple collection) the
// check stays silent; a vertex outside the partition is the
// containers' business; mask = neutralized.
function checkKPartite({ space, view }: { space: Space; view: AddressView }): string[] {
  const verticesSlot = boundSlotValue({ space, view, slot: "vertices" });
  const edgesSlot = boundSlotValue({ space, view, slot: "edges" });
  const arrowsSlot = boundSlotValue({ space, view, slot: "arrows" });
  const vertexSlot = boundSlotValue({ space, view, slot: "arrow-vertex" });
  if (verticesSlot === null || edgesSlot === null || arrowsSlot === null || vertexSlot === null) {
    space.recordDiagnostic({
      kind: "check-vacant",
      address: [view.layer, view.path],
      fact: fact("slots-unbound", { slots: "vertices / edges / arrows / arrow-vertex" }),
    });
    return [];
  }
  const vertices = space.read({ layer: view.layer, path: view.path, key: verticesSlot as string });
  const edges = space.read({ layer: view.layer, path: view.path, key: edgesSlot as string });
  if (!(vertices instanceof AddressView) || !(edges instanceof AddressView)) return [];
  const classes: { address: Address; key: string; name: string }[] = [];
  for (const source of space.closure({ layer: vertices.layer, path: vertices.path })) {
    const [sourceLayer, sourcePath] = source;
    if (sourcePath.length === 0) continue; // abstract root
    if (sourcePath.length === 1 && sourcePath[0] === "vertices") continue; // not a partition
    const key = sourceLayer + "\u0001" + sourcePath.join("\u0001");
    if (!classes.some((candidate) => candidate.key === key)) {
      classes.push({ address: source, key, name: sourcePath[sourcePath.length - 1] });
    }
  }
  if (!classes.length) return [];
  const errors: string[] = [];
  for (const edgeKey of space.keys({ layer: edges.layer, path: edges.path })) {
    const edgeView = new AddressView(edges.layer, [...edges.path, asPathSegment(edgeKey)]);
    if (space.read({ layer: edgeView.layer, path: edgeView.path, key: arrowsSlot as string }) === MASK) continue;
    const arrowPath = [...edgeView.path, asPathSegment(arrowsSlot as string)];
    const touchedClasses = new Map<string, { count: number; name: string }>();
    for (const arrowKey of space.keys({ layer: view.layer, path: arrowPath })) {
      const vertex = space.read({
        layer: view.layer,
        path: [...arrowPath, asPathSegment(arrowKey)],
        key: vertexSlot as string,
      });
      if (vertex === null || vertex === MASK || !(vertex instanceof AddressView)) continue;
      const concrete = concreteNodeOf({ space, view: vertex });
      const matchingClass = classes.find(
        (candidate) =>
          concrete[0] === candidate.address[0] &&
          candidate.address[1].length <= concrete[1].length &&
          candidate.address[1].every((segment, index) => concrete[1][index] === segment),
      );
      if (matchingClass === undefined) continue; // outside the partition: containers' business
      const previous = touchedClasses.get(matchingClass.key);
      touchedClasses.set(matchingClass.key, {
        count: (previous?.count ?? 0) + 1,
        name: matchingClass.name,
      });
    }
    for (const { count, name } of touchedClasses.values()) {
      if (count > 1) {
        errors.push("k-partite: l'arête " + edgeKey + " touche " + count + " sommets de la classe '" + name + "'");
      }
    }
  }
  return errors;
}

// Acyclicity: forward DFS from target; if source is reached, cycle
// (hoisted from the original kernel).
function checkAcyclic({ space, view }: { space: Space; view: AddressView }): string[] {
  const pair = orderedEnds({ space, view });
  if (pair === null || view.path.length < 2) return [];
  const [source, target] = pair;
  const container = new AddressView(view.layer, view.path.slice(0, -1));
  const seen = new Set<string>();
  const stack: Address[] = [target];
  while (stack.length) {
    const current = stack.pop()!;
    if (addressesEqual(current, source)) {
      return ["dag: cycle (" + pythonTupleRepr(source) + " ⇝ … ⇝ " + pythonTupleRepr(target) + ")"];
    }
    const currentKey = current[0] + "\u0001" + current[1].join("\u0001");
    if (seen.has(currentKey)) continue;
    seen.add(currentKey);
    for (const siblingKey of space.keys({ layer: container.layer, path: container.path })) {
      const siblingView = new AddressView(view.layer, [...container.path, asPathSegment(siblingKey)]);
      const siblingPair = orderedEnds({ space, view: siblingView });
      if (siblingPair !== null && addressesEqual(siblingPair[0], current)) stack.push(siblingPair[1]);
    }
  }
  return [];
}

// Connectivity (undirected): every vertex reachable (hoisted from the
// original kernel).
function checkConnected({ space, view }: { space: Space; view: AddressView }): string[] {
  const verticesSlot = boundSlotValue({ space, view, slot: "vertices" });
  const edgesSlot = boundSlotValue({ space, view, slot: "edges" });
  if (verticesSlot === null || edgesSlot === null) {
    space.recordDiagnostic({
      kind: "check-vacant",
      address: [view.layer, view.path],
      fact: fact("slots-unbound", { slots: "vertices / edges" }),
    });
    return [];
  }
  const vertices = space.read({ layer: view.layer, path: view.path, key: verticesSlot as string });
  const edges = space.read({ layer: view.layer, path: view.path, key: edgesSlot as string });
  if (!(vertices instanceof AddressView) || !(edges instanceof AddressView)) {
    return [];
  }
  const vertexKeys = space.keys({ layer: vertices.layer, path: vertices.path });
  if (!vertexKeys.length) return [];
  const nodeKey = (address: Address) => address[0] + "\u0001" + address[1].join("\u0001");
  const keyOfNode = new Map<string, string>();
  const adjacency = new Map<string, Set<string>>();
  for (const vertexKey of vertexKeys) {
    keyOfNode.set(
      nodeKey(concreteNodeOf({ space, view: new AddressView(vertices.layer, [...vertices.path, asPathSegment(vertexKey)]) })),
      vertexKey,
    );
    adjacency.set(vertexKey, new Set());
  }
  for (const edgeKey of space.keys({ layer: edges.layer, path: edges.path })) {
    const edgeView = new AddressView(edges.layer, [...edges.path, asPathSegment(edgeKey)]);
    const pair = orderedEnds({ space, view: edgeView });
    if (pair === null) continue;
    const firstKey = keyOfNode.get(nodeKey(pair[0]));
    const secondKey = keyOfNode.get(nodeKey(pair[1]));
    if (firstKey !== undefined && secondKey !== undefined && firstKey !== secondKey) {
      adjacency.get(firstKey)!.add(secondKey);
      adjacency.get(secondKey)!.add(firstKey);
    }
  }
  const seen = new Set<string>();
  const stack: string[] = [vertexKeys[0]];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const neighbor of adjacency.get(current)!) stack.push(neighbor);
  }
  const unreachable = vertexKeys.filter((key) => !seen.has(key));
  if (unreachable.length) {
    return [
      "arbre: non connexe — " + unreachable.join(", ") + " inatteignable(s) depuis " + vertexKeys[0],
    ];
  }
  return [];
}

// ---- the registry ----------------------------------------------------

export type CheckFunction = (parameters: { space: Space; view: AddressView }) => string[];

// The check registry carried by the data: on the Python side these
// are functions in the layers; here they are tags the kernel resolves
// — the tag strings are behavior, they stay as they are.
export const checkRegistry: Record<string, CheckFunction> = {
  containers: checkContainers,
  cardinality: checkCardinality,
  simple: checkSimple,
  nonempty: checkNonempty,
  oriented: checkOriented,
  sperner: checkSperner,
  "k-partite": checkKPartite,
  dag: checkAcyclic,
  arbre: checkConnected,
};

// Walks the flattened view; at each address, runs the checks carried
// by the sources of its closure (checks inherited from the types) —
// port of the original `run_checks`. Used by the audit harness; the
// workbench itself reads the space immutably.
export function runChecks({ space, layer }: { space: Space; layer: LayerName }): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const address of walkAddresses({ space, layer })) {
    const view = new AddressView(address[0], address[1]);
    for (const [sourceLayer, sourcePath] of space.closure({ layer: address[0], path: address[1] })) {
      const node = space.raw({ layer: sourceLayer, path: sourcePath });
      if (!isDictionary(node)) continue;
      const tags = node["checks"] ?? [];
      if (!Array.isArray(tags)) continue;
      for (const tag of tags) {
        const checkFunction = checkRegistry[tag];
        if (!checkFunction) {
          // An unknown tag is ignored — and recorded.
          space.recordDiagnostic({ kind: "étiquette-inconnue", address: [address[0], address[1]], fact: fact("label-unknown", { tag }) });
          continue;
        }
        // Deduplication by (address, check) — mirror of the Python
        // (layer, path, id(fn)) tag: the tag string is the identity.
        const deduplicationKey = address[0] + "|" + address[1].join("/") + "|" + tag;
        if (seen.has(deduplicationKey)) continue;
        seen.add(deduplicationKey);
        for (const error of checkFunction({ space, view }) ?? []) {
          errors.push(address[0] + "::" + (address[1].join("/") || ".") + " — " + error);
        }
      }
    }
  }
  return errors;
}

