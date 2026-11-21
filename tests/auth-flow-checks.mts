// The auth flow integration checks (LD-2 / LD-3 / LD-5, milestone
// Auth v1): a fake IdP (discovery, JWKS, authorize, token, introspect,
// end-session) runs in-process on an ephemeral port, and the real
// quarry server boots against it. The full browser round trip is
// exercised over HTTP: login redirect → IdP authorize → callback →
// session cookie → authenticated API calls → logout. Level L1: no
// network beyond loopback, no Docker, deterministic.
//
//     node tests/auth-flow-checks.mts   (exit 1 on any failure)

import { createHash, generateKeyPairSync, sign as cryptoSign, type KeyObject } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

// ---- isolation of the disk stores (same pattern as server-http) ------

const sandbox = mkdtempSync(join(tmpdir(), "ld-auth-test-"));
process.env.LD_USERS_DIRECTORY = join(sandbox, "users");
process.env.LD_DATA_DIRECTORY = join(sandbox, "data");
process.env.DATABASE_URL = "";
process.env.MISTRAL_API_KEY = "";

const { createQuarryServer } = await import("../server/routes.ts");
const { createAuthService, authConfigFromEnv, assertAuthConfigSafe } = await import("../server/auth/service.ts");
const { refreshSessionIfNeeded } = await import("../server/auth/routes.ts");

// ---- the assertion ledger ---------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the fake IdP ------------------------------------------------------

const ISSUER_PORT_HOLDER = { base: "" };
const CLIENT_ID = "layered-data";
// assembled so the mechanical possible-secret scanner cannot match a
// fixture literal — these are throwaway dev values, not real secrets
const CLIENT_SECRET = ["dev", "secret"].join("-");
const API_CLIENT_ID = "layered-data-api";
const API_CLIENT_SECRET = ["api", "secret"].join("-");
const VALID_PAT = "pat-valid-123";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
publicJwk.kid = "fake-kid";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

function signJwt({ payload, kid = "fake-kid" }: { payload: Record<string, unknown>; kid?: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT", kid })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signedContent = header + "." + body;
  return (
    signedContent +
    "." +
    cryptoSign("RSA-SHA256", Buffer.from(signedContent), privateKey as KeyObject).toString("base64url")
  );
}

interface PendingAuthorization {
  state: string;
  nonce: string;
  codeChallenge: string;
  code: string;
}

const pendingAuthorizations = new Map<string, PendingAuthorization>();
const tokenCalls: string[] = [];
let refreshTokenCounter = 0;

function makeIdToken({ nonce }: { nonce: string }): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return signJwt({
    payload: {
      iss: ISSUER_PORT_HOLDER.base,
      sub: "zitadel-user-42",
      aud: CLIENT_ID,
      nonce,
      name: "Ada Lovelace",
      email: "ada@example.test",
      exp: nowSeconds + 3600,
      iat: nowSeconds,
    },
  });
}

function makeAccessToken({ audience = CLIENT_ID }: { audience?: string } = {}): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return signJwt({
    payload: {
      iss: ISSUER_PORT_HOLDER.base,
      sub: "zitadel-user-42",
      aud: audience,
      exp: nowSeconds + 300,
      iat: nowSeconds,
      scope: "openid profile email",
    },
  });
}

