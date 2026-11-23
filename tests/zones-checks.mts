// The zones checks (LD-7, milestone Web v1, ADR-0120 §2): the
// client-side corpus of the three-zone contract, pinned on the source
// — the discovery pages emit no authenticated request, the header
// groups them under Discover, the Atelier pages are exactly the ones
// the router guards, the locked page offers one sign-in button with
// returnTo, and the server answers 401 application/problem+json
// reason "session_required" on the workshop API.
//
//     node tests/zones-checks.mts   (exit 1 on any failure)

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
const readSource = (relativePath: string) => readFileSync(join(rootDirectory, relativePath), "utf8");

const headerSource = readSource("src/components/SiteHeader.tsx");
const appSource = readSource("src/App.tsx");
const lockedSource = readSource("src/pages/WorkshopLockedPage.tsx");
const landingSource = readSource("src/pages/LandingPage.tsx");
const clientSource = readSource("src/infrastructure/wardrobeClient.ts");
const serverRoutesSource = readSource("server/routes.ts");
const httpUtilsSource = readSource("server/httpUtils.ts");

const PUBLIC_PAGES = ["LandingPage", "TutorialPage", "FiliationPage", "LensesPage", "InstallPage"] as const;
const DISCOVERY_PAGES = ["tutorial", "filiation", "lenses", "install"] as const;
const WORKSHOP_PAGES = ["formalisms", "models", "hierarchy", "creation", "formalism"] as const;

// =====================================================================
// (a) the discovery pages emit no authenticated request — pinned on
//     the code, not assumed: no API call, no /api/ or /auth/ route,
//     no session probe in any public page source
// =====================================================================

for (const page of PUBLIC_PAGES) {
  const source = readSource("src/pages/" + page + ".tsx");
  check(
    "(a) " + page + " calls no API client (no apiFetch / streamGenerate / fetch)",
    !source.includes("apiFetch") && !source.includes("streamGenerate") && !source.includes("fetch("),
  );
  check(
    "(a) " + page + " names no /api/ or /auth/ route",
    !source.includes('"/api/') && !source.includes('"/auth/') && !source.includes("api/generate"),
  );
}

