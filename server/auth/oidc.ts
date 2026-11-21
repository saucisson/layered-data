// ============================================================
// Layered Data — the OIDC client side (LD-2 / LD-5, milestone Auth v1)
//
// Authorization Code Flow with PKCE (S256) + state + nonce for
// browsers; PAT introspection for machines. Every endpoint URL comes
// from the discovery document — nothing is hard-coded. The client
// secret never leaves the server.
// ============================================================
import { createHash, randomBytes } from "node:crypto";

import type { FetchLike, OidcDiscoveryDocument } from "./jwt.ts";

export const OIDC_SCOPES = "openid profile email";

/** A typed failure of an IdP round trip — the status code travels
 * with it, the token never does. */
export class OidcError extends Error {
  readonly statusCode: number | null;
  constructor({ message, statusCode = null }: { message: string; statusCode?: number | null }) {
    super(message);
    this.name = "OidcError";
    this.statusCode = statusCode;
  }
}

/** PKCE S256 pair: the verifier stays server-side, the challenge goes
 * to the authorize endpoint. */
export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function createOpaqueValue(): string {
  return randomBytes(24).toString("base64url");
}

/** The authorize URL of the IdP for one login round trip. */
export function buildAuthorizationUrl({
  discovery,
  clientId,
  redirectUri,
  state,
  nonce,
  codeChallenge,
  scope = OIDC_SCOPES,
}: {
  discovery: OidcDiscoveryDocument;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
  scope?: string;
}): string {
  const url = new URL(discovery.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface TokenSet {
  idToken: string;
  accessToken: string;
  refreshToken: string | null;
}

async function readTokenResponse({
  response,
  context,
}: {
  response: Response;
  context: string;
}): Promise<Record<string, unknown>> {
  if (!response.ok) {
    throw new OidcError({
      message: context + " failed: HTTP " + response.status,
      statusCode: response.status,
    });
  }
  const body = (await response.json()) as Record<string, unknown>;
  if (typeof body.id_token !== "string" || typeof body.access_token !== "string") {
    throw new OidcError({ message: context + " returned no id_token/access_token pair" });
  }
  return body;
}

function postForm({
  url,
  params,
  fetchImpl,
}: {
  url: string;
  params: URLSearchParams;
  fetchImpl: FetchLike;
}): Promise<Response> {
  return fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });
}

/** Exchange the authorization code at the token endpoint — the
 * client secret travels here, server-side only. */
export async function exchangeCodeForTokens({
  discovery,
  code,
  codeVerifier,
  redirectUri,
  clientId,
  clientSecret,
  fetchImpl = fetch,
}: {
  discovery: OidcDiscoveryDocument;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: FetchLike;
}): Promise<TokenSet> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: clientId,
  });
  if (clientSecret !== "") params.set("client_secret", clientSecret);
  const body = await readTokenResponse({
    response: await postForm({ url: discovery.token_endpoint, params, fetchImpl }),
    context: "the code exchange",
  });
  return {
    idToken: body.id_token as string,
    accessToken: body.access_token as string,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
  };
}

/** Refresh with rotation: the IdP may return a new refresh token, the
 * old one is then replaced — the browser never sees either. */
export async function refreshTokens({
  discovery,
  refreshToken,
  clientId,
  clientSecret,
  fetchImpl = fetch,
}: {
  discovery: OidcDiscoveryDocument;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: FetchLike;
}): Promise<{ accessToken: string; refreshToken: string | null; idToken: string | null }> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  if (clientSecret !== "") params.set("client_secret", clientSecret);
  const response = await postForm({ url: discovery.token_endpoint, params, fetchImpl });
  if (!response.ok) {
    throw new OidcError({
      message: "the refresh failed: HTTP " + response.status,
      statusCode: response.status,
    });
  }
  const body = (await response.json()) as Record<string, unknown>;
  if (typeof body.access_token !== "string") {
    throw new OidcError({ message: "the refresh returned no access_token" });
  }
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
    idToken: typeof body.id_token === "string" ? body.id_token : null,
  };
}

export interface IntrospectionResult {
  active: boolean;
  sub: string | null;
  exp: number | null;
}

/** PAT validation for machine clients: POST the introspection
 * endpoint with Basic auth (the app's API credentials). */
export async function introspectToken({
  introspectionEndpoint,
  clientId,
  clientSecret,
  token,
  fetchImpl = fetch,
}: {
  introspectionEndpoint: string;
  clientId: string;
  clientSecret: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<IntrospectionResult> {
  const basic = Buffer.from(clientId + ":" + clientSecret, "utf8").toString("base64");
  const response = await fetchImpl(introspectionEndpoint, {
    method: "POST",
    headers: {
      Authorization: "Basic " + basic,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ token }).toString(),
  });
  if (!response.ok) {
    throw new OidcError({
      message: "introspection failed: HTTP " + response.status,
      statusCode: response.status,
    });
  }
  const body = (await response.json()) as Record<string, unknown>;
  return {
    active: body.active === true,
    sub: typeof body.sub === "string" ? body.sub : null,
    exp: typeof body.exp === "number" ? body.exp : null,
  };
}

/** Short-lived cache around introspection: machines poll, the IdP
 * does not need every call. Only ACTIVE verdicts are cached — a
 * revoked PAT must stop working immediately, never 30 s later. */
export function createIntrospectionCache({
  ttlMs = 30_000,
  now = () => Date.now(),
}: {
  ttlMs?: number;
  now?: () => number;
} = {}) {
  const cache = new Map<string, { result: IntrospectionResult; cachedAt: number }>();
  return {
    async introspect({
      token,
      call,
    }: {
      token: string;
      call: () => Promise<IntrospectionResult>;
    }): Promise<IntrospectionResult> {
      const cached = cache.get(token);
      if (cached !== undefined && now() - cached.cachedAt < ttlMs) return cached.result;
      const result = await call();
      if (result.active) cache.set(token, { result, cachedAt: now() });
      else cache.delete(token);
      return result;
    },
  };
}

/** RP-initiated logout: the browser is redirected to the IdP's end
 * session endpoint with the id_token_hint; the IdP then sends it to
 * the post-logout redirect URI. */
export function buildEndSessionUrl({
  endSessionEndpoint,
  idTokenHint,
  postLogoutRedirectUri,
}: {
  endSessionEndpoint: string;
  idTokenHint: string;
  postLogoutRedirectUri: string;
}): string {
  const url = new URL(endSessionEndpoint);
  url.searchParams.set("id_token_hint", idTokenHint);
  url.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
  return url.toString();
}
