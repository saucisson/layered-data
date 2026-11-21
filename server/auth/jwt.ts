// ============================================================
// Layered Data — the JWT/JWKS brick (LD-1, milestone Auth v1)
//
// Pure server module, zero dependency: node:crypto + native fetch.
// It fetches the OIDC discovery document and the JWKS of the issuer
// (both cached), imports the RSA public key of a `kid` through
// crypto.createPublicKey({ key: jwk, format: "jwk" }) and verifies
// the RS256 signature with crypto.verify. The claims are then
// checked: iss, aud, exp, nbf (60 s clock leeway).
//
// No endpoint URL is ever hard-coded here: the caller hands the
// issuer (or the discovery document) — everything else comes from
// <issuer>/.well-known/openid-configuration.
// ============================================================
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
import type { JsonWebKey } from "node:crypto";

/** The discovery document is cached a full day. */
export const DISCOVERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** The JWKS is cached; an unknown `kid` forces one re-fetch. */
export const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;
/** Clock leeway on exp / nbf, per the architecture decision. */
export const CLOCK_LEEWAY_SECONDS = 60;

export type TokenRejectionReason =
  | "malformed"
  | "unsupported-algorithm"
  | "missing-kid"
  | "unknown-kid"
  | "bad-signature"
  | "expired"
  | "not-yet-valid"
  | "wrong-issuer"
  | "wrong-audience";

/** A typed rejection: the reason is machine-readable, the message
 * is safe to log (it never carries the token itself). */
export class TokenValidationError extends Error {
  readonly reason: TokenRejectionReason;
  constructor({ reason, message }: { reason: TokenRejectionReason; message: string }) {
    super(message);
    this.name = "TokenValidationError";
    this.reason = reason;
  }
}

/** The subset of the OIDC discovery document the server relies on. */
export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  introspection_endpoint?: string;
  end_session_endpoint?: string;
  userinfo_endpoint?: string;
}

export type FetchLike = typeof fetch;

/** Discovery cache: one issuer, one document, TTL 24 h. */
export function createDiscoveryCache({
  ttlMs = DISCOVERY_CACHE_TTL_MS,
  fetchImpl = fetch,
  now = () => Date.now(),
}: {
  ttlMs?: number;
  fetchImpl?: FetchLike;
  now?: () => number;
} = {}) {
  let cached: { issuer: string; document: OidcDiscoveryDocument; fetchedAt: number } | null = null;
  return {
    async get({ issuer }: { issuer: string }): Promise<OidcDiscoveryDocument> {
      if (cached !== null && cached.issuer === issuer && now() - cached.fetchedAt < ttlMs) {
        return cached.document;
      }
      const url = issuer.replace(/\/+$/, "") + "/.well-known/openid-configuration";
      const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error("OIDC discovery failed: HTTP " + response.status + " on " + url);
      }
      const document = (await response.json()) as OidcDiscoveryDocument;
      if (document.issuer !== issuer) {
        throw new Error("OIDC discovery issuer mismatch: expected " + issuer + ", got " + document.issuer);
      }
      cached = { issuer, document, fetchedAt: now() };
      return document;
    },
  };
}

export interface JwksCache {
  getKey({ jwksUri, kid }: { jwksUri: string; kid: string }): Promise<JsonWebKey | null>;
}

/** JWKS cache: kid → JWK. An unknown kid triggers exactly one
 * forced re-fetch (key rotation), then gives up with null. */
export function createJwksCache({
  ttlMs = JWKS_CACHE_TTL_MS,
  fetchImpl = fetch,
  now = () => Date.now(),
}: {
  ttlMs?: number;
  fetchImpl?: FetchLike;
  now?: () => number;
} = {}): JwksCache {
  let keys: Map<string, JsonWebKey> | null = null;
  let cachedUri: string | null = null;
  let fetchedAt = 0;
  async function load({ jwksUri, force }: { jwksUri: string; force: boolean }): Promise<void> {
    if (!force && keys !== null && cachedUri === jwksUri && now() - fetchedAt < ttlMs) return;
    const response = await fetchImpl(jwksUri, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error("JWKS fetch failed: HTTP " + response.status + " on " + jwksUri);
    }
    const body = (await response.json()) as { keys?: JsonWebKey[] };
    const list = Array.isArray(body.keys) ? body.keys : [];
    keys = new Map(list.filter((key) => typeof key.kid === "string").map((key) => [key.kid as string, key]));
    cachedUri = jwksUri;
    fetchedAt = now();
  }
  return {
    async getKey({ jwksUri, kid }: { jwksUri: string; kid: string }): Promise<JsonWebKey | null> {
      await load({ jwksUri, force: false });
      const found = keys?.get(kid);
      if (found !== undefined) return found;
      // unknown kid: one forced re-fetch (rotation), then null
      await load({ jwksUri, force: true });
      return keys?.get(kid) ?? null;
    },
  };
}

