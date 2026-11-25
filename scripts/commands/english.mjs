// english-only front: development artifacts stay English (ADR-0008 G4, N4).
//
// The artifact layer is English by convention (G4): typewritten
// French drops its accents, so a bare accented-character scan catches
// only part of the problem. This front keeps the accented signal and
// adds an unaccented-French signal, with the hierarchy adapted from
// the template checker (saucisson/project-template, scripts/english.py):
//
// - accented characters: every in-scope file, string literals included
//   (a literal quoting a French label is still a finding; product data
//   lives outside the scope on purpose);
// - French stop-words: prose (comments) and the commit subject;
// - French identifier stems: code identifiers and comment words,
//   matched against the snake or camel parts of the configured set.
//
// The scope is this instance's DEV ARTIFACT LAYER only — root Markdown,
// docs/ and .github/ Markdown, and the scripts/ sources (ADR-0025).
// Product code and product content (src/, server/, tests/, e2e/,
// formalisms/, benchmarks/, vscode/) carry the product's
// French-language vocabulary by design (ADR-0104): they are data, and
// this front never scans them. Lock files, coverage and node_modules
// are machine-generated, never scanned. An in-scope file that must stay
// French argues its addition to ALLOWED_EXACT per pull request; today's
// list records the historical French documents as explicit, reviewable
// debt.
//
// Two shapes (ADR-0008 N4):
//
// - `npm run english-only`: scan the whole scope, one line per
//   offender, exit 1 as soon as one exists — the CI front;
// - `node scripts/cli.mjs english-only --subject-file PATH`: scan the
//   first line of that file only (accents, stop-words) — the
//   commit-msg hook shape, wired through .githooks/commit-msg
//   (`make install-hooks`).
//
// Exit codes: 0 clean, 1 offender found (criteria unmet), 2 protocol
// failure (unreadable file).

import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, sep } from 'node:path';

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_CRITERIA_UNMET = 1;
const EXIT_CODE_PROTOCOL_FAILURE = 2;

// The accented signal, built from code points so this file itself
// stays accent-free: only the letters that written French uses.
const ACCENT_LOWER = String.fromCharCode(
  0xe0, 0xe2, 0xe4, 0xe7, 0xe9, 0xe8, 0xea, 0xeb, 0xee, 0xef,
  0xf4, 0xf9, 0xfb, 0xfc, 0xff, 0x153, 0xe6,
);
const ACCENTS = ACCENT_LOWER + ACCENT_LOWER.toUpperCase();
const ACCENT_REGULAR_EXPRESSION = new RegExp(`[${ACCENTS.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}]`);

// French function words, whole words only: they catch accent-free
// French prose in comments and commit subjects. None of them appears
// as a whole word in the English driver sources.
const STOP_WORDS = (
  'le la les un une des du de en et ou est sont dans sur pour avec par ' +
  'pas mais donc car quand si nous vous ici'
).split(' ');

// French identifier stems for the driver sources, matched against the
// parts of identifiers (snake or camel): configuration, not
// constitution — an extension lands through a pull request, argued
// like any change, and English words stay out on purpose.
const FRENCH_IDENTIFIER_STEMS = new Set(
  (
    'chaine chaines colonne colonnes compte compteur couche couches cree ' +
    'creee creees defaut defauts donnees erreur erreurs etat fichier fichiers ' +
    'memoire noeud noeuds nom reponse reponses requete requetes serialise ' +
    'serialises serialisation serialisations valeur valeurs verifie'
  ).split(' '),
);

// In-scope locations, this instance's dev artifact layer.
const MARKDOWN_ROOT_FLAT = ['.'];
const MARKDOWN_ROOTS_RECURSIVE = ['docs', '.github'];
const CODE_ROOTS = ['scripts'];
const CODE_EXTENSIONS = ['.mjs', '.mts'];
const MARKDOWN_EXTENSIONS = ['.md'];

// Deliberately allowed to hold French, argued per pull request: the
// historical French documents (product vocabulary quoted by the
// project ADRs, the pre-ADR docs, the generated changelog). Fix
// forward, one file per pull request.
const ALLOWED_EXACT = new Set([
  'CHANGELOG.md',
  'docs/deployment.md',
  'docs/labels-study.md',
  'docs/specification.md',
  'docs/archive/filiation.md',
  'docs/decisions/adr-0100-order-as-semantics.md',
  'docs/decisions/adr-0101-checks-as-contracts.md',
  'docs/decisions/adr-0102-registry-as-data.md',
  'docs/decisions/adr-0103-immutable-trunk.md',
  'docs/decisions/adr-0104-mythologie.md',
  'docs/decisions/adr-0105-checks-as-couples.md',
  'docs/decisions/adr-0106-two-regime-algebra.md',
  'docs/decisions/adr-0120-oidc-single-idp-and-three-zones.md',
]);