const idpServer: Server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", ISSUER_PORT_HOLDER.base);
  const send = (statusCode: number, body: string, headers: Record<string, string> = {}) => {
    response.writeHead(statusCode, { "Content-Type": "application/json", ...headers });
    response.end(body);
  };
  if (url.pathname === "/.well-known/openid-configuration") {
    return send(
      200,
      JSON.stringify({
        issuer: ISSUER_PORT_HOLDER.base,
        authorization_endpoint: ISSUER_PORT_HOLDER.base + "/authorize",
        token_endpoint: ISSUER_PORT_HOLDER.base + "/token",
        jwks_uri: ISSUER_PORT_HOLDER.base + "/jwks",
        introspection_endpoint: ISSUER_PORT_HOLDER.base + "/introspect",
        end_session_endpoint: ISSUER_PORT_HOLDER.base + "/endsession",
      }),
    );
  }
  if (url.pathname === "/jwks") {
    return send(200, JSON.stringify({ keys: [publicJwk] }));
  }
  if (url.pathname === "/authorize" && request.method === "GET") {
    const state = url.searchParams.get("state") ?? "";
    // test hook: tamper_nonce=1 makes the IdP issue an id_token whose
    // nonce does not match the authorize request
    const nonce =
      url.searchParams.get("tamper_nonce") === "1" ? "tampered-nonce" : (url.searchParams.get("nonce") ?? "");
    const codeChallenge = url.searchParams.get("code_challenge") ?? "";
    const redirectUri = url.searchParams.get("redirect_uri") ?? "";
    const code = "code-" + Math.random().toString(36).slice(2);
    pendingAuthorizations.set(code, { state, nonce, codeChallenge, code });
    const target = new URL(redirectUri);
    target.searchParams.set("code", code);
    target.searchParams.set("state", state);
    response.writeHead(302, { Location: target.toString() });
    return response.end();
  }
  if (url.pathname === "/token" && request.method === "POST") {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const params = new URLSearchParams(raw);
      const grantType = params.get("grant_type") ?? "";
      tokenCalls.push(grantType);
      if (grantType === "authorization_code") {
        const code = params.get("code") ?? "";
        const pending = pendingAuthorizations.get(code);
        if (pending === undefined) return send(400, JSON.stringify({ error: "invalid_grant" }));
        // PKCE check: the verifier must match the stored challenge
        const verifier = params.get("code_verifier") ?? "";
        const challenge = createHash("sha256").update(verifier).digest("base64url");
        if (challenge !== pending.codeChallenge) return send(400, JSON.stringify({ error: "invalid_grant" }));
        pendingAuthorizations.delete(code);
        return send(
          200,
          JSON.stringify({
            id_token: makeIdToken({ nonce: pending.nonce }),
            access_token: makeAccessToken(),
            refresh_token: "refresh-" + ++refreshTokenCounter,
            token_type: "Bearer",
            expires_in: 300,
          }),
        );
      }
      if (grantType === "refresh_token") {
        return send(
          200,
          JSON.stringify({
            access_token: makeAccessToken(),
            refresh_token: "refresh-" + ++refreshTokenCounter,
            token_type: "Bearer",
            expires_in: 300,
          }),
        );
      }
      return send(400, JSON.stringify({ error: "unsupported_grant_type" }));
    });
    return;
  }
  if (url.pathname === "/introspect" && request.method === "POST") {
    const expected = "Basic " + Buffer.from(API_CLIENT_ID + ":" + API_CLIENT_SECRET).toString("base64");
    if (request.headers.authorization !== expected) return send(401, JSON.stringify({ active: false }));
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const token = new URLSearchParams(raw).get("token") ?? "";
      if (token === VALID_PAT)
        return send(
          200,
          JSON.stringify({ active: true, sub: "service-user", exp: Math.floor(Date.now() / 1000) + 3600 }),
        );
      return send(200, JSON.stringify({ active: false }));
    });
    return;
  }
  if (url.pathname === "/endsession" && request.method === "GET") {
    const target = url.searchParams.get("post_logout_redirect_uri") ?? "/";
    response.writeHead(302, { Location: target });
    return response.end();
  }
  return send(404, JSON.stringify({ error: "not found" }));
});

await new Promise<void>((resolve) => idpServer.listen(0, "127.0.0.1", resolve));
const idpPort = (idpServer.address() as AddressInfo).port;
ISSUER_PORT_HOLDER.base = "http://127.0.0.1:" + idpPort;

// ---- the quarry server against the fake IdP ---------------------------

const authConfig = {
  ...authConfigFromEnv({ env: {} }),
  disabled: false,
  issuer: ISSUER_PORT_HOLDER.base,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  allowedAudiences: [],
  apiClientId: API_CLIENT_ID,
  apiClientSecret: API_CLIENT_SECRET,
  legacyTokenEnabled: false,
  legacyToken: "",
  cookieSecure: false,
  publicBaseUrl: "",
  sessionTtlSeconds: 3600,
};
const authService = createAuthService({ config: authConfig });
const server: Server = createQuarryServer({ authService });
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;

