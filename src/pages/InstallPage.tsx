// The install page (issue #246): how to run Layered Data locally
// (clone, npm ci, .env, the npm commands, docker compose) and how to
// install the VS Code extension for the .ld syntax — the prebuilt
// .vsix is served from public/, one click downloads it.

import { PROSE_WIDTH } from "../components/PageShell";
import { say } from "../presentation/i18n.ts";
import type { Language } from "../domain/messages.ts";

interface InstallPageProps {
  language: Language;
}

const VSIX_HREF = "/layered-data-0.3.0.vsix";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 font-mono text-[11px] leading-5 text-slate-700 dark:text-slate-300">
      {children}
    </pre>
  );
}

export function InstallPage({ language }: InstallPageProps) {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
      <div className={"mx-auto " + PROSE_WIDTH + " p-4 sm:p-6"}>
        <h1 className="mb-3 text-2xl font-bold text-slate-800 dark:text-slate-100">
          {say({ language, en: "Install — run Layered Data locally" })}
        </h1>
        <p className="mb-6 text-sm leading-5 text-slate-600 dark:text-slate-400">
          {say({
            language,
            en: "Layered Data is a static workshop plus a small API (the quarry). Everything runs from one clone; the corpus of formalisms (formalisms/kernel, one .ld file per layer) ships with it.",
          })}
        </p>

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
            {say({ language, en: "1 · Local install (tooling + formalisms)" })}
          </h2>
          <p className="mb-2 text-sm leading-5 text-slate-600 dark:text-slate-400">
            {say({
              language,
              en: "Clone the repository, install the dependencies, set the API token, and start the quarry (API + workshop with hot reload):",
            })}
          </p>
          <CodeBlock>{
`git clone https://github.com/saucisson/layered-data.git
cd layered-data
npm ci
cp .env.example .env        # then set API_TOKEN in .env
npm run serve               # quarry on 127.0.0.1:8791 + workshop on localhost:5173 (hot reload, /api proxied)
npm run dev                 # the workshop alone, with hot reload
npm test                    # the verification harnesses
npm run build && npm run serve:prod   # the built workshop, served by the quarry`
          }</CodeBlock>
          <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-400">
            {say({
              language,
              en: "With Docker instead: cp .env.example .env (set API_TOKEN, POSTGRES_USERNAME, POSTGRES_PASSWORD), then docker compose up --build — workshop on 127.0.0.1:8791 plus PostgreSQL for the rate-limit counters. Without a database: DATABASE_URL= docker compose up --no-deps --build atelier.",
            })}
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
            {say({ language, en: "2 · The VS Code extension (.ld syntax)" })}
          </h2>
          <p className="mb-2 text-sm leading-5 text-slate-600 dark:text-slate-400">
            {say({
              language,
              en: "The extension lives in vscode/ (TextMate grammar, no dependency, no compilation). Download the prebuilt package and install it:",
            })}
          </p>
          <p className="mb-3">
            <a
              href={VSIX_HREF}
              download
              className="inline-block rounded-lg border border-sky-600 bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 dark:border-sky-500 dark:bg-sky-700 dark:hover:bg-sky-600"
            >
              {say({ language, en: "download layered-data-0.3.0.vsix" })}
            </a>
          </p>
          <CodeBlock>{
`# install the downloaded package:
code --install-extension layered-data-0.3.0.vsix

# or try it without installing, from the repository root:
code --extensionDevelopmentPath=vscode

# or repackage it yourself (from the extension folder):
cd vscode && npx @vscode/vsce package`
          }</CodeBlock>
          <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-400">
            {say({
              language,
              en: "The grammar is validated against the whole .ld corpus by node tests/vscode-checks.mts; regenerate the .vsix after any grammar change.",
            })}
          </p>
        </section>
      </div>
    </div>
  );
}
