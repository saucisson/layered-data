// The check registry's algorithms and the reader of its data.
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
// guessed — the check withdraws.
//
// The CONTRACT itself lives in the language since ADR-0019: the
// `check-registry` layer of the corpus declares every tag's level,
// required, optional and conditional slots, and this file only
// READS it (`registryContractsOf`) and binds the tag to its
// ALGORITHM (`checkRegistry`). The data declares what a check
// means; the kernel says how it executes; the two answer for each
// other in the meta-audit (`registryAuditOf` — the lint's
// registry pass). A posed check that cannot judge is a check-vacant
// verdict (ADR-0018), a declared check without an algorithm is
// refused as « algorithme absent » (ADR-0019).
//
// The placement rule follows from the closure: a binding lives at the
// level where the check READS it. Layer-level checks (simple,
// nonempty, sperner, k-partite, connectivity) read their operands at
// the root — their bindings live at roots. Arc checks (oriented, dag)
// and the ordered pair read at the arc address — their bindings live
// on the TYPE: the type is in the arc's closure, the root never is.
// A renaming follows for free: the renaming formalism rebinds the slot.

import { type LayerName, type LayerPath, asLayerName, asPathSegment } from "./identifiers.ts";
import { type Address, AddressView, MASK, type RawValue, addressesEqual, isDictionary,  } from "./addresses.ts";
import { Space } from "./space.ts";
import { designatedAddress } from "./desugaring.ts";
import { canonicalFormula, evaluateFormula, renderJudgmentMessage, tryParseFormula } from "./formulas.ts";
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

