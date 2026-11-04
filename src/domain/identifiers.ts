// Nominal identifiers of the domain.
//
// A bare string can never pose as a layer name or a path segment: the
// brand is only acquired where external input is parsed (the language
// parser and the compiler), never by accident. Everything downstream
// — the space, the checks, the views — trusts these types and never
// re-validates them.

export type LayerName = string & { readonly brand: "LayerName" };
export type PathSegment = string & { readonly brand: "PathSegment" };
export type SlotName = string & { readonly brand: "SlotName" };
export type CheckTag = string & { readonly brand: "CheckTag" };

/** A path within a layer: an ordered list of path segments. */
export type LayerPath = PathSegment[];

// ---- boundary constructors ---------------------------------------------
// These four functions are the only door through which a plain string
// becomes a domain identifier. They are called by the language parser
// and the compiler; nowhere else.

export function asLayerName(value: string): LayerName {
  return value as LayerName;
}

export function asPathSegment(value: string): PathSegment {
  return value as PathSegment;
}

export function asSlotName(value: string): SlotName {
  return value as SlotName;
}

export function asCheckTag(value: string): CheckTag {
  return value as CheckTag;
}

/** Converts a plain path coming from an external boundary. */
export function asLayerPath(segments: readonly string[]): LayerPath {
  return segments.map(asPathSegment);
}
