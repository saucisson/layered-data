// The render half of the display functions (ADR-0119, issue #288):
// ONLY the browser renderers execute the lens code — the server
// parses it at staging and never runs it. Each function runs in a
// try/catch, per drawn node, with PURE DATA as input (the flattened
// element and the flattened model — no API method), and its output is
// validated before it touches a pixel: a field parameter against its
// schema, a returned SVG tree against the whitelist below. A function
// that throws or leaves the schema falls back to the default with a
// diagnostic. The blast radius is the author's own pixels.
//
// The SVG output is DATA ({tag, attrs, children}), rendered as React
// elements — never markup in text, never innerHTML: a tree carrying
// a tag or an attribute outside the whitelist is dropped at render,
// never executed.

import {
  asDisplayFn,
  type DisplayFn,
  type DisplayFnContext,
} from "../domain/displayFunctions.ts";

export type { DisplayFnContext };
import {
  LABEL_SIDES,
  isValidPathData,
  type Glyph,
  type LabelSide,
  type RawGlyph,
  type RawGlyphField,
} from "../domain/views.ts";

/** Run one display function with its arguments — the ONLY place code
 * from a lens is executed (ADR-0119). The body is an expression (the
 * staging grammar guarantees the syntax); the caller wraps this in a
 * try/catch and validates the output. CSP: the site consignes
 * unsafe-eval for this single call site. */
function runDisplayFn(fn: DisplayFn, args: unknown[]): unknown {
  // ADR-0119: the one code slot of the language, executed only here,
  // in a try/catch by the caller, output whitelisted before rendering
  const factory = new Function(...fn.params, "return (" + fn.code + ");") as (
    ...params: unknown[]
  ) => unknown;
  return factory(...args);
}

/** Evaluate a fn field against the context — null when the function
 * throws or the params are not plain identifiers (never a crash). */
function evalDisplayFn(fn: DisplayFn, context: DisplayFnContext | undefined): unknown {
  if (context === undefined) return null;
  if (!fn.params.every((param) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(param))) return null;
  const args = [context.element, context.model].slice(0, Math.max(fn.params.length, 1));
  try {
    return runDisplayFn(fn, args);
  } catch {
    return null;
  }
}

// ---- field schema ------------------------------------------------------
// Each glyph field validates the function's output against its own
// schema; anything else falls back to the default (the field absent).

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isColorString = (value: unknown): value is string => typeof value === "string";
const isLabelSideValue = (value: unknown): value is LabelSide =>
  typeof value === "string" && (LABEL_SIDES as readonly string[]).includes(value);
const isCurveValue = (value: unknown): value is "polyline" | "bezier" =>
  value === "polyline" || value === "bezier";

function resolveField<T>(
  field: RawGlyphField<T> | undefined,
  context: DisplayFnContext | undefined,
  isValid: (value: unknown) => value is T,
): T | undefined {
  if (field === undefined) return undefined;
  const fn = asDisplayFn(field);
  if (fn === null) return isValid(field) ? field : undefined;
  const output = evalDisplayFn(fn, context);
  return isValid(output) ? output : undefined;
}

/** Resolve one raw glyph to a plain glyph: every function field is
 * evaluated against the context and validated against its schema — a
 * fault (throw, wrong type) drops the field, the gabarit's default
 * applies. Never a crash. */
