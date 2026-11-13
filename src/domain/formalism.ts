// The status of a formalism (ADR-0115, issue #144).
//
// One formalism = one versioned layer. A new formalism is born
// `draft`: editable, private to its owner (or local when anonymous),
// never resolved by the bare name, not refinable by others.
// Publication = first freeze = version 1.0.0 (ADR-0116): the draft
// replaces semver's 0.x.y unstable zone.

/** The lifecycle status of a formalism. A closed set: exhaustiveness
 * is checked with a never guard at every switch. */
export type FormalismStatus = "draft" | "published";

export const FORMALISM_STATUSES: readonly FormalismStatus[] = ["draft", "published"];

export function isFormalismStatus(value: unknown): value is FormalismStatus {
  return typeof value === "string" && (FORMALISM_STATUSES as readonly string[]).includes(value);
}

/** A draft never resolves by the bare name and is never refinable:
 * only a published (frozen) formalism enters the closure of another
 * assembly (ADR-0116 rule 5). */
export function isResolvableByBareName({ status }: { status: FormalismStatus }): boolean {
  return status === "published";
}

/** A draft is refinable by no one but its owner editing it; once
 * published, the frozen version stays refinable forever. */
export function isRefinableByOthers({ status }: { status: FormalismStatus }): boolean {
  return status === "published";
}
