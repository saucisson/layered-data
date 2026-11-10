// The VS Code extension checks: the .ld grammar is declared, sound,
// and complete — every act, special key, address, path, string and
// number of the surface language carries a scope, and every code
// character the corpus actually writes is covered. The linter and
// the completion CLI are pinned on real corpora and real shapes.
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

import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

// ---- the extension under test --------------------------------------

const rootDirectory = join(import.meta.dirname, "..");
const extensionDirectory = join(rootDirectory, "vscode");
const manifest = JSON.parse(
  readFileSync(join(extensionDirectory, "package.json"), "utf8"),
) as {
  main: string;
  contributes: {
    languages: { id: string; extensions: string[]; configuration: string }[];
    grammars: { scopeName: string; path: string }[];
    commands: { command: string }[];
  };
};
const languageConfiguration = JSON.parse(
  readFileSync(
    join(
      extensionDirectory,
      at(manifest.contributes.languages, 0).configuration,
    ),
    "utf8",
  ),
) as {
  comments: { lineComment: string };
  folding: string;
  wordPattern: string;
};
interface Grammar {
  scopeName: string;
  patterns: { include: string }[];
  repository: Record<string, { patterns: { name: string; match: string }[] }>;
}

const grammar = JSON.parse(
  readFileSync(
    join(extensionDirectory, at(manifest.contributes.grammars, 0).path),
    "utf8",
  ),
) as Grammar;

// ---- the flat-grammar matcher (vscode-textmate's rule, replayed) ---

interface GrammarPattern {
  name: string;
  regex: RegExp;
}

const compilePatterns = ({ grammar }: { grammar: Grammar }): GrammarPattern[] =>
  grammar.patterns.flatMap((include) => {
    const group = grammar.repository[include.include.slice(1)];
    if (group === undefined)
      throw new Error("unknown include: " + include.include);
    return group.patterns.map((pattern) => ({
      name: pattern.name,
      regex: new RegExp(pattern.match, "y"),
    }));
  });

const PATTERNS = compilePatterns({ grammar });

interface ScopedToken {
  scope: string;
  text: string;
}

const tokenizeLine = ({
  line,
  patterns,
}: {
  line: string;
  patterns: GrammarPattern[];
}): ScopedToken[] => {
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
      tokens.push({ scope: pattern.name, text: at(match, 0) });
      index += at(match, 0).length;
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
    return entry.isDirectory()
      ? layerFilesUnder(entryPath)
      : entry.name.endsWith(".ld")
        ? [entryPath]
        : [];
  });

const CORPUS_FILES = layerFilesUnder(join(rootDirectory, "formalisms"));

const scopesOfLine = ({ line }: { line: string }): ScopedToken[] =>
  tokenizeLine({ line, patterns: PATTERNS });

const hasScope = ({ line, scope }: { line: string; scope: string }): boolean =>
  scopesOfLine({ line }).some((token) => token.scope === scope);

const hasToken = ({
  line,
  scope,
  text,
}: {
  line: string;
  scope: string;
  text: string;
}): boolean =>
  scopesOfLine({ line }).some(
    (token) => token.scope === scope && token.text === text,
  );

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// (a) the extension declares the language and ships its files

/** Indexed access in assertions: a missing element is a test failure,
 * not a silent undefined. */
function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error("missing element at index " + index);
  return value;
}

check(
  "the manifest contributes one language for .ld files with a configuration file",
  manifest.contributes.languages.length === 1 &&
    at(manifest.contributes.languages, 0).extensions.includes(".ld") &&
    at(manifest.contributes.languages, 0).id === "layered-data",
);
check(
  "the manifest wires the grammar to the language and the grammar file exists",
  manifest.contributes.grammars.length === 1 &&
    at(manifest.contributes.grammars, 0).scopeName === grammar.scopeName &&
    grammar.scopeName === "source.layered-data",
);

// (b) the grammar is sound

