// The error-boundary checks: a render error in any panel must be caught
// by the ErrorBoundary class component, logged as a window event (console
// is banned in src/), and replaced by a localized fallback with a reload
// button. The component is .tsx (node cannot import JSX), so this harness
// pins the contract on the source, the same way the pages harness reads
// the .tsx data sections.
//
//     node tests/error-boundary-checks.mts   (exit 1 on any failure)

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the sources ----------------------------------------------------

const rootDirectory = join(import.meta.dirname, "..");
const boundarySource = readFileSync(join(rootDirectory, "src/components/ErrorBoundary.tsx"), "utf8");
const mainSource = readFileSync(join(rootDirectory, "src/main.tsx"), "utf8");
const packageSource = readFileSync(join(rootDirectory, "package.json"), "utf8");
const enCatalog = JSON.parse(readFileSync(join(rootDirectory, "public/locales/en/translation.json"), "utf8"));
const frCatalog = JSON.parse(readFileSync(join(rootDirectory, "public/locales/fr/translation.json"), "utf8"));

// ---- the boundary component -----------------------------------------

check("ErrorBoundary is a named class export", /export class ErrorBoundary extends React\.Component/.test(boundarySource));
check("getDerivedStateFromError catches the error into state", /static getDerivedStateFromError\(error: Error\)/.test(boundarySource));
check("componentDidCatch logs the error", /componentDidCatch\(error: Error/.test(boundarySource));
check("the log channel is a window event, not console", boundarySource.includes("window.dispatchEvent") && !boundarySource.includes("console."));
check("the fallback is localized through t()", /t\("something went wrong/.test(boundarySource));
check("the reload button has an explicit type=\"button\"", /<button[\s\S]*?type="button"[\s\S]*?window\.location\.reload\(\)/.test(boundarySource));
check("the fallback announces itself with role=\"alert\"", boundarySource.includes('role="alert"'));

// ---- the wiring in main.tsx -----------------------------------------

check("main.tsx imports the ErrorBoundary", /import \{ ErrorBoundary \} from "\.\/components\/ErrorBoundary"/.test(mainSource));
check("main.tsx wraps <App /> in <ErrorBoundary>", /<ErrorBoundary>\s*<App \/>\s*<\/ErrorBoundary>/.test(mainSource));

// ---- the localized fallback strings ---------------------------------

const ERROR_KEY = "something went wrong — the atelier hit an unexpected error";
check("the error message key exists in the English catalog", typeof enCatalog[ERROR_KEY] === "string" && enCatalog[ERROR_KEY].length > 0);
check("the error message key exists in the French catalog", typeof frCatalog[ERROR_KEY] === "string" && frCatalog[ERROR_KEY].length > 0);
check("the French error message is a real translation", frCatalog[ERROR_KEY] !== enCatalog[ERROR_KEY]);
check("the reload key exists in both catalogs", typeof enCatalog["reload"] === "string" && typeof frCatalog["reload"] === "string");

// ---- the harness is registered --------------------------------------

check("package.json runs this harness", packageSource.includes("test:error-boundary"));

// ---- report ----------------------------------------------------------

console.log(
  `error-boundary checks: ${assertions - failures.length}/${assertions} passed, ${failures.length} failed`,
);
for (const failure of failures) {
  console.log("FAIL " + failure);
}
process.exit(failures.length > 0 ? 1 : 0);
