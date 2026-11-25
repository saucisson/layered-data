// Type declarations for probe-merge.mjs (scripts/ is plain JS, not
// compiled by tsc — the harness in tests/ imports the walk through
// these declarations).
export interface TryCommandResult {
  returncode: number;
  stdout: string;
  stderr: string;
}

export interface Runner {
  tryCommand(command: { args: string[]; cwd?: string }): TryCommandResult;
  readFile(file: { path: string }): string;
}

export interface CommitVerdict {
  commit: string;
  subject: string;
  failingFront: string | null;
  failureOutput: string;
}

export function createRealRunner(): Runner;
export function parseCommitLines(output: { output: string }): string[];
export function lockChanged(input: { lockFileText: string | null; previousLockFileText: string | null }): boolean;
export function verdictLine(verdict: { verdict: CommitVerdict }): string;
export function failureOutputLines(verdict: { verdict: CommitVerdict }): string[];
export function run(options?: { args?: string[]; runner?: Runner }): number;
export const DEFAULT_BASE_REF: string;
