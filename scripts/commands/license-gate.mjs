// license gate of the installed graph (ADR-0008, N2).
//
// Dependency admission is argued evidence, not list membership (N2):
// the adding agent states the community-validation case in the pull
// request, the reviewer verifies the evidence, and the mechanical
// fronts fail closed in CI on every pull request - the vulnerability
// audit (`npm audit`, already wired in the security job) and this
// license gate. Every package of the installed graph (the tree built
// by `npm ci` from package-lock.json, transitive dependencies and
// nested copies included) must resolve to a license inside the
// allowed set below; a package with no license metadata at all fails
// closed, never passes silently, and so does a missing node_modules
// directory (the gate never passes on an uninstalled tree).
//
// The allowed set is configuration, not constitution: an instance
// edits the set in its own repository, and a new dependency with an
// off-list license is a pull request that argues both the community
// validation and the license exception. Compound SPDX expressions
// are evaluated the way they bind: `OR` is a choice and passes when
// one operand is allowed, `AND` multiplies and requires every
// operand, `WITH` carries an exception and binds to the operand
// before it (the exception itself is not a license).
//
// Exit codes: 0 every package allowed, 1 at least one offender
// (criteria unmet), 2 protocol failure (no installation to scan).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_CRITERIA_UNMET = 1;
const EXIT_CODE_PROTOCOL_FAILURE = 2;

// SPDX identifiers (casefolded) plus the legacy free-form strings some
// packages still carry. Configuration lives here on purpose: a new
// license joins the set through a pull request, not through this
// gate's verdict (N2).
const ALLOWED_LICENSES = new Set([
  'mit',
  'apache-2.0',
  'bsd-2-clause',
  'bsd-3-clause',
  '0bsd',
  'isc',
  'mpl-2.0',
  'unlicense',
  'cc0-1.0',
  'bsd',
  'mit license',
  'apache software license',
  'apache 2.0',
  'bsd license',
  'bsd 2-clause license',
  'bsd 3-clause license',
  'isc license',
  'mozilla public license 2.0 (mpl 2.0)',
  'the unlicense (unlicense)',
  'public domain',
]);

/** Split text on a separator at parenthesis depth zero; null when
 * the separator never appears at depth zero. */
export function splitOutsideParentheses({ text, separator }) {
  let depth = 0;
  const parts = [];
  let start = 0;
  let position = 0;
  while (position <= text.length - separator.length) {
    const character = text[position];
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (depth === 0 && text.slice(position, position + separator.length) === separator) {
      parts.push(text.slice(start, position));
      start = position + separator.length;
      position += separator.length;
      continue;
    }
    position += 1;
  }
  if (parts.length === 0) return null;
  parts.push(text.slice(start));
  return parts;
}

/** Evaluate one SPDX license expression against the allowed set. */
export function expressionIsAllowed({ expression }) {
  let cleaned = expression.trim();
  const orParts = splitOutsideParentheses({ text: cleaned, separator: ' OR ' });
  if (orParts !== null) {
    return orParts.some((part) => expressionIsAllowed({ expression: part }));
  }
  const andParts = splitOutsideParentheses({ text: cleaned, separator: ' AND ' });
  if (andParts !== null) {
    return andParts.every((part) => expressionIsAllowed({ expression: part }));
  }
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    const inner = cleaned.slice(1, -1).trim();
    const innerIsCompound =
      splitOutsideParentheses({ text: inner, separator: ' OR ' }) !== null ||
      splitOutsideParentheses({ text: inner, separator: ' AND ' }) !== null;
    if (innerIsCompound) return expressionIsAllowed({ expression: inner });
  }
  const withPosition = cleaned.indexOf(' WITH ');
  if (withPosition !== -1) cleaned = cleaned.slice(0, withPosition).trim();
  return ALLOWED_LICENSES.has(cleaned.toLowerCase());
}

/** Return the blocking evidence for the metadata fields of one
 * package, or null when the license is allowed. Precedence follows
 * the package.json shape: the `license` field decides when present,
 * the legacy `licenses` array when there is none; a package passing
 * neither has no license metadata and fails closed. */
