// ============================================================
// Layered Data — formalism versions (issue #148, ADR-0116)
//
// The formalism_versions table: one row per frozen version of a
// formalism, with its certified dump fingerprint. The bare name
// resolves to the latest frozen version of the latest major
// (ADR-0116 rule 2); drafts never resolve.
// ============================================================
import type { Pool } from "pg";

/** The parsed semver of a frozen version. */
export type SemVer = { major: number; minor: number; patch: number };

export function parseSemVer({ semver }: { semver: string }): SemVer | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(semver);
  if (match === null) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** Compare two semvers: major, then minor, then patch. */
export function compareSemVer(first: SemVer, second: SemVer): number {
  if (first.major !== second.major) return first.major - second.major;
  if (first.minor !== second.minor) return first.minor - second.minor;
  return first.patch - second.patch;
}

/** The latest frozen version of the latest major for a formalism —
 * the resolution of the bare name (ADR-0116 rule 2). Null when the
 * formalism has no frozen version (a draft never resolves). */
export async function resolveBareName({
  pool,
  formalismId,
}: {
  pool: Pool;
  formalismId: string;
}): Promise<{ semver: string; source: string; dumpFingerprint: string | null } | null> {
  const result = await pool.query(
    `SELECT semver, source, dump_fingerprint FROM formalism_versions
     WHERE formalism_id = $1 AND status = 'frozen'`,
    [formalismId],
  );
  const rows = result.rows as { semver: string; source: string; dump_fingerprint: string | null }[];
  const parsed = rows
    .map((row) => ({ row, semver: parseSemVer({ semver: row.semver }) }))
    .filter((entry): entry is { row: (typeof rows)[number]; semver: SemVer } => entry.semver !== null);
  if (parsed.length === 0) return null;
  const latestMajor = Math.max(...parsed.map((entry) => entry.semver.major));
  const inMajor = parsed.filter((entry) => entry.semver.major === latestMajor);
  const first = inMajor[0];
  if (first === undefined) return null;
  let winner = first;
  for (const entry of inMajor) {
    if (compareSemVer(entry.semver, winner.semver) > 0) winner = entry;
  }
  return {
    semver: winner.row.semver,
    source: winner.row.source,
    dumpFingerprint: winner.row.dump_fingerprint,
  };
}
