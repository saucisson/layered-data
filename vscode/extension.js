// The Layered Data extension glue: no dependency, no build — the
// linter is the CLI (linter.mts), which reuses the kernel the
// workshop runs; this file only spawns it and maps its JSON answer
// to VS Code diagnostics. Plain CommonJS on purpose: the extension
// host loads it as is.
//
// The Node binary comes from the layered-data.nodePath setting
// (default "node"): the CLI needs native type stripping (22.18+),
// the same runtime the repo's harnesses need.

const vscode = require("vscode");
const { spawn } = require("node:child_process");
const path = require("node:path");

const DEBOUNCE_MILLISECONDS = 400;
const LINE_WIDTH_FOR_SQUIGGLE = 1000;

let runToken = 0;
let debounceTimer = undefined;

function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection("layered-data");
  const linterScript = path.join(context.extensionPath, "linter.mts");
  const completionScript = path.join(context.extensionPath, "completion.mts");
  const configuration = () => vscode.workspace.getConfiguration("layered-data");

  const rootPath = () => {
    const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
    return folder ? folder.uri.fsPath : undefined;
  };

  const toDiagnostic = (entry) => {
    const line = Math.max(0, Math.floor(entry.line) - 1);
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(line, 0, line, LINE_WIDTH_FOR_SQUIGGLE),
      entry.message,
      vscode.DiagnosticSeverity.Error,
    );
    diagnostic.source = "layered-data";
    diagnostic.code = entry.code;
    return diagnostic;
  };

  const lint = () => {
    const root = rootPath();
    if (root === undefined) return;
    const token = ++runToken;
    const child = spawn(
      configuration().get("nodePath") || "node",
      [
        linterScript,
        "--root", root,
        // the kernel sources: the workspace's src/ — the extension may
        // be installed as a .vsix outside the repo, so ../src would miss
        "--kernel", path.join(root, "src"),
        "--language", configuration().get("language") || "fr",
      ],
      { cwd: root },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      vscode.window.showErrorMessage("layered-data : linter inaccessible — " + String(error));
    });
    child.on("close", (code) => {
      if (token !== runToken) return; // a newer run supersedes this one
      if (code !== 0) {
        vscode.window.showErrorMessage("layered-data : linter échoué — " + (stderr.trim() || "exit " + code));
        return;
      }
      let answer;
      try {
        answer = JSON.parse(stdout);
      } catch {
        vscode.window.showErrorMessage("layered-data : réponse du linter illisible");
        return;
      }
      const perFile = new Map();
      for (const entry of answer.diagnostics) {
        const file = path.join(root, entry.file);
        if (!perFile.has(file)) perFile.set(file, []);
        perFile.get(file).push(toDiagnostic(entry));
      }
      collection.clear();
      for (const [file, entries] of perFile) {
        collection.set(vscode.Uri.file(file), entries);
      }
    });
  };

  const lintSoon = () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(lint, DEBOUNCE_MILLISECONDS);
  };

  // The completion CLI: the document text goes on stdin (unsaved
  // keystrokes included), the cursor as arguments; the JSON answer
  // maps to completion items. Completion stays silent on failure —
  // unlike the linter, a missing suggestion is not an error to show.
  const completionKindOf = (kind) =>
    kind === "layer"
      ? vscode.CompletionItemKind.Module
      : kind === "key"
        ? vscode.CompletionItemKind.Field
        : vscode.CompletionItemKind.Keyword;

  const complete = (document, position) =>
    new Promise((resolve) => {
      const root = rootPath();
      if (root === undefined) {
        resolve([]);
        return;
      }
      const child = spawn(
        configuration().get("nodePath") || "node",
        [
          completionScript,
          "--root", root,
          "--kernel", path.join(root, "src"),
          "--language", configuration().get("language") || "fr",
          "--line", String(position.line + 1),
          "--character", String(position.character),
        ],
        { cwd: root },
      );
      let stdout = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.on("error", () => resolve([]));
      child.on("close", (code) => {
        if (code !== 0) {
          resolve([]);
          return;
        }
        try {
          const answer = JSON.parse(stdout);
          resolve(
            answer.completions.map((entry) => {
              const item = new vscode.CompletionItem(entry.label, completionKindOf(entry.kind));
              item.detail = entry.detail;
              return item;
            }),
          );
        } catch {
          resolve([]);
        }
      });
      child.stdin.write(document.getText());
      child.stdin.end();
    });

  const isLayerDocument = (document) => document.languageId === "layered-data";

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (isLayerDocument(document)) lint();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isLayerDocument(event.document)) lintSoon();
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isLayerDocument(document)) lint();
    }),
    vscode.commands.registerCommand("layered-data.lint", lint),
    vscode.languages.registerCompletionItemProvider(
      { language: "layered-data" },
      { provideCompletionItems: (document, position) => complete(document, position) },
      "@",
      "/",
    ),
    collection,
  );
  lint();
}

module.exports = { activate };