check(
  "every pattern of the grammar compiles and carries a scope name",
  grammar.patterns.every((include) =>
    (grammar.repository[include.include.slice(1)]?.patterns ?? []).every(
      (pattern) => pattern.name !== "" && pattern.match !== "",
    ),
  ),
);
check(
  "the language configuration speaks the layer language: // comments, indentation folding, dotted word selection",
  languageConfiguration.comments.lineComment === "//" &&
    languageConfiguration.folding === "indentation" &&
    new RegExp("^(?:" + languageConfiguration.wordPattern + ")$").test(
      "philo1.think1",
    ) &&
    new RegExp("^(?:" + languageConfiguration.wordPattern + ")$").test(
      "end-source",
    ),
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
      if (token.text.trim() !== "" && token.scope === "(none)")
        unscopedCodeCharacters += token.text.trim().length;
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
  hasToken({
    line: "layer graph refines @pair-graph then @hypergraph",
    scope: "keyword.other.act.layered-data",
    text: "refines",
  }) &&
    hasToken({
      line: "layer graph refines @pair-graph then @hypergraph",
      scope: "keyword.other.act.layered-data",
      text: "then",
    }) &&
    hasToken({
      line: "layer graph refines @pair-graph then @hypergraph",
      scope: "entity.name.type.reference.layered-data",
      text: "@hypergraph",
    }),
);
check(
  "the value line: the key, the assignment, the number",
  hasToken({
    line: "  weight = 1",
    scope: "variable.other.key.layered-data",
    text: "weight",
  }) &&
    hasToken({
      line: "  weight = 1",
      scope: "keyword.operator.assignment.layered-data",
      text: "=",
    }) &&
    hasToken({
      line: "  weight = 1",
      scope: "constant.numeric.layered-data",
      text: "1",
    }),
);
check(
  "the string value: a double-quoted string, and a // inside a string stays a string",
  hasToken({
    line: '  level = "root"',
    scope: "string.quoted.double.layered-data",
    text: '"root"',
  }) &&
    hasToken({
      line: '  url = "http://example.com/x" // after',
      scope: "string.quoted.double.layered-data",
      text: '"http://example.com/x"',
    }) &&
    hasScope({
      line: '  url = "http://example.com/x" // after',
      scope: "comment.line.double-slash.layered-data",
    }),
);
check(
  "the binding line: bind is an act, -> an arrow, true/false a boolean",
  hasToken({
    line: "  bind ordered -> true",
    scope: "keyword.other.act.layered-data",
    text: "bind",
  }) &&
    hasToken({
      line: "  bind ordered -> true",
      scope: "keyword.operator.arrow.layered-data",
      text: "->",
    }) &&
    hasToken({
      line: "  bind ordered -> true",
      scope: "constant.language.boolean.layered-data",
      text: "true",
    }),
);
check(
  "the expect line: expect is an act, the slash path is one path, absent is an act",
  hasToken({
    line: "  expect places/philo1.think1/marking = 1",
    scope: "keyword.other.act.layered-data",
    text: "expect",
  }) &&
    hasToken({
      line: "  expect places/philo1.think1/marking = 1",
      scope: "variable.parameter.path.layered-data",
      text: "places/philo1.think1/marking",
    }) &&
    hasToken({
      line: "  expect positions/philo1.seat/x absent",
      scope: "keyword.other.act.layered-data",
      text: "absent",
    }),
);
check(
  "the structural keys: specification, defaults, tests are special keys, not ordinary keys",
  hasToken({
    line: "  specification",
    scope: "storage.type.special-key.layered-data",
    text: "specification",
  }) &&
    hasToken({
      line: "  extend specification",
      scope: "storage.type.special-key.layered-data",
      text: "specification",
    }) &&
    hasToken({
      line: "  tests",
      scope: "storage.type.special-key.layered-data",
      text: "tests",
    }),
);
check(
  "the abstract slot: abstract is an act, the slot key behind it is a key",
  hasToken({
    line: "  abstract type",
    scope: "keyword.other.act.layered-data",
    text: "abstract",
  }) &&
    hasToken({
      line: "  abstract type",
      scope: "variable.other.key.layered-data",
      text: "type",
    }) &&
    hasToken({
      line: "  override abstract weight",
      scope: "keyword.other.act.layered-data",
      text: "override",
    }),
);
check(
  "hyphenated identifiers stay whole: check-registry is one key, never the check act (the \\b trap)",
  hasToken({
    line: "layer check-registry refines @record",
    scope: "variable.other.key.layered-data",
    text: "check-registry",
  }) &&
    !hasToken({
      line: "layer check-registry refines @record",
      scope: "keyword.other.act.layered-data",
      text: "check",
    }) &&
    hasToken({
      line: "  check-definitions",
      scope: "storage.type.special-key.layered-data",
      text: "check-definitions",
    }),
);
check(
  "the list value: brackets, commas, floats, negative numbers",
  hasToken({
    line: "  values = [polar, grid, 0.5, -3, true]",
    scope: "punctuation.definition.bracket.square.layered-data",
    text: "[",
  }) &&
    hasToken({
      line: "  values = [polar, grid, 0.5, -3, true]",
      scope: "constant.numeric.layered-data",
      text: "0.5",
    }) &&
    hasToken({
      line: "  values = [polar, grid, 0.5, -3, true]",
      scope: "constant.numeric.layered-data",
      text: "-3",
    }),
);
check(
  "the comment line is one comment, a trailing comment follows a value",
  hasToken({
    line: "// ---- le dîner des philosophes",
    scope: "comment.line.double-slash.layered-data",
    text: "// ---- le dîner des philosophes",
  }) &&
    hasToken({
      line: "  weight = 1 // trailing",
      scope: "comment.line.double-slash.layered-data",
      text: "// trailing",
    }),
);

