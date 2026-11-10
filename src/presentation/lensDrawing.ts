// The drawing of a model seen through a lens (or a viewpoint), as
// panel ④ reads it — extracted here so the formalism page draws
// with the exact same discipline: the model, the lens, the
// position cascade (the viewpoint decides, else the model carries,
// else the circle layout), the dressed shapes, the applicability
// count. Pure kernel reads, no React: the workshop's memo and the
// page's memo both call it.

import { asLayerName, asLayerPath } from "../domain/identifiers.ts";
import { AddressView } from "../domain/addresses.ts";
import type { Space } from "../domain/space.ts";
import { drawnShape, dressingApplicability } from "../domain/views.ts";
import { bindingOf, circlePosition, LENS_LAYERS, positionOf } from "./viewTree.ts";

/** One drawn vertex: its resolved position and the shape the lens
 * decides for its type (null: the lens knows nothing of it, the
 * glyph stays dashed). */
export interface LookVertex {
  name: string;
  position: { x: number; y: number } | null;
  drawn: ReturnType<typeof drawnShape>;
}

/** One drawn edge: the shape, the weight read through the view
 * (the diamond's datum), the endpoint names. */
export interface LookEdge {
  name: string;
  drawn: ReturnType<typeof drawnShape>;
  weight: number | null;
  from: string | null;
  to: string | null;
}

/** What the drawing needs: the model, the lens (or ∅), where the
 * positions come from, the frame the resolved positions demand,
 * the drawn vertices and edges, the applicability of the lens. */
export interface WorkshopLook {
  isLens: boolean;
  model: string;
  lens: string | null;
  viewpointDecidesPositions: boolean;
  modelCarriesPositions: boolean;
  frame: string | null;
  vertices: LookVertex[];
  edges: LookEdge[];
  applicability: { dressed: number; total: number };
}

/** Read one look of the workshop: a lens over the current model,
 * or a viewpoint (whose model and display slots are resolved as
 * addresses — late binding). `selectedView` names the lens or the
 * viewpoint; `currentLayer` is the model the workshop stands on
 * (a lone lens applies to it; a viewpoint's model slot decides). */
export function buildWorkshopLook({
  space,
  selectedView,
  currentLayer,
}: {
  space: Space;
  selectedView: string;
  currentLayer: string;
}): WorkshopLook {
  const isLens = LENS_LAYERS.includes(selectedView);
  // The model: the viewpoint's (model slot resolved as an
  // address), otherwise the current model of ①.
  let model = currentLayer;
  if (!isLens) {
    const modelBinding = bindingOf({ space, view: selectedView, key: "model" }).value;
    if (modelBinding instanceof AddressView) model = modelBinding.layer;
  }
  // The lens: the lens itself when chosen, otherwise the display
  // slot of the viewpoint (the zoom stays a slot: undecided).
  let lens: string | null = null;
  if (isLens) lens = selectedView;
  else {
    const displayBinding = bindingOf({ space, view: selectedView, key: "display" }).value;
    if (displayBinding instanceof AddressView) lens = displayBinding.layer;
  }
  // The position cascade — decided by the viewpoint (they win),
  // otherwise carried by the model (the formalism poses them,
  // the reader resolves them: grid or pole, absolute or
  // relative), otherwise the circle layout takes over.
  const viewpointDecidesPositions =
    !isLens &&
    space.read({ layer: asLayerName(selectedView), path: asLayerPath([]), key: "positions" }) instanceof AddressView;
  const modelCarriesPositions =
    lens !== null &&
    space.read({ layer: asLayerName(model), path: asLayerPath([]), key: "positions" }) instanceof AddressView;
  const positionOfName = (name: string, index: number, all: string[]) =>
    (viewpointDecidesPositions ? positionOf({ space, source: selectedView, name }) : null) ??
    (modelCarriesPositions ? positionOf({ space, source: model, name }) : null) ??
    circlePosition({ index, total: all.length });
  const vertices: LookVertex[] =
    lens !== null
      ? space
          .keys({ layer: asLayerName(model), path: asLayerPath(["vertices"]) })
          .map((name, index, all) => ({
            name,
            position: positionOfName(name, index, all),
            drawn: drawnShape({
              space,
              lens: asLayerName(lens),
              layer: asLayerName(model),
              path: asLayerPath(["vertices", name]),
            }),
          }))
      : [];
  // The frame follows the positions: a layout wider than the box
  // is no longer cropped, the drawing adjusts; without resolved
  // positions, the circle box stays.
  const frame = (() => {
    const positions = vertices
      .map((vertex) => vertex.position)
      .filter((position): position is { x: number; y: number } => position !== null);
    if (positions.length === 0) return null;
    const margin = 30;
    const x0 = Math.min(...positions.map((position) => position.x)) - margin;
    const y0 = Math.min(...positions.map((position) => position.y)) - margin;
    const x1 = Math.max(...positions.map((position) => position.x)) + margin;
    const y1 = Math.max(...positions.map((position) => position.y)) + margin;
    return x0 + " " + y0 + " " + (x1 - x0) + " " + (y1 - y0);
  })();
  const edges: LookEdge[] =
    lens !== null
      ? space.keys({ layer: asLayerName(model), path: asLayerPath(["edges"]) }).map((name) => {
          const drawn = drawnShape({
            space,
            lens: asLayerName(lens),
            layer: asLayerName(model),
            path: asLayerPath(["edges", name]),
          });
          const source = space.read({
            layer: asLayerName(model),
            path: asLayerPath(["edges", name]),
            key: "source",
          });
          const target = space.read({
            layer: asLayerName(model),
            path: asLayerPath(["edges", name]),
            key: "target",
          });
          // Weight of the diamond: a datum read through the view —
          // e1 carries it, e2 inherits the default of
          // weighted-hypergraph.
          const weightRead =
            model === "wb1"
              ? space.read({
                  layer: asLayerName(model),
                  path: asLayerPath(["edges", name]),
                  key: "weight",
                })
              : null;
          const weight = typeof weightRead === "number" ? weightRead : null;
          return {
            name,
            drawn,
            weight,
            from: source instanceof AddressView ? (source.path[source.path.length - 1] ?? null) : null,
            to: target instanceof AddressView ? (target.path[target.path.length - 1] ?? null) : null,
          };
        })
      : [];
  const applicability =
    lens !== null
      ? dressingApplicability({ space, lens: asLayerName(lens), model: asLayerName(model) })
      : { dressed: -1, total: -1 };
  return {
    isLens,
    model,
    lens,
    viewpointDecidesPositions,
    modelCarriesPositions,
    frame,
    vertices,
    edges,
    applicability,
  };
}
