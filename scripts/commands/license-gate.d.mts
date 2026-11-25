// Type declarations for license-gate.mjs (scripts/ is plain JS, not
// compiled by tsc — the harness in tests/ imports the check functions
// through these declarations).
export function splitOutsideParentheses(input: { text: string; separator: string }): string[] | null;
export function expressionIsAllowed(expression: { expression: string }): boolean;
export function licenseViolation(fields: { license?: unknown; licenses?: unknown }): string | null;
export function scanInstalledGraph(path: { nodeModulesPath: string }): string[];
export function run(options?: { root?: string }): number;