const IDENTIFIER_REGULAR_EXPRESSION = /[A-Za-z_][A-Za-z_0-9]*/g;
const INLINE_SPAN_REGULAR_EXPRESSION = /`[^`\n]*`/g;
const PART_SPLIT_REGULAR_EXPRESSION = /[_0-9]+|(?<=[a-z])(?=[A-Z])/g;
const STOP_WORD_PATTERN = new RegExp(
  `(?<![A-Za-z0-9-])(${STOP_WORDS.join('|')})(?![A-Za-z0-9-])`,
);

const COMMIT_SUBJECT_ANCHOR = '<commit-subject>';
const FAILING_EVIDENCE_RADIUS = 20;

// ---- corpora of JavaScript and TypeScript sources -------------------

/** Line number at a character position of a text starting at
 * `startLine`. */
function lineAt({ text, startLine, position }) {
  return startLine - 1 + text.slice(0, position).split('\n').length;
}

/** Split source text into comments, strings and identifiers, each
 * segment carrying the line it starts at.
 *
 * The walker tracks line comments, block comments, the three quote
 * kinds and template substitution; a slash after a token-opening
 * character is approximated as a regular expression literal and read
 * as a string (a French word inside a regular expression never
 * reaches the comment or identifier corpus). */
export function splitSource({ text }) {
  const comments = [];
  const strings = [];
  const identifiers = [];
  let mode = 'code';
  let buffer = '';
  let bufferLine = 1;
  let line = 1;
  let quoteKind = '';
  let previousMeaningful = '';
  const openSegment = () => {
    buffer = '';
    bufferLine = line;
  };
  const pushComment = () => {
    if (buffer) comments.push({ text: buffer, line: bufferLine });
    buffer = '';
  };
  const pushString = () => {
    if (buffer) strings.push({ text: buffer, line: bufferLine });
    buffer = '';
  };
  for (let position = 0; position < text.length; position += 1) {
    const character = text[position];
    const next = text[position + 1];
    if (character === '\n') line += 1;
    if (mode === 'code') {
      if (character === '/' && next === '/') {
        openSegment();
        mode = 'line-comment';
        position += 1;
      } else if (character === '/' && next === '*') {
        openSegment();
        mode = 'block-comment';
        position += 1;
      } else if (character === '"' || character === "'") {
        openSegment();
        mode = 'string';
        quoteKind = character;
        buffer += character;
      } else if (character === '`') {
        openSegment();
        mode = 'template';
        buffer += character;
      } else if (character === '/' && /[(,=:[!&|?{;\n]/.test(previousMeaningful)) {
        openSegment();
        buffer += character;
        mode = 'regular-expression';
      } else if (/[A-Za-z_]/.test(character)) {
        let end = position;
        while (end < text.length && /[A-Za-z_0-9]/.test(text[end])) end += 1;
        identifiers.push({ name: text.slice(position, end), line });
        previousMeaningful = text[position];
        position = end - 1;
      } else if (!/\s/.test(character)) {
        previousMeaningful = character;
      }
    } else if (mode === 'line-comment') {
      if (character === '\n') {
        mode = 'code';
        pushComment();
      } else {
        buffer += character;
      }
    } else if (mode === 'block-comment') {
      if (character === '*' && next === '/') {
        buffer += '*/';
        mode = 'code';
        pushComment();
        position += 1;
      } else {
        buffer += character;
      }
    } else if (mode === 'string') {
      buffer += character;
      if (character === '\\') {
        buffer += next ?? '';
        if (next === '\n') line += 1;
        position += 1;
      } else if (character === quoteKind) {
        mode = 'code';
        pushString();
      }
    } else if (mode === 'template') {
      buffer += character;
      if (character === '\\') {
        buffer += next ?? '';
        if (next === '\n') line += 1;
        position += 1;
      } else if (character === '`') {
        mode = 'code';
        pushString();
      } else if (character === '$' && next === '{') {
        // The substitution is code scanning a nesting the walker below
        // does not recurse into: read it to the matching brace into
        // the string corpus (accented characters inside a substitution
        // are still caught, stop-words are not — a documented
        // simplification).
        let depth = 1;
        let cursor = position + 2;
        while (cursor < text.length && depth > 0) {
          if (text[cursor] === '{') depth += 1;
          if (text[cursor] === '}') depth -= 1;
          cursor += 1;
        }
        buffer += text.slice(position + 1, cursor);
        position = cursor - 1;
      }
    } else if (mode === 'regular-expression') {
      buffer += character;
      if (character === '\\') {
        buffer += next ?? '';
        if (next === '\n') line += 1;
        position += 1;
      } else if (character === '/') {
        mode = 'code';
        pushString();
      } else if (character === '\n') {
        // A newline means the slash was division, not a regular
        // expression: re-qualify the buffer as identifiers-only code.
        mode = 'code';
        for (const match of buffer.matchAll(IDENTIFIER_REGULAR_EXPRESSION)) {
          identifiers.push({ name: match[0], line: bufferLine });
        }
        buffer = '';
      }
    }
  }
  if (mode === 'line-comment' || mode === 'block-comment') pushComment();
  else if (mode === 'string' || mode === 'template' || mode === 'regular-expression') pushString();
  return { comments, strings, identifiers };
}