// The composed page also renders the shared header (App.tsx renders
// <SiteHeader> on every route): its only request is the session probe
// /auth/me — a public route that answers 401 to an anonymous visitor
// and never triggers the workshop lock. No /api/ call may ever leave
// a public page, header included.
const headerEndpoints = [...headerSource.matchAll(/apiFetch\(\{ endpoint: "([^"]+)" \}\)/g)].map((match) => match[1]);
check(
  "(a) the shared header's only API call is the public session probe auth/me — no /api/ route",
  headerEndpoints.length === 1 && headerEndpoints[0] === "auth/me",
);
check(
  "(a) App.tsx itself names no /api/ or /auth/ route",
  !appSource.includes('"/api/') && !appSource.includes('"/auth/'),
);

// =====================================================================
// (b) the header groups the pages into the three zones of the contract
// =====================================================================

check(
  "(b) the header declares exactly three zones: home, discover, workshop",
  headerSource.includes('"home"') && headerSource.includes('"discover"') && headerSource.includes('"workshop"'),
);
// Zone-scoped extraction: each zone's `pages` list is read from its own
// ZONES entry, so a page moved from one zone to another fails its check.
function zonePagesOf(zoneId: string): string[] {
  const zoneEntry = new RegExp('id: "' + zoneId + '",[\\s\\S]*?pages: \\[([^\\]]*)\\]').exec(headerSource);
  const pagesList = zoneEntry?.[1];
  if (pagesList === undefined) return [];
  return [...pagesList.matchAll(/"([a-z]+)"/g)].map((match) => match[1] ?? "");
}
const homePages = zonePagesOf("home");
const discoverPages = zonePagesOf("discover");
const workshopPages = zonePagesOf("workshop");
check(
  "(b) the home zone is the landing alone",
  homePages.join(",") === "landing",
);
check(
  "(b) the discover zone groups exactly the four discovery pages",
  discoverPages.join(",") === DISCOVERY_PAGES.join(","),
);
check(
  "(b) the workshop zone groups exactly the five Atelier pages",
  workshopPages.join(",") === WORKSHOP_PAGES.join(","),
);
check(
  "(b) the zone labels are bilingual FR/EN (no hard-coded string)",
  /id: "home"[\s\S]*?label: \{ en: "Home", fr: "Accueil" \}/.test(headerSource) &&
    /id: "discover"[\s\S]*?label: \{ en: "Discover", fr: "Découvrir" \}/.test(headerSource) &&
    /id: "workshop"[\s\S]*?label: \{ en: "Workshop", fr: "Atelier" \}/.test(headerSource),
);
check(
  "(b) every page entry of the zone popovers carries a French label",
  (headerSource.match(/label: \{ en: "[^"]+", fr: "[^"]+" \}/g) ?? []).length >= 8,
);

// =====================================================================
// (c) the router guards exactly the Atelier pages — and only those
// =====================================================================

check(
  "(c) App.tsx guards exactly the five workshop pages",
  /WORKSHOP_PAGES: readonly Page\[\] = \[[^\]]*\]/.test(appSource) &&
    WORKSHOP_PAGES.every((page) => appSource.includes('"' + page + '"')),
);
const workshopPagesDeclaration = appSource.match(/WORKSHOP_PAGES: readonly Page\[\] = \[([^\]]*)\]/);
check(
  "(c) the guard list contains the five workshop pages and nothing else",
  workshopPagesDeclaration !== null &&
    WORKSHOP_PAGES.every((page) => (workshopPagesDeclaration[1] ?? "").includes('"' + page + '"')) &&
    ((workshopPagesDeclaration[1] ?? "").match(/"/g) ?? []).length === WORKSHOP_PAGES.length * 2,
);
check(
  "(c) the locked page is shown only on a guarded page",
  appSource.includes("sessionRequired && WORKSHOP_PAGES.includes(page)"),
);
check(
  "(c) leaving the workshop zone clears the lock",
  /if \(!WORKSHOP_PAGES\.includes\(page\)\) setSessionRequired\(false\)/.test(appSource),
);

// =====================================================================
// (d) the locked page: one explicit message, one sign-in button with
//     returnTo, no raw error, no embedded auth panel probe
// =====================================================================

check(
  "(d) the locked page offers exactly one sign-in action, labeled auth.linard.fr",
  (lockedSource.match(/sign in with auth\.linard\.fr/gi) ?? []).length === 1 &&
    (lockedSource.match(/<button/g) ?? []).length === 1,
);
check(
  "(d) the sign-in button redirects to /auth/login with returnTo = the current page",
  lockedSource.includes('"/auth/login?returnTo="') &&
    lockedSource.includes("window.location.pathname + window.location.hash"),
);
check(
  "(d) the locked page embeds no auth panel and probes no API (no raw 401 ever shown)",
  !lockedSource.includes("AuthPanel") && !lockedSource.includes("apiFetch") && !lockedSource.includes("fetch("),
);
check(
  "(d) the locked page is bilingual FR/EN",
  lockedSource.includes('fr: "Se connecter avec auth.linard.fr"'),
);

// =====================================================================
// (e) the landing page opens the two doors — Discover and Workshop —
//     and stays public
// =====================================================================

check(
  "(e) the landing links into the discover zone (a discovery page)",
  DISCOVERY_PAGES.some((page) => landingSource.includes('hashOf("' + page + '")') || landingSource.includes('page: "' + page + '"')),
);
check(
  "(e) the landing links into the workshop zone (#formalisms)",
  landingSource.includes('hashOf("formalisms")'),
);
check(
  "(e) the landing links no other workshop page directly (hierarchy, creation, models, formalism/<layer>)",
  !landingSource.includes('hashOf("hierarchy")') &&
    !landingSource.includes('hashOf("creation")') &&
    !landingSource.includes('hashOf("models")') &&
    !landingSource.includes('hashOf("formalism"'),
);

// =====================================================================
// (f) the server contract: a session-less workshop API call answers
//     401 application/problem+json with reason "session_required",
//     and the client turns exactly that answer into the sign-in page
// =====================================================================

check(
  "(f) httpUtils provides the RFC 7807 problem+json sender",
  httpUtilsSource.includes("sendProblem") && httpUtilsSource.includes("application/problem+json"),
);
check(
  "(f) the /api block answers anonymous with reason session_required in problem+json",
  serverRoutesSource.includes('reason: "session_required"') &&
    /identity\.kind === "anonymous"\) \{\s*\/\/[^\n]*\n\s*return sendProblem\(\{[\s\S]*?reason: "session_required"/.test(
      serverRoutesSource,
    ),
);
check(
  "(f) the client raises ld:session-required exactly on that reason",
  clientSource.includes('"ld:session-required"') && clientSource.includes('reason === "session_required"'),
);

// ---- the report ----------------------------------------------------

console.log("zones checks: " + assertions + " assertions, " + failures.length + " failure(s)");
if (failures.length > 0) {
  for (const failure of failures) console.log("  ÉCHEC: " + failure);
  process.exit(1);
}
