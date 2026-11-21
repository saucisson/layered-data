// The JWT/JWKS brick checks (LD-1, milestone Auth v1): an RSA pair is
// generated for the exercise, JWTs are signed in-process, and the
// discovery/JWKS endpoints are served by a fake fetch — no network, no
// Docker, deterministic (level L1 of the auth testing ladder).
//
//     node tests/auth-jwt-checks.mts   (exit 1 on any failure)

import { generateKeyPairSync, sign as cryptoSign, type KeyObject } from "node:crypto";

import {
  createDiscoveryCache,
  createJwksCache,
  decodeJwt,
  isJwtShape,
  verifyAccessToken,
  TokenValidationError,
  type FetchLike,
} from "../server/auth/jwt.ts";

// ---- the assertion ledger ------------------------------------------

const failures: string[] = [];
let assertions = 0;

function check(label: string, condition: boolean): void {
  assertions++;
  if (!condition) failures.push(label);
}

// ---- the exercise key pair ------------------------------------------

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
publicJwk.kid = "test-kid";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

const ISSUER = "https://idp.test";
const JWKS_URI = ISSUER + "/jwks";
const CLIENT_ID = "layered-data-test";

function signJwt({
  payload,
  key = privateKey as KeyObject,
  kid = "test-kid",
  alg = "RS256",
}: {
  payload: Record<string, unknown>;
  key?: KeyObject;
  kid?: string;
  alg?: string;
}): string {
  const header = Buffer.from(JSON.stringify({ alg, typ: "JWT", kid })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signedContent = header + "." + body;
  if (alg === "none") return signedContent + ".";
  const signature = cryptoSign("RSA-SHA256", Buffer.from(signedContent), key).toString("base64url");
  return signedContent + "." + signature;
}

function validPayload({ nowSeconds }: { nowSeconds: number }): Record<string, unknown> {
  return {
    iss: ISSUER,
    sub: "user-123",
    aud: CLIENT_ID,
    exp: nowSeconds + 300,
    nbf: nowSeconds - 10,
    iat: nowSeconds,
  };
}

// ---- a fake fetch serving discovery + JWKS ---------------------------

function fakeFetchFactory({
  jwksCalls,
  discoveryCalls,
  extraKeys = [] as Record<string, unknown>[],
}: {
  jwksCalls: { count: number };
  discoveryCalls: { count: number };
  extraKeys?: Record<string, unknown>[];
}): FetchLike {
  return (async (url: string | URL | Request) => {
    const href = String(url);
    if (href === ISSUER + "/.well-known/openid-configuration") {
      discoveryCalls.count++;
      return new Response(
        JSON.stringify({
          issuer: ISSUER,
          authorization_endpoint: ISSUER + "/authorize",
          token_endpoint: ISSUER + "/token",
          jwks_uri: JWKS_URI,
          introspection_endpoint: ISSUER + "/introspect",
          end_session_endpoint: ISSUER + "/endsession",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (href === JWKS_URI) {
      jwksCalls.count++;
      return new Response(JSON.stringify({ keys: [publicJwk, ...extraKeys] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as FetchLike;
}

// ---- the checks -------------------------------------------------------

const nowSeconds = Math.floor(Date.now() / 1000);
const jwksCalls = { count: 0 };
const discoveryCalls = { count: 0 };
const fetchImpl = fakeFetchFactory({ jwksCalls, discoveryCalls });
const discovery = createDiscoveryCache({ fetchImpl });
const jwks = createJwksCache({ fetchImpl });

// discovery: fetched once, then cached
const document = await discovery.get({ issuer: ISSUER });
check("discovery returns the document", document.jwks_uri === JWKS_URI);
await discovery.get({ issuer: ISSUER });
check("discovery is cached (one fetch)", discoveryCalls.count === 1);

// a valid token verifies and returns its claims
const validToken = signJwt({ payload: validPayload({ nowSeconds }) });
const claims = await verifyAccessToken({
  token: validToken,
  issuer: ISSUER,
  audiences: [CLIENT_ID],
  jwks,
  jwksUri: JWKS_URI,
  now: () => nowSeconds * 1000,
});
check("a valid token verifies", claims.sub === "user-123");
check("the JWKS was fetched once for the valid token", jwksCalls.count === 1);

// aud as an array containing the client id is accepted
const arrayAudToken = signJwt({
  payload: { ...validPayload({ nowSeconds }), aud: ["other-app", CLIENT_ID] },
});
const arrayAudClaims = await verifyAccessToken({
  token: arrayAudToken,
  issuer: ISSUER,
  audiences: [CLIENT_ID],
  jwks,
  jwksUri: JWKS_URI,
  now: () => nowSeconds * 1000,
});
check("an aud array containing the client id is accepted", arrayAudClaims.sub === "user-123");

// an expired token is rejected (beyond the 60 s leeway)
const expiredToken = signJwt({
  payload: { ...validPayload({ nowSeconds }), exp: nowSeconds - 120 },
});
let reason: string | null = null;
try {
  await verifyAccessToken({
    token: expiredToken,
    issuer: ISSUER,
    audiences: [CLIENT_ID],
    jwks,
    jwksUri: JWKS_URI,
    now: () => nowSeconds * 1000,
  });
} catch (error) {
  reason = error instanceof TokenValidationError ? error.reason : "other";
}
check("an expired token is rejected with reason expired", reason === "expired");

// a token inside the 60 s leeway is still accepted
const leewayToken = signJwt({
  payload: { ...validPayload({ nowSeconds }), exp: nowSeconds - 30 },
});
const leewayClaims = await verifyAccessToken({
  token: leewayToken,
  issuer: ISSUER,
  audiences: [CLIENT_ID],
  jwks,
  jwksUri: JWKS_URI,
  now: () => nowSeconds * 1000,
});
check("a token within the 60 s leeway is accepted", leewayClaims.sub === "user-123");

// a wrong audience is rejected
const wrongAudToken = signJwt({
  payload: { ...validPayload({ nowSeconds }), aud: "another-app" },
});
reason = null;
try {
  await verifyAccessToken({
    token: wrongAudToken,
    issuer: ISSUER,
    audiences: [CLIENT_ID],
    jwks,
    jwksUri: JWKS_URI,
    now: () => nowSeconds * 1000,
  });
} catch (error) {
  reason = error instanceof TokenValidationError ? error.reason : "other";
}
check("a wrong audience is rejected with reason wrong-audience", reason === "wrong-audience");

// a wrong issuer is rejected
const wrongIssuerToken = signJwt({
  payload: { ...validPayload({ nowSeconds }), iss: "https://evil.test" },
});
reason = null;
try {
  await verifyAccessToken({
    token: wrongIssuerToken,
    issuer: ISSUER,
    audiences: [CLIENT_ID],
    jwks,
    jwksUri: JWKS_URI,
    now: () => nowSeconds * 1000,
  });
} catch (error) {
  reason = error instanceof TokenValidationError ? error.reason : "other";
}
check("a wrong issuer is rejected with reason wrong-issuer", reason === "wrong-issuer");

// a bad signature is rejected
const otherPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const badSignatureToken = signJwt({
  payload: validPayload({ nowSeconds }),
  key: otherPair.privateKey,
});
reason = null;
try {
  await verifyAccessToken({
    token: badSignatureToken,
    issuer: ISSUER,
    audiences: [CLIENT_ID],
    jwks,
    jwksUri: JWKS_URI,
    now: () => nowSeconds * 1000,
  });
} catch (error) {
  reason = error instanceof TokenValidationError ? error.reason : "other";
}
check("a bad signature is rejected with reason bad-signature", reason === "bad-signature");

// a non-RS256 algorithm (HS256 confusion attack) is rejected before any
// signature check
const hs256Token = signJwt({ payload: validPayload({ nowSeconds }), alg: "HS256" });
reason = null;
try {
  await verifyAccessToken({
    token: hs256Token,
    issuer: ISSUER,
    audiences: [CLIENT_ID],
    jwks,
    jwksUri: JWKS_URI,
    now: () => nowSeconds * 1000,
  });
} catch (error) {
  reason = error instanceof TokenValidationError ? error.reason : "other";
}
check("alg=HS256 is rejected with reason unsupported-algorithm", reason === "unsupported-algorithm");

// alg=none (empty signature segment) is rejected as malformed
const noneToken = signJwt({ payload: validPayload({ nowSeconds }), alg: "none" });
reason = null;
try {
  await verifyAccessToken({
    token: noneToken,
    issuer: ISSUER,
    audiences: [CLIENT_ID],
    jwks,
    jwksUri: JWKS_URI,
    now: () => nowSeconds * 1000,
  });
} catch (error) {
  reason = error instanceof TokenValidationError ? error.reason : "other";
}
check("alg=none is rejected", reason === "malformed" || reason === "unsupported-algorithm");

// a not-yet-valid token is rejected
const futureToken = signJwt({
  payload: { ...validPayload({ nowSeconds }), nbf: nowSeconds + 600 },
});
reason = null;
try {
  await verifyAccessToken({
    token: futureToken,
    issuer: ISSUER,
    audiences: [CLIENT_ID],
    jwks,
    jwksUri: JWKS_URI,
    now: () => nowSeconds * 1000,
  });
} catch (error) {
  reason = error instanceof TokenValidationError ? error.reason : "other";
}
check("a not-yet-valid token is rejected with reason not-yet-valid", reason === "not-yet-valid");

// an unknown kid triggers exactly one JWKS re-fetch, then rejects
const beforeRefetch = jwksCalls.count;
const unknownKidToken = signJwt({ payload: validPayload({ nowSeconds }), kid: "rotated-kid" });
reason = null;
try {
  await verifyAccessToken({
    token: unknownKidToken,
    issuer: ISSUER,
    audiences: [CLIENT_ID],
    jwks,
    jwksUri: JWKS_URI,
    now: () => nowSeconds * 1000,
  });
} catch (error) {
  reason = error instanceof TokenValidationError ? error.reason : "other";
}
check("an unknown kid is rejected with reason unknown-kid", reason === "unknown-kid");
check("an unknown kid triggered exactly one re-fetch", jwksCalls.count === beforeRefetch + 1);

// after rotation the new kid is served and verifies
const rotatedPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const rotatedJwk = rotatedPair.publicKey.export({ format: "jwk" }) as Record<string, unknown>;
rotatedJwk.kid = "rotated-kid";
rotatedJwk.alg = "RS256";
rotatedJwk.use = "sig";
const rotatingFetch = fakeFetchFactory({
  jwksCalls,
  discoveryCalls,
  extraKeys: [rotatedJwk],
});
const rotatingJwks = createJwksCache({ fetchImpl: rotatingFetch });
const rotatedToken = signJwt({
  payload: validPayload({ nowSeconds }),
  key: rotatedPair.privateKey,
  kid: "rotated-kid",
});
const rotatedClaims = await verifyAccessToken({
  token: rotatedToken,
  issuer: ISSUER,
  audiences: [CLIENT_ID],
  jwks: rotatingJwks,
  jwksUri: JWKS_URI,
  now: () => nowSeconds * 1000,
});
check("after rotation the new kid verifies", rotatedClaims.sub === "user-123");

// malformed tokens
reason = null;
try {
  decodeJwt({ token: "not-a-jwt" });
} catch (error) {
  reason = error instanceof TokenValidationError ? error.reason : "other";
}
check("a malformed token is rejected with reason malformed", reason === "malformed");
check("isJwtShape recognizes a compact JWT", isJwtShape({ token: validToken }));
check("isJwtShape rejects an opaque PAT", !isJwtShape({ token: "opaque-pat-value" }));

// ---- the report -------------------------------------------------------

console.log("auth-jwt-checks: " + assertions + " assertions, " + failures.length + " failure(s)");
if (failures.length > 0) {
  for (const failure of failures) console.log("  ÉCHEC: " + failure);
  process.exit(1);
}