// ---- finding level -------------------------------------------------

/** Find the first accented character in one segment; return evidence
 * with its file line, or null. */
export function firstAccent({ text, startLine }) {
  const match = ACCENT_REGULAR_EXPRESSION.exec(text);
  if (match === null) return null;
  const snippet = text
    .slice(Math.max(0, match.index - FAILING_EVIDENCE_RADIUS), match.index + FAILING_EVIDENCE_RADIUS + 1)
    .replace(/\n/g, ' ');
  return {
    line: lineAt({ text, startLine, position: match.index }),
    evidence: `accented character: ...${snippet}...`,
  };
}

/** Find the first French function word in one segment; return evidence
 * with its file line, or null. */
export function firstStopWord({ text, startLine }) {
  STOP_WORD_PATTERN.lastIndex = 0;
  const match = STOP_WORD_PATTERN.exec(text);
  if (match === null) return null;
  return {
    line: lineAt({ text, startLine, position: match.index }),
    evidence: `French stop-word: ${match[1]}`,
  };
}

/** Tell whether an identifier carries a French stem in its parts. */
export function frenchStemInIdentifier({ identifier }) {
  const parts = identifier.split(PART_SPLIT_REGULAR_EXPRESSION);
  for (const part of parts) {
    if (FRENCH_IDENTIFIER_STEMS.has(part.toLowerCase())) return true;
  }
  return false;
}

/** Find the first accented character or French function word in a
 * comment segment, and the first accent in a string segment: return
 * `{ line, evidence }`, or null. */
export function scanSegment({ text, startLine, withStopWords }) {
  let finding = firstAccent({ text, startLine });
  if (finding === null && withStopWords) finding = firstStopWord({ text, startLine });
  return finding;
}

