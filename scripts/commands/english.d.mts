// Type declarations for english.mjs (scripts/ is plain JS, not compiled
// by tsc — the harness in tests/ imports the check functions through
// these declarations).
export interface Segment {
  text: string;
  line: number;
}

export interface IdentifierSegment {
  name: string;
  line: number;
}

export interface Corpora {
  comments: Segment[];
  strings: Segment[];
  identifiers: IdentifierSegment[];
}

export interface Finding {
  line: number;
  evidence: string;
}

export interface Offender {
  file: string;
  line: number;
  evidence: string;
}

export function splitSource(source: { text: string }): Corpora;
export function scanSegment(segment: { text: string; startLine: number; withStopWords: boolean }): Finding | null;
export function frenchStemInIdentifier(identifier: { identifier: string }): boolean;
export function stripMarkdown(source: { text: string }): string;
export function scanFile(file: { relative: string; text: string }): Finding | null;
export function listScope(root: { root: string }): string[];
export function scanRepository(root: { root: string }): { offenders: Offender[]; refused: string | null };
export function renderOffender(offender: { offender: Offender }): string;
export function scanSubject(subject: { subject: string }): Offender | null;
export function run(options?: { args?: string[]; root?: string }): number;
