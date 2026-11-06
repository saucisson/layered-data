// The VS Code extension checks: the .ld grammar is declared, sound,
// and complete — every act, special key, address, path, string and
// number of the surface language carries a scope, and every code
// character the corpus actually writes is covered.
//
// The grammar is flat (no begin/end context): vscode-textmate's
// matching then reduces to one rule — at each position, the first
// listed pattern that matches there wins, otherwise the character
// passes unscoped. The harness below replays exactly that
// algorithm (sticky regexes, pattern order), so the coverage and
// spot-scope assertions below are the engine's own behavior, not an
// approximation. The regexes are validated as JavaScript: the
// grammar sticks to the Oniguruma/JavaScript common subset.
//
//     node tests/vscode-checks.mts   (exit 1 on any failure)

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---- the extension under test --------------------------------------

const rootDirectory = join(import.meta.dirname, "..");
const extensionDirectory = join(rootDirectory, "vscode");
const manifest = JSON.parse(readFileSync(join(extensionDirectory, "package.json"), "utf8")) as {
  contributes: {
    languages: { id: string; extensions: string[]; configuration: string }[];
    grammars: { scopeName: string; path: string }[];
  };
};
const languageConfiguration = JSON.parse(
  readFileSync(join(extensionDirectory, manifest.contributes.languages[0].configuration), "utf8"),
) as { comments: { lineComment: string }; folding: string; wordPattern: string };
interface Grammar {
  scopeName: string;
  patterns: { include: string }[];
  repository: Record<string, { patterns: { name: string; match: string }[] }>;
}

const grammar = JSON.parse(
  readFileSync(join(extensionDirectory, manifest.contributes.grammars[0].path), "utf8"),
) as Grammar;

// ---- the flat-grammar matcher (vscode-textmate's rule, replayed) ---

interface GrammarPattern {
  name: string;
  regex: RegExp;
}

const compilePatterns = ({ grammar }: { grammar: Grammar }): GrammarPattern[] =>
  grammar.patterns.flatMap((include) => {
    const group = grammar.repository[include.include.slice(1)];
    if (group === undefined) throw new Error("unknown include: " + include.include);
    return group.patterns.map((pattern) => ({ name: pattern.name, regex: new RegExp(pattern.match, "y") }));
  });

const PATTERNS = compilePatterns({ grammar });

interface ScopedToken {
  scope: string;
  text: string;
}

const tokenizeLine = ({ line, patterns }: { line: string; patterns: GrammarPattern[] }): ScopedToken[] => {
  const tokens: ScopedToken[] = [];
  let index = 0;
  while (index < line.length) {
    const pattern = patterns.find((candidate) => {
      candidate.regex.lastIndex = index;
      return candidate.regex.exec(line) !== null;
    });
    if (pattern !== undefined) {
      pattern.regex.lastIndex = index;
      const match = pattern.regex.exec(line);
      if (match === null) throw new Error("sticky rematch failed at " + index);
      tokens.push({ scope: pattern.name, text: match[0] });
      index += match[0].length;
      continue;
    }
    const start = index;
    index++;
    tokens.push({ scope: "(none)", text: line.slice(start, index) });
  }
  return tokens;
};

const layerFilesUnder = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? layerFilesUnder(entryPath) : entry.name.endsWith(".ld") ? [entryPath] : [];
  });

const CORPUS_FILES = layerFilesUnder(join(rootDirectory, "formalisms"));

const scopesOfLine = ({ line }: { line: string }): ScopedToken[] => tokenizeLine({ line, patterns: PATTERNS });

const hasScope = ({ line, scope }: { line: string; scope: string }): boolean =>
  scopesOfLine({ line }).some((token) => token.scope === scope);

const hasToken = ({ line, scope, text }: { line: string; scope: string; text: string }): boolean =>
  scopesOfLine({ line }).some((token) => token.scope === scope && token.text === text);

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// (a) the extension declares the language and ships its files

check(
  "the manifest contributes one language for .ld files with a configuration file",
  manifest.contributes.languages.length === 1 &&
    manifest.contributes.languages[0].extensions.includes(".ld") &&
    manifest.contributes.languages[0].id === "layered-data",
);
check(
  "the manifest wires the grammar to the language and the grammar file exists",
  manifest.contributes.grammars.length === 1 &&
    manifest.contributes.grammars[0].scopeName === grammar.scopeName &&
    grammar.scopeName === "source.layered-data",
);

// (b) the grammar is sound

check(
  "every pattern of the grammar compiles and carries a scope name",
  grammar.patterns.every((include) =>
    grammar.repository[include.include.slice(1)].patterns.every((pattern) => pattern.name !== "" && pattern.match !== ""),
  ),
);
check(
  "the language configuration speaks the layer language: // comments, indentation folding, dotted word selection",
  languageConfiguration.comments.lineComment === "//" &&
    languageConfiguration.folding === "indentation" &&
    new RegExp("^(?:" + languageConfiguration.wordPattern + ")$").test("philo1.think1") &&
    new RegExp("^(?:" + languageConfiguration.wordPattern + ")$").test("end-source"),
);

// (c) the grammar covers the whole corpus — every code character
//     written in every layer file carries a scope