const FENCED_BLOCK_REGULAR_EXPRESSION = /(?:^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\1[^\n]*/g;

/** Strip fenced blocks and inline spans from Markdown: quoted wire
 * formats inside code formatting never trip the front. */
export function stripMarkdown({ text }) {
  return text
    .replace(FENCED_BLOCK_REGULAR_EXPRESSION, ' ')
    .replace(INLINE_SPAN_REGULAR_EXPRESSION, ' ');
}

// ---- file level ------------------------------------------------------

/** Scan one in-scope file; return the first offender with its file
 * line, or null. Markdown: accents on the stripped prose. Sources:
 * comments (accents, stop-words, stems), then strings (accents),
 * then identifiers (stems). */
export function scanFile({ relative, text }) {
  if (relative.endsWith('.md')) {
    return scanSegment({ text: stripMarkdown({ text }), startLine: 1, withStopWords: false });
  }
  const corpora = splitSource({ text });
  for (const comment of corpora.comments) {
    const finding = scanSegment({ text: comment.text, startLine: comment.line, withStopWords: true });
    if (finding !== null) return finding;
    for (const match of comment.text.matchAll(IDENTIFIER_REGULAR_EXPRESSION)) {
      if (frenchStemInIdentifier({ identifier: match[0] })) {
        return { line: lineAt({ text: comment.text, startLine: comment.line, position: match.index }), evidence: `French identifier: ${match[0]}` };
      }
    }
  }
  for (const string of corpora.strings) {
    const finding = scanSegment({ text: string.text, startLine: string.line, withStopWords: false });
    if (finding !== null) return finding;
  }
  for (const identifier of corpora.identifiers) {
    if (frenchStemInIdentifier({ identifier: identifier.name })) {
      return { line: identifier.line, evidence: `French identifier: ${identifier.name}` };
    }
  }
  return null;
}

/** List every in-scope file, relative to the repository root, POSIX:
 * flat Markdown at the root only, recursive under docs/ and .github/,
 * recursive sources under scripts/. */
export function listScope({ root }) {
  const relatives = [];
  const inScope = (name, extensions) =>
    extensions.some((extension) => name.endsWith(extension));
  const walk = (directory, flat, extensions) => {
    let entries;
    try {
      entries = readdirSync(join(root, directory), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!flat) walk(posix.join(directory, entry.name), false, extensions);
        continue;
      }
      if (!inScope(entry.name, extensions)) continue;
      relatives.push(posix.join(directory, entry.name));
    }
  };
  for (const markdownRoot of MARKDOWN_ROOT_FLAT) walk(markdownRoot, true, MARKDOWN_EXTENSIONS);
  for (const markdownRoot of MARKDOWN_ROOTS_RECURSIVE) walk(markdownRoot, false, MARKDOWN_EXTENSIONS);
  for (const codeRoot of CODE_ROOTS) walk(codeRoot, false, CODE_EXTENSIONS);
  return [...new Set(relatives)];
}

/** Scan the whole scope; return one offender record per file. */
export function scanRepository({ root }) {
  const offenders = [];
  for (const relative of listScope({ root })) {
    if (ALLOWED_EXACT.has(relative)) continue;
    let text;
    try {
      text = readFileSync(join(root, relative.split('/').join(sep)), 'utf8');
    } catch {
      return { offenders, refused: relative };
    }
    const offender = scanFile({ relative, text });
    if (offender !== null) {
      offenders.push({ file: relative, line: offender.line, evidence: offender.evidence });
    }
  }
  return { offenders, refused: null };
}

/** Render one offender as `file:line: evidence`. */
export function renderOffender({ offender }) {
  const location = offender.line ? `${offender.file}:${offender.line}` : offender.file;
  return `${location}: ${offender.evidence}`;
}

// ---- the subject shape (commit-msg hook) ----------------------------

/** Scan a commit subject: accents and stop-words, prose rules only. */
export function scanSubject({ subject }) {
  const finding = scanSegment({ text: subject, startLine: 1, withStopWords: true });
  if (finding === null) return null;
  return { file: COMMIT_SUBJECT_ANCHOR, line: finding.line, evidence: finding.evidence };
}

// ---- entry point ------------------------------------------------------

function parseArguments({ args }) {
  const subjectFileIndex = args.indexOf('--subject-file');
  if (subjectFileIndex === -1) return { subjectFilePath: null };
  const subjectFilePath = args[subjectFileIndex + 1];
  return { subjectFilePath: subjectFilePath ?? null };
}

export function run({ args = [], root = process.cwd() } = {}) {
  const { subjectFilePath } = parseArguments({ args });
  if (subjectFilePath !== null) {
    let message;
    try {
      message = readFileSync(subjectFilePath, 'utf8');
    } catch {
      console.error(`english-only: could not read the commit message file: ${subjectFilePath}.`);
      return EXIT_CODE_PROTOCOL_FAILURE;
    }
    const subject = message.split('\n')[0] ?? '';
    const offender = scanSubject({ subject });
    if (offender !== null) {
      console.log(`english-only: ${renderOffender({ offender })}`);
      console.log('english-only: the commit subject must be English (ADR-0008 N4).');
      return EXIT_CODE_CRITERIA_UNMET;
    }
    return EXIT_CODE_SUCCESS;
  }
  const { offenders, refused } = scanRepository({ root });
  for (const offender of offenders) {
    console.log(`english-only: ${renderOffender({ offender })}`);
  }
  if (refused !== null) {
    console.error(`english-only: could not read the in-scope file ${refused}.`);
    return EXIT_CODE_PROTOCOL_FAILURE;
  }
  if (offenders.length > 0) {
    console.log(
      `english-only: ${offenders.length} offender(s): development artifacts are English-only (ADR-0008 G4, N4).`,
    );
    return EXIT_CODE_CRITERIA_UNMET;
  }
  return EXIT_CODE_SUCCESS;
}