// (e) the linter: the CLI reuses the kernel and answers in JSON —
//     silent on the pristine corpus, precise on broken ones

interface LintAnswer {
  version: number;
  language: string;
  diagnostics: {
    file: string;
    line: number;
    severity: string;
    message: string;
    code: string;
  }[];
}

const runLinter = ({
  root,
  kernel,
}: {
  root: string;
  kernel?: string;
}): LintAnswer => {
  const args = [join(extensionDirectory, "linter.mts"), "--root", root];
  if (kernel !== undefined) args.push("--kernel", kernel);
  const run = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (run.status !== 0 || run.stdout === "") {
    throw new Error("linter run failed: " + String(run.stderr));
  }
  return JSON.parse(run.stdout) as LintAnswer;
};

const brokenCorpus = ({
  mutate,
}: {
  mutate: (kernelDirectory: string) => void;
}): string => {
  const caseRoot = mkdtempSync(join(tmpdir(), "layered-data-lint-"));
  cpSync(
    join(rootDirectory, "formalisms", "kernel"),
    join(caseRoot, "formalisms", "kernel"),
    { recursive: true },
  );
  mutate(join(caseRoot, "formalisms", "kernel"));
  return caseRoot;
};

const pristineAnswer = runLinter({ root: rootDirectory });
check(
  "the linter answers in JSON (version 1) and stays silent on the pristine corpus",
  pristineAnswer.version === 1 && pristineAnswer.diagnostics.length === 0,
);

const explicitKernelAnswer = runLinter({
  root: rootDirectory,
  kernel: join(rootDirectory, "src"),
});
check(
  "the kernel directory is addressable with --kernel — an extension installed as a .vsix has no ../src of its own",
  explicitKernelAnswer.version === 1 &&
    explicitKernelAnswer.diagnostics.length === 0,
);

const syntaxRoot = brokenCorpus({
  mutate: (kernelDirectory) => {
    writeFileSync(
      join(kernelDirectory, "record.ld"),
      "layer record\n\tspecification\n",
    );
  },
});
const syntaxAnswer = runLinter({ root: syntaxRoot });
rmSync(syntaxRoot, { recursive: true, force: true });
check(
  "a tab in a kernel layer is one syntax diagnostic at its own line, and the assembly pass suspends (it cannot judge a text it cannot read)",
  syntaxAnswer.diagnostics.length === 1 &&
    at(syntaxAnswer.diagnostics, 0).file === "formalisms/kernel/record.ld" &&
    at(syntaxAnswer.diagnostics, 0).line === 2 &&
    at(syntaxAnswer.diagnostics, 0).code === "syntaxe",
);

