// Type declarations for review.mjs (scripts/ is plain JS, not compiled
// by tsc — the harnesses in tests/ import the check functions through
// these declarations).
export interface AddedLine {
  file: string | null;
  line: number;
  text: string;
}

export interface Finding {
  severity: "BLOCKING" | "TO-FIX" | "SUGGESTION" | "WAIVED";
  file: string;
  line: string;
  rule: string;
  evidence: string;
}

export function parseAddedLines(diff: string): AddedLine[];
export function checkNewDependencies(diff: string): Finding[];
export function checkDiffContent(diff: string): Finding[];
export function run(): void;