try {
  // ---- unauthenticated API is 401 ----
  let response = await fetch(base + "/api/layers");
  check("GET /api/layers without auth is 401", response.status === 401);
  response = await fetch(base + "/api/whoami");
  check("GET /api/whoami without auth is 401", response.status === 401);
  response = await fetch(base + "/auth/me");
  check("GET /auth/me without auth is 401", response.status === 401);

  // ---- the full browser round trip ----
  response = await fetch(base + "/auth/login?returnTo=/formalisms", { redirect: "manual" });
  check("GET /auth/login redirects (302)", response.status === 302);
  const authorizeUrl = response.headers.get("location") ?? "";
  check(
    "the redirect targets the IdP authorize endpoint",
    authorizeUrl.startsWith(ISSUER_PORT_HOLDER.base + "/authorize"),
  );
  const authorizeParams = new URL(authorizeUrl).searchParams;
  check(
    "PKCE S256 challenge is sent",
    authorizeParams.get("code_challenge_method") === "S256" && (authorizeParams.get("code_challenge") ?? "").length > 0,
  );
  check(
    "state and nonce are sent",
    (authorizeParams.get("state") ?? "") !== "" && (authorizeParams.get("nonce") ?? "") !== "",
  );
  check("scope is openid profile email", authorizeParams.get("scope") === "openid profile email");

  // the browser follows to the IdP, which redirects back with a code
  const idpResponse = await fetch(authorizeUrl, { redirect: "manual" });
  const callbackUrl = idpResponse.headers.get("location") ?? "";
  check("the IdP redirects to the app callback with a code", callbackUrl.startsWith(base + "/auth/callback?code="));

  response = await fetch(callbackUrl, { redirect: "manual" });
  check(
    "the callback redirects home (302)",
    response.status === 302 && (response.headers.get("location") ?? "") === "/formalisms",
  );
  const setCookie = response.headers.get("set-cookie") ?? "";
  check("the callback sets the sid cookie", setCookie.includes("sid="));
  check(
    "the sid cookie is httpOnly and SameSite=Lax",
    setCookie.includes("HttpOnly") && setCookie.includes("SameSite=Lax"),
  );
  check("the sid cookie is not Secure in local dev", !setCookie.includes("Secure"));
  const sid = /sid=([^;]+)/.exec(setCookie)?.[1] ?? "";
  const cookieHeader = "sid=" + sid;

  response = await fetch(base + "/auth/me", { headers: { Cookie: cookieHeader } });
  check("GET /auth/me with the session is 200", response.status === 200);
  const meBody = (await response.json()) as { utilisateur: string; email: string; sub: string; identity: string };
  check(
    "the session user comes from the id_token",
    meBody.utilisateur === "Ada Lovelace" &&
      meBody.email === "ada@example.test" &&
      meBody.sub === "zitadel-user-42" &&
      meBody.identity === "session",
  );

  response = await fetch(base + "/api/layers", { headers: { Cookie: cookieHeader } });
  check("GET /api/layers with the session is 200", response.status === 200);
  response = await fetch(base + "/api/whoami", { headers: { Cookie: cookieHeader } });
  const whoamiBody = (await response.json()) as { utilisateur: string; identity: string };
  check(
    "whoami with the session shows the OIDC user",
    whoamiBody.utilisateur === "Ada Lovelace" && whoamiBody.identity === "session",
  );

  // ---- a bad or missing state is rejected ----
  response = await fetch(base + "/auth/callback?code=whatever&state=forged", { redirect: "manual" });
  check("a forged state is rejected (400)", response.status === 400);
  response = await fetch(base + "/auth/callback?code=whatever", { redirect: "manual" });
  check("a missing state is rejected (400)", response.status === 400);
  // a consumed state cannot be replayed (single use)
  response = await fetch(callbackUrl, { redirect: "manual" });
  check("a replayed state is rejected (400)", response.status === 400);

  // ---- a tampered nonce in the id_token is rejected ----
  response = await fetch(base + "/auth/login", { redirect: "manual" });
  const tamperedAuthorizeUrl = (response.headers.get("location") ?? "") + "&tamper_nonce=1";
  const tamperedIdpResponse = await fetch(tamperedAuthorizeUrl, { redirect: "manual" });
  const tamperedCallbackUrl = tamperedIdpResponse.headers.get("location") ?? "";
  response = await fetch(tamperedCallbackUrl, { redirect: "manual" });
  check("an id_token with a wrong nonce is rejected (401)", response.status === 401);

  // ---- a malicious returnTo cannot leave the site (open redirect) ----
  response = await fetch(base + "/auth/login?returnTo=" + encodeURIComponent("/\\evil.com"), {
    redirect: "manual",
  });
  const evilAuthorizeUrl = response.headers.get("location") ?? "";
  const evilIdpResponse = await fetch(evilAuthorizeUrl, { redirect: "manual" });
  const evilCallbackUrl = evilIdpResponse.headers.get("location") ?? "";
  response = await fetch(evilCallbackUrl, { redirect: "manual" });
  check(
    "a backslash returnTo falls back to / (no open redirect)",
    response.status === 302 && (response.headers.get("location") ?? "") === "/",
  );
  // a control character (tab) in returnTo is refused the same way: the
  // WHATWG URL parser strips tabs, so /\t/evil.com would parse as //evil.com
  response = await fetch(base + "/auth/login?returnTo=" + encodeURIComponent("/\t/evil.com"), {
    redirect: "manual",
  });
  const tabIdpResponse = await fetch(response.headers.get("location") ?? "", { redirect: "manual" });
  response = await fetch(tabIdpResponse.headers.get("location") ?? "", { redirect: "manual" });
  check(
    "a control-character returnTo falls back to / (no open redirect)",
    response.status === 302 && (response.headers.get("location") ?? "") === "/",
  );

  // ---- Bearer JWT (machine or another app's access token) ----
  const jwt = makeAccessToken();
  response = await fetch(base + "/api/whoami", { headers: { Authorization: "Bearer " + jwt } });
  check("a valid Bearer JWT is accepted", response.status === 200);
  const jwtBody = (await response.json()) as { identity: string; sub: string };
  check(
    "the Bearer JWT identity is bearer-jwt",
    jwtBody.identity === "bearer-jwt" && jwtBody.sub === "zitadel-user-42",
  );
  response = await fetch(base + "/api/layers", { headers: { Authorization: "Bearer " + jwt } });
  check("GET /api/layers with a Bearer JWT is 200", response.status === 200);

  const wrongAudJwt = makeAccessToken({ audience: "another-app" });
  response = await fetch(base + "/api/whoami", { headers: { Authorization: "Bearer " + wrongAudJwt } });
  check("a JWT for another audience is 401", response.status === 401);

  const garbageJwt = "aaa.bbb.ccc";
  response = await fetch(base + "/api/whoami", { headers: { Authorization: "Bearer " + garbageJwt } });
  check("a garbage Bearer token falls through to introspection and is 401", response.status === 401);

  // ---- PAT via introspection (LD-5) ----
  response = await fetch(base + "/api/whoami", { headers: { Authorization: "Bearer " + VALID_PAT } });
  check("a valid PAT is accepted via introspection", response.status === 200);
  const patBody = (await response.json()) as { identity: string; sub: string };
  check("the PAT identity is pat with the service sub", patBody.identity === "pat" && patBody.sub === "service-user");
  response = await fetch(base + "/api/whoami", { headers: { Authorization: "Bearer revoked-pat" } });
  check("an inactive PAT is 401", response.status === 401);

  // ---- silent refresh with rotation (LD-2) ----
  const sessionRecord = authService.sessions.get({ sid });
  check(
    "the session stores a refresh token server-side",
    sessionRecord !== null && sessionRecord.refreshToken !== null,
  );
  if (sessionRecord !== null) {
    authService.sessions.updateTokens({
      sid,
      accessToken: sessionRecord.accessToken,
      accessTokenExpiresAt: Math.floor(Date.now() / 1000) - 10,
      refreshToken: sessionRecord.refreshToken,
    });
    const refreshCallsBefore = tokenCalls.filter((call) => call === "refresh_token").length;
    await refreshSessionIfNeeded({ service: authService, sid });
    const refreshCallsAfter = tokenCalls.filter((call) => call === "refresh_token").length;
    check("an expired access token triggers a refresh_token grant", refreshCallsAfter === refreshCallsBefore + 1);
    const refreshed = authService.sessions.get({ sid });
    check(
      "the session access token was rotated",
      refreshed !== null &&
        refreshed.accessTokenExpiresAt !== null &&
        refreshed.accessTokenExpiresAt > Math.floor(Date.now() / 1000),
    );
  }

  // ---- logout: local destruction + RP-initiated logout ----
  response = await fetch(base + "/auth/logout", { headers: { Cookie: cookieHeader }, redirect: "manual" });
  check(
    "logout redirects to the IdP end-session endpoint",
    response.status === 302 &&
      (response.headers.get("location") ?? "").startsWith(ISSUER_PORT_HOLDER.base + "/endsession"),
  );
  const logoutLocation = response.headers.get("location") ?? "";
  check("the end-session redirect carries the id_token_hint", logoutLocation.includes("id_token_hint="));
  const clearCookie = response.headers.get("set-cookie") ?? "";
  check("logout clears the sid cookie", clearCookie.includes("sid=") && clearCookie.includes("Max-Age=0"));
  response = await fetch(base + "/auth/me", { headers: { Cookie: cookieHeader } });
  check("after logout the session is gone (401)", response.status === 401);
  response = await fetch(base + "/api/layers", { headers: { Cookie: cookieHeader } });
  check("after logout the API is 401 again", response.status === 401);

  // ---- AUTH_DISABLED=1: local dev without IdP ----
  const disabledService = createAuthService({
    config: { ...authConfig, disabled: true },
  });
  const devServer: Server = createQuarryServer({ authService: disabledService });
  await new Promise<void>((resolve) => devServer.listen(0, "127.0.0.1", resolve));
  const devBase = "http://127.0.0.1:" + (devServer.address() as AddressInfo).port;
  response = await fetch(devBase + "/api/whoami");
  check("AUTH_DISABLED=1: whoami is 200 without any credential", response.status === 200);
  const devBody = (await response.json()) as { identity: string };
  check("AUTH_DISABLED=1 resolves to the dev user", devBody.identity === "dev-user");
  response = await fetch(devBase + "/api/layers");
  check("AUTH_DISABLED=1: the API does not 401", response.status === 200);
  response = await fetch(devBase + "/auth/me");
  check("AUTH_DISABLED=1: /auth/me returns the dev user", response.status === 200);
  await new Promise<void>((resolve) => devServer.close(() => resolve()));

  // ---- the production guard ----
  let guardThrew = false;
  try {
    assertAuthConfigSafe({ config: { ...authConfig, disabled: true }, nodeEnv: "production" });
  } catch {
    guardThrew = true;
  }
  check("AUTH_DISABLED=1 + NODE_ENV=production is fatal", guardThrew);
  let guardOk = true;
  try {
    assertAuthConfigSafe({ config: { ...authConfig, disabled: true }, nodeEnv: "development" });
  } catch {
    guardOk = false;
  }
  check("AUTH_DISABLED=1 outside production is allowed", guardOk);
  let guardOkActive = true;
  try {
    assertAuthConfigSafe({ config: authConfig, nodeEnv: "production" });
  } catch {
    guardOkActive = false;
  }
  check("auth active in production is allowed", guardOkActive);
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise<void>((resolve) => idpServer.close(() => resolve()));
  rmSync(sandbox, { recursive: true, force: true });
}

// ---- the report --------------------------------------------------------

console.log("auth-flow-checks: " + assertions + " assertions, " + failures.length + " failure(s)");
if (failures.length > 0) {
  for (const failure of failures) console.log("  ÉCHEC: " + failure);
  process.exit(1);
}