export function resolveGlyph(raw: RawGlyph, context: DisplayFnContext | undefined): Glyph {
  if (raw.shape === "line") {
    const arrow = resolveField(raw.arrow, context, isColorString);
    const ports = resolveField(raw.ports, context, isFiniteNumber);
    const stroke = resolveField(raw.stroke, context, isColorString);
    const dash = resolveField(raw.dash, context, (v): v is boolean => typeof v === "boolean");
    const curve = resolveField(raw.curve, context, isCurveValue);
    return {
      shape: "line",
      ...(arrow !== undefined ? { arrow } : {}),
      ...(ports !== undefined ? { ports } : {}),
      ...(stroke !== undefined ? { stroke } : {}),
      ...(dash !== undefined ? { dash } : {}),
      ...(curve !== undefined ? { curve } : {}),
    } as Glyph;
  }
  const common = {
    fill: resolveField(raw.fill, context, isColorString),
    stroke: resolveField(raw.stroke, context, isColorString),
    label: resolveField(raw.label, context, isColorString),
    dash: resolveField(raw.dash, context, (v): v is boolean => typeof v === "boolean"),
    dx: resolveField(raw.dx, context, isFiniteNumber),
    dy: resolveField(raw.dy, context, isFiniteNumber),
    angle: resolveField(raw.angle, context, isFiniteNumber),
    "label-side": resolveField(raw["label-side"], context, isLabelSideValue),
    "label-dx": resolveField(raw["label-dx"], context, isFiniteNumber),
    "label-dy": resolveField(raw["label-dy"], context, isFiniteNumber),
  };
  const defined = Object.fromEntries(
    Object.entries(common).filter(([, value]) => value !== undefined),
  ) as Record<string, unknown>;
  if (raw.shape === "circle") {
    const r = resolveField(raw.r, context, isFiniteNumber);
    return { ...defined, shape: "circle", ...(r !== undefined ? { r } : {}) } as Glyph;
  }
  if (raw.shape === "ellipse") {
    const rx = resolveField(raw.rx, context, isFiniteNumber);
    const ry = resolveField(raw.ry, context, isFiniteNumber);
    return { ...defined, shape: "ellipse", ...(rx !== undefined ? { rx } : {}), ...(ry !== undefined ? { ry } : {}) } as Glyph;
  }
  if (raw.shape === "rectangle" || raw.shape === "box") {
    const w = resolveField(raw.w, context, isFiniteNumber);
    const h = resolveField(raw.h, context, isFiniteNumber);
    return { ...defined, shape: raw.shape, ...(w !== undefined ? { w } : {}), ...(h !== undefined ? { h } : {}) } as Glyph;
  }
  // path
  const d = resolveField(raw.d, context, (v): v is string => typeof v === "string" && isValidPathData(v));
  if (d === undefined) return { ...defined, shape: "path", d: "" } as Glyph;
  return { ...defined, shape: "path", d } as Glyph;
}

/** Resolve a whole shape (the ordered glyph list) against the context. */
export function resolveGlyphList(raw: RawGlyph[], context: DisplayFnContext | undefined): Glyph[] {
  return raw.map((glyph) => resolveGlyph(glyph, context));
}

// ---- the SVG whitelist -------------------------------------------------
// A `draw` function returns shapes and groups AS DATA. The whitelist
// is closed: these tags, these attributes, string/number values only.
// Anything else — a tag, an attribute, a non-data child — drops the
// node at render. Never markup in text, never innerHTML.

export interface SvgDataNode {
  tag: string;
  attrs: Record<string, string | number>;
  children: SvgDataNode[];
}

const SVG_TAGS: readonly string[] = [
  "g",
  "circle",
  "ellipse",
  "rect",
  "path",
  "line",
  "polyline",
  "polygon",
];

const SVG_ATTRS: readonly string[] = [
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "d",
  "points",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "opacity",
  "transform",
];

/** Filter a returned tree against the whitelist — a node carrying a
 * tag or an attribute outside the lists is dropped (null), never
 * rendered, never executed. */
export function whitelistSvgTree(value: unknown): SvgDataNode | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const tag = record["tag"];
  if (typeof tag !== "string" || !SVG_TAGS.includes(tag)) return null;
  const rawAttrs = record["attrs"];
  const attrs: Record<string, string | number> = {};
  if (rawAttrs !== undefined) {
    if (typeof rawAttrs !== "object" || rawAttrs === null || Array.isArray(rawAttrs)) return null;
    for (const [name, attrValue] of Object.entries(rawAttrs as Record<string, unknown>)) {
      if (!SVG_ATTRS.includes(name)) return null; // one bad attribute drops the node
      if (typeof attrValue === "string" || typeof attrValue === "number") {
        attrs[name] = attrValue;
      } else {
        return null;
      }
    }
  }
  const rawChildren = record["children"];
  const children: SvgDataNode[] = [];
  if (rawChildren !== undefined) {
    if (!Array.isArray(rawChildren)) return null;
    for (const child of rawChildren) {
      const filtered = whitelistSvgTree(child);
      if (filtered !== null) children.push(filtered);
    }
  }
  return { tag, attrs, children };
}

/** Resolve the whole-template `draw` function (ADR-0119): run it
 * against the context, filter the returned tree through the
 * whitelist. A throw or a non-data output yields null — the glyph
 * list of the template then applies. */
export function resolveDrawFn(
  draw: DisplayFn | null,
  context: DisplayFnContext | undefined,
): SvgDataNode | null {
  if (draw === null) return null;
  const output = evalDisplayFn(draw, context);
  if (output === null) return null;
  // a bare array of shapes is accepted as the group's children
  if (Array.isArray(output)) {
    const children: SvgDataNode[] = [];
    for (const item of output) {
      const filtered = whitelistSvgTree(item);
      if (filtered !== null) children.push(filtered);
    }
    return { tag: "g", attrs: {}, children };
  }
  return whitelistSvgTree(output);
}