export function licenseViolation({ license, licenses }) {
  if (typeof license === 'string' && license.trim() !== '') {
    return expressionIsAllowed({ expression: license }) ? null : license;
  }
  if (Array.isArray(licenses) && licenses.length > 0) {
    const allowed = licenses.some((entry) => {
      const type = typeof entry === 'string' ? entry : entry?.type ?? '';
      return typeof type === 'string' && expressionIsAllowed({ expression: type });
    });
    return allowed ? null : JSON.stringify(licenses);
  }
  if (license !== undefined && license !== null && license !== '') {
    return String(license);
  }
  return 'no license metadata at all';
}

/** List the package directories of an installed graph, nested copies
 * included: node_modules and every node_modules below a package. */
function listPackageDirectories({ nodeModulesPath, walked, acc }) {
  let entries;
  try {
    entries = readdirSync(nodeModulesPath, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') && !entry.name.startsWith('@')) continue;
    const packagePaths = entry.name.startsWith('@')
      ? readdirSync(join(nodeModulesPath, entry.name), { withFileTypes: true })
          .filter((scoped) => scoped.isDirectory())
          .map((scoped) => join(nodeModulesPath, entry.name, scoped.name))
      : [join(nodeModulesPath, entry.name)];
    for (const packagePath of packagePaths) {
      if (walked.has(packagePath)) continue;
      walked.add(packagePath);
      acc.push(packagePath);
      const nested = join(packagePath, 'node_modules');
      if (existsSync(nested)) listPackageDirectories({ nodeModulesPath: nested, walked, acc });
    }
  }
  return acc;
}

/** Read the license metadata of one package directory. */
function readPackageMetadata({ packagePath }) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(packagePath, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
  const name = typeof manifest.name === 'string' && manifest.name !== '' ? manifest.name : packagePath;
  const version = typeof manifest.version === 'string' ? manifest.version : '';
  return { name: `${name}@${version}`, license: manifest.license, licenses: manifest.licenses };
}

/** Scan the installed graph; return offenders as `name: evidence`,
 * de-duplicated (a transitive copy of an already-failing package
 * reports once). */
export function scanInstalledGraph({ nodeModulesPath }) {
  const packagePaths = listPackageDirectories({ nodeModulesPath, walked: new Set(), acc: [] });
  const offenders = [];
  const seen = new Map();
  for (const packagePath of packagePaths) {
    const metadata = readPackageMetadata({ packagePath });
    if (metadata === null) {
      const key = `${packagePath}: unreadable package.json`;
      if (!seen.has(key)) {
        seen.set(key, true);
        offenders.push(`${packagePath}: unreadable package.json`);
      }
      continue;
    }
    const violation = licenseViolation({ license: metadata.license, licenses: metadata.licenses });
    if (violation !== null) {
      const evidence = `${metadata.name}: ${violation}`;
      if (!seen.has(evidence)) {
        seen.set(evidence, true);
        offenders.push(evidence);
      }
    }
  }
  return offenders;
}

// ---- entry point -----------------------------------------------------

export function run({ root = process.cwd() } = {}) {
  const nodeModulesPath = join(root, 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    console.error('license gate: no node_modules to scan - run npm ci first; the gate never passes uninstalled.');
    return EXIT_CODE_PROTOCOL_FAILURE;
  }
  const offenders = scanInstalledGraph({ nodeModulesPath });
  for (const offender of offenders) {
    console.log(`license gate: ${offender} - outside the configured allowed set.`);
  }
  if (offenders.length > 0) {
    console.log(
      `license gate: ${offenders.length} package(s) outside the allowed set (the set lives in ` +
        'scripts/commands/license-gate.mjs, N2: configuration, not constitution).',
    );
    return EXIT_CODE_CRITERIA_UNMET;
  }
  console.log(`license gate: the installed graph resolves entirely inside the allowed set.`);
  return EXIT_CODE_SUCCESS;
}
