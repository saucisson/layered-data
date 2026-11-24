# ADR-0120: Single IdP (auth.linard.fr) and the three-zone web model

- Status: accepted (human decision in session, 2026-11-23, recorded on
  issue #375; the human accepted the decision ahead of the LD-10 branch)
- Date: 2026-11-23
- Related: issues #366–371 (Auth v1, LD-1…LD-6), #373–376 (Web v1,
  LD-7…LD-10), milestone #24 "Web v1 — contrat commun saucisson",
  ADR-0114 (user accounts), ADR-0011 (escalation list)

## Context

The three saucisson sites (`layered-data.linard.fr`, `petrichor.linard.fr`,
`lisage.linard.fr`) converge on one common web contract, stated in the
"interface web saucisson v1" brief (committed with LD-10). Today
layered-data still gates the workshop with a single static access code
(`API_TOKEN` / `x-access-code`, see ADR-0114), the navigation mixes
public and workshop pages without a zone model, and the Mistral API key
lives server-side in production.

The sites have no users yet: full cutover, no backward compatibility to
preserve.

## Decision

1. **Authentication is exclusively `auth.linard.fr`** (Zitadel IdP,
   issuer `https://auth.linard.fr`, discovery via
   `/.well-known/openid-configuration`, never hard-coded endpoints).
   Browser flow: Authorization Code + PKCE S256 driven by `server.ts`
   (`GET /auth/login?returnTo=…`, `GET /auth/callback`,
   `POST /auth/logout`); the client secret and OIDC tokens never reach
   the browser. Application session: cookie `layered-data-session`
   (`httpOnly`, `Secure`, `SameSite=Lax`, bounded lifetime, rotation at
   login, server-side storage — never a JWT in a cookie). Machine access:
   Zitadel PAT as `Authorization: Bearer`, validated as RS256 JWT against
   the IdP JWKS plus introspection. The static access code
   (`API_TOKEN`, `x-access-code`, its screen, browser storage and
   obsolete dashboard hooks such as `openWorkshopWithAuthenticatedAccess`)
   is removed entirely (server, tests, `.env.example`, docs).
   Environment variables: `AUTH_ISSUER`, `AUTH_CLIENT_ID`,
   `AUTH_CLIENT_SECRET`, `AUTH_ALLOWED_AUDIENCES`, `AUTH_DISABLED`
   (dev-local guard only, off by default, test fails if active outside
   dev).
2. **Three zones**: Atterrissage `/` (public), Découverte / Explore
   (public read-only: Tutoriel, Filiation, Lentilles, Installation), and
   Atelier / Workshop (account required: Formalisms, model editor,
   creation, hierarchy). Landing and discovery emit no authenticated
   request and work fully without an account (pinned by a client-corpus
   test). Workshop server routes without a session answer
   `401 application/problem+json` with `reason: "session_required"`; the
   front redirects to login with `returnTo` and never shows a raw error.
   An anonymous visitor on the workshop gets one explicit message and a
   single "Se connecter avec auth.linard.fr" button.
3. **Mistral token is personal, in Preferences**: the account menu gains a
   Preferences panel with a password-type, pasteable, clearable "Token
   d'API Mistral" field, stored browser-side only — never in a URL, never
   logged, never returned in a response. It travels only as
   `x-mistral-api-token` on generation calls (the plume); the server uses
   it for the Mistral call without persisting or logging it. Without a
   token the plume is visible but disabled with an explicit message; an
   invalid token surfaces Mistral's 401 clearly in FR/EN. The global
   `MISTRAL_API_KEY` is removed from production deployments (full scope:
   docker-compose, Dockerfile, CI, docs, `.env.example`, with LD-8); a
   dev-local env fallback is tolerated under the same guard as
   `AUTH_DISABLED`.
4. **Common UI contract**: identical header structure on the three sites
   (logo + name, zones Accueil/Découvrir/Atelier, FR/EN language picker,
   persistent light/dark theme, account menu), error pages (404,
   workshop-without-session) in the same charter, FR/EN parity harness
   (`i18n:check`) kept green, accessibility (skip-link, `aria-live`,
   `document.documentElement.lang`) preserved. layered-data is the
   reference site for typography and spacing scales.

The three repositories stay autonomous: convergence happens through this
contract, not through a shared package.

## Consequences

- The server stays dependency-free if possible (`node:crypto` + native
  `fetch`); the human pre-authorized `openid-client` on 2026-11-23
  (issue #366) should the zero-dependency path prove too costly — any such
  addition is documented here as an exception.
- No component may remain wired to the old static access code; dead hooks
  are removed, not left dangling.
- The ADR is referenced by issues LD-1…LD-10; its acceptance was given by
  the human in session on 2026-11-23.