const betrayedRoot = brokenCorpus({
  mutate: (kernelDirectory) => {
    const file = join(kernelDirectory, "pn-philosophers-5.ld");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(
        "expect places/philo1.think1/marking = 1",
        "expect places/philo1.think1/marking = 7",
      ),
    );
  },
});
const betrayedAnswer = runLinter({ root: betrayedRoot });
const betrayedLine =
  readFileSync(
    join(rootDirectory, "formalisms", "kernel", "pn-philosophers-5.ld"),
    "utf8",
  )
    .split("\n")
    .findIndex((line) =>
      line.trim().startsWith("expect places/philo1.think1/marking"),
    ) + 1;
rmSync(betrayedRoot, { recursive: true, force: true });
check(
  "a betrayed expect is a verdict on its own expect line, rendered in French",
  betrayedAnswer.diagnostics.length === 1 &&
    at(betrayedAnswer.diagnostics, 0).file ===
      "formalisms/kernel/pn-philosophers-5.ld" &&
    at(betrayedAnswer.diagnostics, 0).line === betrayedLine &&
    at(betrayedAnswer.diagnostics, 0).code === "attendu-trahi" &&
    at(betrayedAnswer.diagnostics, 0).message.includes("attendu 7, lu 1"),
);

const overloadRoot = brokenCorpus({
  mutate: (kernelDirectory) => {
    const file = join(kernelDirectory, "pn-philosophers.ld");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(
        "override abstract weight",
        "abstract weight",
      ),
    );
  },
});
const overloadAnswer = runLinter({ root: overloadRoot });
rmSync(overloadRoot, { recursive: true, force: true });
check(
  "an undeclared overload is a verdict pinned on its layer's file",
  overloadAnswer.diagnostics.length === 1 &&
    at(overloadAnswer.diagnostics, 0).file ===
      "formalisms/kernel/pn-philosophers.ld" &&
    at(overloadAnswer.diagnostics, 0).code === "surcharge-implicite",
);

const mixedRoot = brokenCorpus({
  mutate: (kernelDirectory) => {
    const file = join(kernelDirectory, "pn-philosophers.ld");
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(
        "override abstract weight",
        "abstract weight",
      ),
    );
    mkdirSync(join(kernelDirectory, "..", "users"), { recursive: true });
    writeFileSync(
      join(kernelDirectory, "..", "users", "draft.ld"),
      "layer user-draft\n\tbroken\n",
    );
  },
});
const mixedAnswer = runLinter({ root: mixedRoot });
rmSync(mixedRoot, { recursive: true, force: true });
check(
  "a syntax error outside the kernel (a users draft) suspends nothing: both the draft's line and the kernel's verdict show",
  mixedAnswer.diagnostics.length === 2 &&
    mixedAnswer.diagnostics.some(
      (entry) =>
        entry.file === "formalisms/users/draft.ld" &&
        entry.line === 2 &&
        entry.code === "syntaxe",
    ) &&
    mixedAnswer.diagnostics.some(
      (entry) =>
        entry.file === "formalisms/kernel/pn-philosophers.ld" &&
        entry.code === "surcharge-implicite",
    ),
);

// (f) the extension glue: no dependency, no build — thin enough to
//     check structurally (the JSON contract itself is pinned above)

const extensionSource = readFileSync(
  join(extensionDirectory, "extension.js"),
  "utf8",
);
const extensionSyntax = spawnSync(
  process.execPath,
  ["--check", join(extensionDirectory, "extension.js")],
  { encoding: "utf8" },
);
check(
  "the extension glue parses (node --check) and wires the linter: it spawns linter.mts with the configured Node, debounces, and maps the JSON to diagnostics",
  extensionSyntax.status === 0 &&
    extensionSource.includes('"layered-data.lint"') &&
    extensionSource.includes("linter.mts") &&
    extensionSource.includes("nodePath") &&
    extensionSource.includes('"--kernel"') &&
    manifest.main === "./extension.js" &&
    manifest.contributes.commands.some(
      (command: { command: string }) => command.command === "layered-data.lint",
    ),
);

// (g) the completion CLI: the kernel answers in JSON with useful
//     suggestions on the canonical shapes — acts, layers, keys

interface CompletionAnswer {
  version: number;
  language: string;
  completions: { label: string; kind: string; detail: string }[];
}