export interface DecodedJwt {
  header: { alg?: unknown; kid?: unknown; typ?: unknown };
  payload: Record<string, unknown>;
  signedContent: string;
  signature: Buffer;
}

/** Split and decode a compact JWT. Only the shape is checked here —
 * the signature and the claims are verified by verifyAccessToken. */
export function decodeJwt({ token }: { token: string }): DecodedJwt {
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => part === "")) {
    throw new TokenValidationError({ reason: "malformed", message: "a JWT has three non-empty segments" });
  }
  try {
    const header = JSON.parse(Buffer.from(parts[0] as string, "base64url").toString("utf8")) as DecodedJwt["header"];
    const payload = JSON.parse(Buffer.from(parts[1] as string, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    return {
      header,
      payload,
      signedContent: parts[0] + "." + parts[1],
      signature: Buffer.from(parts[2] as string, "base64url"),
    };
  } catch {
    throw new TokenValidationError({ reason: "malformed", message: "header or payload is not JSON" });
  }
}

/** Whether a bearer token looks like a compact JWT (three segments)
 * — opaque PATs take the introspection path instead. */
export function isJwtShape({ token }: { token: string }): boolean {
  return token.split(".").length === 3 && token.split(".").every((part) => part !== "");
}

/** Full local validation of an access token: RS256 signature via the
 * JWKS, then iss / aud / exp / nbf with the clock leeway. Returns the
 * claims on success, throws TokenValidationError otherwise. */
export async function verifyAccessToken({
  token,
  issuer,
  audiences,
  jwks,
  jwksUri,
  now = () => Date.now(),
  leewaySeconds = CLOCK_LEEWAY_SECONDS,
}: {
  token: string;
  issuer: string;
  audiences: string[];
  jwks: JwksCache;
  jwksUri: string;
  now?: () => number;
  leewaySeconds?: number;
}): Promise<Record<string, unknown>> {
  const decoded = decodeJwt({ token });
  if (decoded.header.alg !== "RS256") {
    throw new TokenValidationError({
      reason: "unsupported-algorithm",
      message: "only RS256 is accepted, got " + String(decoded.header.alg),
    });
  }
  if (typeof decoded.header.kid !== "string" || decoded.header.kid === "") {
    throw new TokenValidationError({ reason: "missing-kid", message: "the JWT header carries no kid" });
  }
  const jwk = await jwks.getKey({ jwksUri, kid: decoded.header.kid });
  if (jwk === null) {
    throw new TokenValidationError({ reason: "unknown-kid", message: "no JWKS key for kid " + decoded.header.kid });
  }
  const publicKey = createPublicKey({ key: jwk, format: "jwk" });
  const signatureValid = cryptoVerify(
    "RSA-SHA256",
    Buffer.from(decoded.signedContent, "utf8"),
    publicKey,
    decoded.signature,
  );
  if (!signatureValid) {
    throw new TokenValidationError({ reason: "bad-signature", message: "RS256 signature mismatch" });
  }
  const payload = decoded.payload;
  const nowSeconds = Math.floor(now() / 1000);
  if (typeof payload.exp !== "number" || nowSeconds - leewaySeconds >= payload.exp) {
    throw new TokenValidationError({ reason: "expired", message: "the token is expired" });
  }
  if (typeof payload.nbf === "number" && payload.nbf - leewaySeconds > nowSeconds) {
    throw new TokenValidationError({ reason: "not-yet-valid", message: "the token is not yet valid" });
  }
  if (payload.iss !== issuer) {
    throw new TokenValidationError({
      reason: "wrong-issuer",
      message: "iss " + String(payload.iss) + " is not " + issuer,
    });
  }
  const audience = payload.aud;
  const audienceList = Array.isArray(audience) ? audience : typeof audience === "string" ? [audience] : [];
  if (!audienceList.some((entry) => typeof entry === "string" && audiences.includes(entry))) {
    throw new TokenValidationError({ reason: "wrong-audience", message: "aud does not contain an accepted audience" });
  }
  return payload;
}