// Minimal %r-style rendering (check parameters are integers).
function valueRepr(value: any): string {
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

// The rendering of a (layer, path) tuple — the check messages quote it.
function addressTupleRepr(address: Address): string {
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
  if (typeof minimum === "number" && count < minimum) {
    errors.push("cardinalité: " + count + " < min=" + valueRepr(minimum));
  }
  if (typeof maximum === "number" && count > maximum) {
    errors.push("cardinalité: " + count + " > max=" + valueRepr(maximum));
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
        errors.push("simple: boucle (" + edgeKey + " : " + addressTupleRepr(source) + ")");
        continue;
      }
      const signature =
        source[0] + "\u0001" + source[1].join("\u0001") + "\u0002" + target[0] + "\u0001" + target[1].join("\u0001");
      const duplicate = seen.find((entry) => entry.signature === signature);
      if (duplicate) {
        errors.push(
          "simple: arête multiple (" + duplicate.key + " == " + edgeKey + " : (" +
            addressTupleRepr(source) + ", " + addressTupleRepr(target) + "))",
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
          errors.push("simple: sommet répété (" + edgeKey + " : " + addressTupleRepr(concrete) + ")");
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
            ends.ends.map(addressTupleRepr).join(", ") + "})",
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
        "oriented: 2-cycle (" + addressTupleRepr(source) + " ⇝ " + addressTupleRepr(target) + " et inverse)",
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
      return ["dag: cycle (" + addressTupleRepr(source) + " ⇝ … ⇝ " + addressTupleRepr(target) + ")"];
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

// ---- the nominal registry: the contracts ------------------------------

// The registry is NOMINAL: every check tag declares its contract —
// WHERE it judges (a layer root, an instance of the type that
// poses it) and WHICH slots it must read to be able to judge
// (ADR-0018). The contract is the check's semantics made readable
// WITHOUT executing it: the validation (a posed check that cannot
// judge is a verdict), the lint (the inventory of the vacancies)
// and the dead-binding rule (the reading levels) all read the
// registry's data — never the check's code. A check carried but
// unable to judge is a vacant check; the withdrawal policy stops
// being local to each function.
export interface CheckContract {
  /** where the check judges: a layer root (the layer checks read
   * their operands there), or an instance (the arc checks: the
   * type that poses them is in the instance's closure, the root
   * never) */
  level: "root" | "instance";
  /** the slots the check CANNOT judge without, and the level each
   * one is read at */
  required: Record<string, "root" | "instance">;
  /** the slots the check reads when present — never required */
  optional?: Record<string, "root" | "instance">;
  /** the conditional group: the slots the check needs DEPEND on the
   * value of a binding (`simple` needs the ordered pair when
   * ordered, the arrows otherwise). The instance-level slots of
   * the group are read at the addresses of the operand view
   * (the `edges`) */
  conditional?: {
    slot: string;
    operand?: string;
    "true": Record<string, "root" | "instance">;
    "false": Record<string, "root" | "instance">;
  };
}

// ---- the registry as data (ADR-0019) -----------------------------------

/** The nominal anchor of the registry: the kernel layer that
 * carries the checks' contracts, written in the language itself
 * (`formalisms/kernel/check-registry.ld`). The name is kernel
 * behavior — like the special keys, like the tag strings. */
export const REGISTRY_LAYER_NAME = asLayerName("check-registry");

/** One slot-levels record of a contract — required, optional, or a
 * conditional branch. The note keys stay out (they are data too);
 * a level that reads as neither root nor instance stays out of the
 * contract — the meta-audit inventories it, the kernel stays
 * total, never an exception. */
function slotLevelsOf(node: unknown): Record<string, "root" | "instance"> {
  const levels: Record<string, "root" | "instance"> = {};
  if (!isDictionary(node)) return levels;
  for (const slot of Object.keys(node)) {
    if (slot.startsWith("__note:")) continue;
    const level = node[slot];
    if (level === "root" || level === "instance") levels[slot] = level;
  }
  return levels;
}

/** The conditional group of a contract, read from the data: the
 * condition's slot, the operand view its instance slots are read
 * at, and the two branches. A conditional without a readable
 * condition slot is not a group. */
function conditionalOf(node: unknown): NonNullable<CheckContract["conditional"]> | null {
  if (!isDictionary(node)) return null;
  const slot = node["slot"];
  if (typeof slot !== "string") return null;
  const conditional: NonNullable<CheckContract["conditional"]> = {
    slot,
    "true": slotLevelsOf(node["true"]),
    "false": slotLevelsOf(node["false"]),
  };
  const operand = node["operand"];
  if (typeof operand === "string") conditional.operand = operand;
  return conditional;
}

/** The contracts of every declared tag, READ FROM THE DATA
 * (ADR-0019): the single source is the `check-registry` layer of
 * the space — @check-registry/specification/<tag> holds each tag's
 * level, required, optional and conditional slots, declared in the
 * language. The reader trusts the kernel's own anchor (a raw read:
 * the registry is kernel-owned; a refinement extending it stays
 * below the anchor, out of the resolution — that boundary is
 * ADR-0019's). A space without the registry layer reads an empty
 * registry: every posed tag is étiquette-inconnue — existence
 * comes from the data, nowhere else. */
export function registryContractsOf({ space }: { space: Space }): Record<string, CheckContract> {
  const contracts: Record<string, CheckContract> = {};
  const layerTree = space.raw({ layer: REGISTRY_LAYER_NAME, path: [] });
  if (!isDictionary(layerTree)) return contracts;
  const specification = layerTree["specification"];
  if (!isDictionary(specification)) return contracts;
  for (const tag of Object.keys(specification)) {
    if (tag.startsWith("__note:")) continue;
    const record = specification[tag];
    if (!isDictionary(record)) continue;
    const level = record["level"];
    if (level !== "root" && level !== "instance") continue;
    const contract: CheckContract = { level, required: slotLevelsOf(record["required"]) };
    const optional = slotLevelsOf(record["optional"]);
    if (Object.keys(optional).length > 0) contract.optional = optional;
    const conditional = conditionalOf(record["conditional"]);
    if (conditional) contract.conditional = conditional;
    contracts[tag] = contract;
  }
  return contracts;
}

/** The meta-model's audit (ADR-0019): the registry data and the
 * kernel's algorithm table answer for each other — and the fields
 * the reader cannot interpret are inventoried, never guessed.
 *
 *   - contrat-sans-algorithme: a tag declared in the language but
 *     bound to no kernel algorithm — its contract judges (the
 *     vacancy verdicts work), but it never executes;
 *   - algorithme-sans-contrat: a kernel algorithm answering to no
 *     declared contract — it would execute with no one vouching
 *     for its slots, the ADR-0018 guarantees void;
 *   - contrat-illisible: a contract field the reader skips (a
 *     level that is neither root nor instance, a condition slot
 *     that is not a string, an operand that is not a string).
 *
 * Measured on the bedrock: 0, 0, 0. */
export interface RegistryDivergence {
  kind: "contrat-sans-algorithme" | "algorithme-sans-contrat" | "contrat-illisible";
  tag: string;
  /** the registry address of the unreadable field, when there is one */
  where?: string;
}

export function registryAuditOf({ space }: { space: Space }): RegistryDivergence[] {
  const divergences: RegistryDivergence[] = [];
  const contracts = registryContractsOf({ space });
  for (const tag of Object.keys(contracts)) {
    if (!checkRegistry[tag]) divergences.push({ kind: "contrat-sans-algorithme", tag });
  }
  for (const tag of Object.keys(checkRegistry)) {
    if (!contracts[tag]) divergences.push({ kind: "algorithme-sans-contrat", tag });
  }
  const layerTree = space.raw({ layer: REGISTRY_LAYER_NAME, path: [] });
  const specification = isDictionary(layerTree) && isDictionary(layerTree["specification"])
    ? layerTree["specification"]
    : null;
  if (!specification) return divergences;
  for (const tag of Object.keys(specification)) {
    if (tag.startsWith("__note:") || !isDictionary(specification[tag])) continue;
    const record = specification[tag];
    const where = "check-registry::specification/" + tag;
    if (record["level"] !== "root" && record["level"] !== "instance") {
      divergences.push({ kind: "contrat-illisible", tag, where });
      continue;
    }
    const lintLevels = (node: unknown, label: string): void => {
      if (!isDictionary(node)) return;
      for (const slot of Object.keys(node)) {
        if (slot.startsWith("__note:")) continue;
        const level = node[slot];
        if (level !== "root" && level !== "instance") {
          divergences.push({ kind: "contrat-illisible", tag, where: where + "/" + label + "/" + slot });
        }
      }
    };
    lintLevels(record["required"], "required");
    lintLevels(record["optional"], "optional");
    if (isDictionary(record["conditional"])) {
      if (typeof record["conditional"]["slot"] !== "string") {
        divergences.push({ kind: "contrat-illisible", tag, where: where + "/conditional/slot" });
      }
      const operand = record["conditional"]["operand"];
      if (operand !== undefined && typeof operand !== "string") {
        divergences.push({ kind: "contrat-illisible", tag, where: where + "/conditional/operand" });
      }
      lintLevels(record["conditional"]["true"], "conditional/true");
      lintLevels(record["conditional"]["false"], "conditional/false");
    }
  }
  return divergences;
}

/** The reading level of every slot a check may read — required,
 * optional or conditional — one source for the registry's
 * semantics. The validation's dead-binding rule reads this table:
 * a type-level binding read at a root is a dead binding. */
export function slotReadingLevelsOf(contract: CheckContract): Record<string, "root" | "instance"> {
  return {
    ...contract.required,
    ...(contract.optional ?? {}),
    ...(contract.conditional
      ? { ...contract.conditional["false"], ...contract.conditional["true"] }
      : {}),
  };
}

// ---- the vacant checks (ADR-0018) -------------------------------------

/** A check that cannot judge: carried (posed, or inherited through
 * the closure) at an address its contract makes it judge, but a
 * required slot is unbound — the constraint withdraws and the
 * workshop's validity says nothing. `posed` tells the local act (the
 * tag carried at the very address) from the inherited one (a
 * formalism's constraint traveling to a layer whose closure stops
 * binding). */
export interface VacantCheck {
  address: Address;
  tag: string;
  slot: string;
  /** the level the unbound slot is read at */
  level: "root" | "instance";
  posed: boolean;
}

function pathsEqual(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((segment, index) => segment === second[index]);
}

/** Inventory the vacant checks of a space, WITHOUT executing the
 * checks — the detector is the contract's reader, not the check's
 * runner (ADR-0018). The walk mirrors runChecks': every address,
 * the tags of its closure. The judgment follows the contract's
 * placement rule: a local pose always judges; an inherited layer
 * check judges at the layer roots that carry it; an inherited
 * instance check judges at the addresses that inherit it from the
 * posing type. The conditional group resolves its condition (the
 * `ordered` binding, unbound reading as false — the mirror of the
 * check's own code) at the judged address, and its instance slots
 * are judged at the addresses of the operand view (the `edges`); a
 * missing operand leaves the group dormant — nothing to judge.
 * Measured on the bedrock: 79 judgments, 0 vacancies. */
export function vacantChecksOf({ space, layerNames }: { space: Space; layerNames: readonly LayerName[] }): VacantCheck[] {
  const vacancies: VacantCheck[] = [];
  const contracts = registryContractsOf({ space });
  const recordAt = (
    address: Address,
    tag: string,
    slots: Record<string, "root" | "instance">,
    posed: boolean,
  ): void => {
    for (const [slot, level] of Object.entries(slots)) {
      const view = new AddressView(address[0], address[1]);
      if (boundSlotValue({ space, view, slot }) !== null) continue;
      vacancies.push({ address, tag, slot, level, posed });
    }
  };
  const recordContractAt = (address: Address, tag: string, contract: CheckContract, posed: boolean): void => {
    recordAt(address, tag, contract.required, posed);
    if (!contract.conditional) return;
    const view = new AddressView(address[0], address[1]);
    const group =
      contract.conditional[
        boundSlotValue({ space, view, slot: contract.conditional.slot }) === true ? "true" : "false"
      ];
    const rootSlots: Record<string, "root" | "instance"> = {};
    const instanceSlots: Record<string, "root" | "instance"> = {};
    for (const [slot, level] of Object.entries(group)) {
      (level === "instance" ? instanceSlots : rootSlots)[slot] = level;
    }
    recordAt(address, tag, rootSlots, posed);
    if (!Object.keys(instanceSlots).length || !contract.conditional.operand) return;
    // the operand view designates the addresses the group's
    // instance slots are read at; without it the group is dormant
    const operandSlot = boundSlotValue({ space, view, slot: contract.conditional.operand });
    if (operandSlot === null) return;
    const operandView = space.read({ layer: address[0], path: address[1], key: operandSlot as string });
    if (!(operandView instanceof AddressView)) return;
    for (const memberKey of space.keys({ layer: operandView.layer, path: operandView.path })) {
      recordAt(
        [operandView.layer, [...operandView.path, asPathSegment(memberKey)]],
        tag,
        instanceSlots,
        posed,
      );
    }
  };
  for (const layerName of layerNames) {
    for (const address of walkAddresses({ space, layer: layerName })) {
      const [layer, path] = address;
      let posed = false;
      const tags = new Set<string>();
      for (const [sourceLayer, sourcePath] of space.closure({ layer, path })) {
        const node = space.raw({ layer: sourceLayer, path: sourcePath });
        if (!isDictionary(node)) continue;
        if (sourceLayer === layer && pathsEqual(sourcePath, path) && Array.isArray(node["checks"])) {
          posed = true;
        }
        for (const tag of (node["checks"] ?? []) as unknown[]) {
          if (typeof tag === "string" && contracts[tag]) tags.add(tag);
        }
      }
      for (const tag of tags) {
        const contract = contracts[tag];
        if (posed) {
          recordContractAt(address, tag, contract, true);
        } else if (contract.level === "root" && path.length === 0) {
          recordContractAt(address, tag, contract, false);
        } else if (contract.level === "instance" && path.length > 0) {
          recordAt(address, tag, contract.required, false);
        }
      }
    }
  }
  return vacancies;
}

// ---- the registry ----------------------------------------------------

export type CheckFunction = (parameters: { space: Space; view: AddressView }) => string[];

// The check registry's ALGORITHMS: the tags the kernel resolves to
// code — the contracts live in the data (ADR-0019, read above); this
// table binds each declared tag to its execution. The tag strings are
// behavior, they stay as they are. The data declares what a check
// means, this table says how it runs — and the meta-audit
// (`registryAuditOf`) holds the two answer for each other.
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
// port of the original `run_checks`. Used by the strict staging arm
// (ADR-0018) and the harnesses; the workbench itself reads the space
// immutably. Existence is the data's (ADR-0019): the registry layer
// declares, the algorithm table binds.
export function runChecks({ space, layer }: { space: Space; layer: LayerName }): string[] {
  const errors: string[] = [];
  const contracts = registryContractsOf({ space });
  const seen = new Set<string>();
  for (const address of walkAddresses({ space, layer })) {
    const view = new AddressView(address[0], address[1]);
    for (const [sourceLayer, sourcePath] of space.closure({ layer: address[0], path: address[1] })) {
      const node = space.raw({ layer: sourceLayer, path: sourcePath });
      if (!isDictionary(node)) continue;
      const tags = node["checks"] ?? [];
      if (!Array.isArray(tags)) continue;
      for (const tag of tags) {
        if (typeof tag !== "string") continue;
        // Existence comes from the data (ADR-0019): a tag the
        // registry layer does not declare is ignored — and recorded.
        const contract = contracts[tag];
        if (!contract) {
          space.recordDiagnostic({ kind: "étiquette-inconnue", address: [address[0], address[1]], fact: fact("label-unknown", { tag }) });
          continue;
        }
        // A declared tag without an algorithm is refused — the
        // contract judges (its vacancy is a verdict), the
        // execution cannot.
        const checkFunction = checkRegistry[tag];
        if (!checkFunction) {
          space.recordDiagnostic({ kind: "algorithme-absent", address: [address[0], address[1]], fact: fact("algorithm-missing", { tag }) });
          continue;
        }
        // Deduplication by (address, check) — the tag string is the
        // identity of the judgment.
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


// ---- the declarative strate: the check couples (ADR-0022) ---------

/** One couple, READ from the data: a name, a level (root: the
 * prototype's strate judges at layer roots), an optional condition
 * slot (the ordered/unordered branch of `simple`), and its
 * judgments — closed sentences in the reading language, each with
 * its message template. The couple is written IN the language by its
 * definer and lands in the internal `check-definitions` container
 * (the compile's emit); the container accumulates and is never
 * addressed as a key. */
export interface CheckCouple {
  level: "root" | "instance";
  condition: string | null;
  judgments: { when: string | null; formula: string; message: string }[];
}

/** The couple ONE record of the container reads: the level AS
 * WRITTEN (the validation judges it — the reading walk narrows it),
 * the optional condition, the well-formed judgments. A record the
 * compiler did not write — or wrote off-shape — reads null; the
 * shape is the compiler's own, so the reading never guesses. */
export interface CheckCoupleRead {
  level: string;
  condition: string | null;
  judgments: { when: string | null; formula: string; message: string }[];
}

export function checkCoupleOfRecord(record: RawValue): CheckCoupleRead | null {
  if (!isDictionary(record)) return null;
  const judgments: CheckCoupleRead["judgments"] = [];
  if (Array.isArray(record["judgments"])) {
    for (const entry of record["judgments"]) {
      if (!isDictionary(entry)) continue;
      const when = entry["when"];
      const formula = entry["formula"];
      const message = entry["message"];
      if (typeof formula !== "string" || typeof message !== "string") continue;
      judgments.push({ when: typeof when === "string" ? when : null, formula, message });
    }
  }
  const level = record["level"];
  const condition = record["condition"];
  return {
    level: typeof level === "string" ? level : "",
    condition: typeof condition === "string" ? condition : null,
    judgments,
  };
}

/** The couples readable at an address — first-winner per name across
 * the closure. The doublon rule (ADR-0022) is judged at validation:
 * an identical re-pose is tolerated, a divergent one is a verdict,
 * so the winner here is never ambiguous. */
export function checkDefinitionsOf({ space, view }: { space: Space; view: AddressView }): Record<string, CheckCouple> {
  const definitions: Record<string, CheckCouple> = {};
  for (const [sourceLayer, sourcePath] of space.closure({ layer: view.layer, path: view.path })) {
    const node = space.raw({ layer: sourceLayer, path: sourcePath });
    if (!isDictionary(node) || !isDictionary(node["check-definitions"])) continue;
    for (const name of Object.keys(node["check-definitions"])) {
      if (name.startsWith("__note:") || definitions[name] !== undefined) continue;
      const read = checkCoupleOfRecord(node["check-definitions"][name]);
      if (read === null) continue;
      const level = read.level;
      if (level !== "root" && level !== "instance") continue;
      definitions[name] = {
        level,
        condition: read.condition,
        judgments: read.judgments,
      };
    }
  }
  return definitions;
}

/** The canonical identity of a couple — syntactic, up to the
 * renaming of its quantified variables (the doublon rule reads, it
 * never searches for a proof). An ill-formed formula marks the
 * couple; the validation refuses it as its own verdict. */
export function canonicalCoupleOf(couple: CheckCouple): string {
  const judgments = couple.judgments
    .map((judgment) => {
      const parsed = tryParseFormula(judgment.formula);
      const canonical = "formula" in parsed ? canonicalFormula(parsed.formula) : "<illisible>";
      return (judgment.when ?? "-") + "|" + canonical + "|" + judgment.message;
    })
    .join("||");
  return couple.level + "|" + (couple.condition ?? "-") + "|" + judgments;
}

/** One judgment of the declarative strate: the falsified sentence,
 * rendered on its free witness, with the measured cost. The witness
 * keys (in binding order) ride along — the harnesses compare them
 * with the algorithmic strate's findings. */
export interface FoJudgment {
  address: Address;
  tag: string;
  when: string | null;
  message: string;
  witnessKeys: string[];
  steps: number;
}

/** The declarative execution (ADR-0022): the same walk as
 * `runChecks`, the same deduplication — wherever a posed tag has a
 * readable couple, the sentences judge instead of the algorithm
 * table. The algorithmic strate stays THE execution of the bedrock
 * (the registry binds it); this walk answers for it: the harnesses
 * measure the two strates against each other, address by address.
 * A falsified sentence ships ALL its witnesses — the template
 * renders each; an exhausted or ill-formed formula never judges
 * silently, it records its diagnostic. */
export function runChecksFO({ space, layer }: { space: Space; layer: LayerName }): FoJudgment[] {
  const judgments: FoJudgment[] = [];
  const seen = new Set<string>();
  for (const address of walkAddresses({ space, layer })) {
    const view = new AddressView(address[0], address[1]);
    const definitions = checkDefinitionsOf({ space, view });
    if (Object.keys(definitions).length === 0) continue;
    for (const [sourceLayer, sourcePath] of space.closure({ layer: address[0], path: address[1] })) {
      const node = space.raw({ layer: sourceLayer, path: sourcePath });
      if (!isDictionary(node)) continue;
      const tags = node["checks"] ?? [];
      if (!Array.isArray(tags)) continue;
      for (const tag of tags) {
        if (typeof tag !== "string") continue;
        const couple = definitions[tag];
        if (couple === undefined) continue;
        const deduplicationKey = address[0] + "|" + address[1].join("/") + "|" + tag;
        if (seen.has(deduplicationKey)) continue;
        seen.add(deduplicationKey);
        const conditionTrue =
          couple.condition !== null && boundSlotValue({ space, view, slot: couple.condition }) === true;
        for (const judgment of couple.judgments) {
          if (judgment.when !== null && (judgment.when === "true") !== conditionTrue) continue;
          const parsed = tryParseFormula(judgment.formula);
          if (!("formula" in parsed)) {
            space.recordDiagnostic({
              kind: "formule-illisible",
              address: [address[0], address[1]],
              fact: fact("unreadable-formula", { tag, detail: parsed.error }),
            });
            continue;
          }
          const evaluation = evaluateFormula({ space, view, formula: parsed.formula });
          if (evaluation.exhausted) {
            space.recordDiagnostic({
              kind: "formule-épuisée",
              address: [address[0], address[1]],
              fact: fact("exhausted-formula", { tag, steps: String(evaluation.steps) }),
            });
            continue;
          }
          if (!evaluation.ok) {
            for (const failure of evaluation.failures) {
              judgments.push({
                address: [address[0], address[1]],
                tag,
                when: judgment.when,
                message: renderJudgmentMessage({ space, view, message: judgment.message, assignment: failure }),
                witnessKeys: Object.keys(failure).map((variable) => {
                  const witness = failure[variable];
                  return witness.path.length ? witness.path[witness.path.length - 1] : witness.layer;
                }),
                steps: evaluation.steps,
              });
            }
          }
        }
      }
    }
  }
  return judgments;
}