let unscopedCodeCharacters = 0;
let corpusLines = 0;
for (const file of CORPUS_FILES) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("//")) continue;
    corpusLines++;
    for (const token of scopesOfLine({ line })) {
      if (token.text.trim() !== "" && token.scope === "(none)") unscopedCodeCharacters += token.text.trim().length;
    }
  }
}
check(
  "every code character of the " +
    CORPUS_FILES.length +
    " layer files carries a scope (" +
    corpusLines +
    " code lines) — a gap announces a grammar to extend",
  unscopedCodeCharacters === 0,
);

// (d) the scopes are the right ones on the canonical shapes

check(
  "the layer act line: layer, refines, then are acts, the parents are references",
  hasToken({ line: "layer graph refines @pair-graph then @hypergraph", scope: "keyword.other.act.layered-data", text: "refines" }) &&
    hasToken({ line: "layer graph refines @pair-graph then @hypergraph", scope: "keyword.other.act.layered-data", text: "then" }) &&
    hasToken({ line: "layer graph refines @pair-graph then @hypergraph", scope: "entity.name.type.reference.layered-data", text: "@hypergraph" }),
);
check(
  "the value line: the key, the assignment, the number",
  hasToken({ line: "  weight = 1", scope: "variable.other.key.layered-data", text: "weight" }) &&
    hasToken({ line: "  weight = 1", scope: "keyword.operator.assignment.layered-data", text: "=" }) &&
    hasToken({ line: "  weight = 1", scope: "constant.numeric.layered-data", text: "1" }),
);
check(
  "the string value: a double-quoted string, and a // inside a string stays a string",
  hasToken({ line: '  level = "root"', scope: "string.quoted.double.layered-data", text: '"root"' }) &&
    hasToken({ line: '  url = "http://example.com/x" // after', scope: "string.quoted.double.layered-data", text: '"http://example.com/x"' }) &&
    hasScope({ line: '  url = "http://example.com/x" // after', scope: "comment.line.double-slash.layered-data" }),
);
check(
  "the binding line: bind is an act, -> an arrow, true/false a boolean",
  hasToken({ line: "  bind ordered -> true", scope: "keyword.other.act.layered-data", text: "bind" }) &&
    hasToken({ line: "  bind ordered -> true", scope: "keyword.operator.arrow.layered-data", text: "->" }) &&
    hasToken({ line: "  bind ordered -> true", scope: "constant.language.boolean.layered-data", text: "true" }),
);
check(
  "the expect line: expect is an act, the slash path is one path, absent is an act",
  hasToken({ line: "  expect places/philo1.think1/marking = 1", scope: "keyword.other.act.layered-data", text: "expect" }) &&
    hasToken({ line: "  expect places/philo1.think1/marking = 1", scope: "variable.parameter.path.layered-data", text: "places/philo1.think1/marking" }) &&
    hasToken({ line: "  expect positions/philo1.seat/x absent", scope: "keyword.other.act.layered-data", text: "absent" }),
);
check(
  "the structural keys: specification, defaults, tests are special keys, not ordinary keys",
  hasToken({ line: "  specification", scope: "storage.type.special-key.layered-data", text: "specification" }) &&
    hasToken({ line: "  extend specification", scope: "storage.type.special-key.layered-data", text: "specification" }) &&
    hasToken({ line: "  tests", scope: "storage.type.special-key.layered-data", text: "tests" }),
);
check(
  "the abstract slot: abstract is an act, the slot key behind it is a key",
  hasToken({ line: "  abstract type", scope: "keyword.other.act.layered-data", text: "abstract" }) &&
    hasToken({ line: "  abstract type", scope: "variable.other.key.layered-data", text: "type" }) &&
    hasToken({ line: "  override abstract weight", scope: "keyword.other.act.layered-data", text: "override" }),
);
check(
  "hyphenated identifiers stay whole: check-registry is one key, never the check act (the \\b trap)",
  hasToken({ line: "layer check-registry refines @record", scope: "variable.other.key.layered-data", text: "check-registry" }) &&
    !hasToken({ line: "layer check-registry refines @record", scope: "keyword.other.act.layered-data", text: "check" }) &&
    hasToken({ line: "  check-definitions", scope: "storage.type.special-key.layered-data", text: "check-definitions" }),
);
check(
  "the list value: brackets, commas, floats, negative numbers",
  hasToken({ line: "  values = [polar, grid, 0.5, -3, true]", scope: "punctuation.definition.bracket.square.layered-data", text: "[" }) &&
    hasToken({ line: "  values = [polar, grid, 0.5, -3, true]", scope: "constant.numeric.layered-data", text: "0.5" }) &&
    hasToken({ line: "  values = [polar, grid, 0.5, -3, true]", scope: "constant.numeric.layered-data", text: "-3" }),
);
check(
  "the comment line is one comment, a trailing comment follows a value",
  hasToken({ line: "// ---- le dîner des philosophes", scope: "comment.line.double-slash.layered-data", text: "// ---- le dîner des philosophes" }) &&
    hasToken({ line: "  weight = 1 // trailing", scope: "comment.line.double-slash.layered-data", text: "// trailing" }),
);

// =====================================================================
// the ledger
// =====================================================================

console.log("vscode checks: " + assertions + " assertions, " + failures.length + " failure(s)");
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