const runCompletion = ({
  source,
  line,
  character,
  root = rootDirectory,
  kernel,
}: {
  source: string;
  line: number;
  character: number;
  root?: string;
  kernel?: string;
}): CompletionAnswer => {
  const args = [
    join(extensionDirectory, "completion.mts"),
    "--root",
    root,
    "--line",
    String(line),
    "--character",
    String(character),
  ];
  if (kernel !== undefined) args.push("--kernel", kernel);
  const run = spawnSync(process.execPath, args, {
    input: source,
    encoding: "utf8",
  });
  if (run.status !== 0 || run.stdout === "") {
    throw new Error("completion run failed: " + String(run.stderr));
  }
  return JSON.parse(run.stdout) as CompletionAnswer;
};

const labelsOf = (answer: CompletionAnswer): string[] =>
  answer.completions.map((entry) => entry.label);

const topLevelAnswer = runCompletion({ source: "", line: 1, character: 0 });
check(
  "at the margin the completion proposes the layer act",
  topLevelAnswer.version === 1 &&
    labelsOf(topLevelAnswer).includes("layer") &&
    topLevelAnswer.completions.some(
      (entry) => entry.label === "layer" && entry.kind === "act",
    ),
);

const blockAnswer = runCompletion({
  source: "layer record\n  ",
  line: 2,
  character: 2,
});
check(
  "inside a layer block the completion proposes the member acts and the special keys",
  ["extend", "override", "abstract", "bind", "check", "expect"].every((label) =>
    labelsOf(blockAnswer).includes(label),
  ) &&
    blockAnswer.completions.some(
      (entry) => entry.label === "specification" && entry.kind === "key",
    ),
);

const partialAnswer = runCompletion({
  source: "layer record\n  exp",
  line: 2,
  character: 5,
});
check(
  "a partial word filters the suggestions (exp → expect, nothing else)",
  labelsOf(partialAnswer).length > 0 &&
    labelsOf(partialAnswer).every((label) => label.startsWith("exp")) &&
    labelsOf(partialAnswer).includes("expect"),
);

const refinesAnswer = runCompletion({
  source: "layer graph refines @pa",
  line: 1,
  character: 23,
});
check(
  "after refines @ the completion proposes the kernel layers matching the prefix",
  refinesAnswer.completions.some(
    (entry) => entry.label === "pair-graph" && entry.kind === "layer",
  ) &&
    refinesAnswer.completions.every(
      (entry) => entry.kind === "layer" && entry.label.startsWith("pa"),
    ),
);

const draftAnswer = runCompletion({
  source: "layer my-draft refines @",
  line: 1,
  character: 24,
});
check(
  "a layer declared by the edited source itself is proposed too",
  labelsOf(draftAnswer).includes("my-draft") &&
    labelsOf(draftAnswer).includes("record"),
);

const pathAnswer = runCompletion({
  source: "layer graph refines @pair-graph/",
  line: 1,
  character: 32,
});
check(
  "after @layer/ the completion proposes the keys of that layer in the space",
  pathAnswer.completions.some(
    (entry) => entry.label === "edge_type" && entry.kind === "key",
  ),
);

const expectAnswer = runCompletion({
  source: "layer pair-graph\n  expect ",
  line: 2,
  character: 9,
});
check(
  "after expect the completion proposes the keys of the current layer",
  labelsOf(expectAnswer).includes("edge_type"),
);

const explicitKernelCompletion = runCompletion({
  source: "layer graph refines @pa",
  line: 1,
  character: 23,
  kernel: join(rootDirectory, "src"),
});
check(
  "the completion CLI addresses the kernel with --kernel, like the linter",
  explicitKernelCompletion.version === 1 &&
    labelsOf(explicitKernelCompletion).includes("pair-graph"),
);

check(
  "the extension glue wires the completion provider: it spawns completion.mts with the document on stdin and registers the provider on @ and /",
  extensionSyntax.status === 0 &&
    extensionSource.includes("registerCompletionItemProvider") &&
    extensionSource.includes("completion.mts") &&
    extensionSource.includes("child.stdin.write(document.getText())"),
);

// =====================================================================
// the ledger
// =====================================================================

console.log(
  "vscode checks: " +
    assertions +
    " assertions, " +
    failures.length +
    " failure(s)",
);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
