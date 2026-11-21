// ============================================================
// Layered Data — the auth service (LD-2 / LD-3 / LD-5, Auth v1)
//
// One place resolves "who is behind this request":
//   - AUTH_DISABLED=1        → a fictitious dev user (local only,
//                              fatal in production — see the guard)
//   - the `sid` cookie       → a server-side session (OIDC login)
//   - Authorization: Bearer  → a JWT validated locally via the JWKS,
//                              or an opaque PAT via introspection
//   - x-access-code          → a personal access code (hashed lookup in
//                              `users`, issue #140) — the shared static
//                              API_TOKEN is gone (LD-6)
//   - otherwise              → anonymous (the routes answer 401)
// ============================================================
import type { IncomingMessage } from "node:http";

import {
  createDiscoveryCache,
  createJwksCache,
  isJwtShape,
  verifyAccessToken,
  TokenValidationError,
  type FetchLike,
} from "./jwt.ts";
import {
  createSessionStore,
  parseCookies,
  SESSION_COOKIE_NAME,
  type SessionStore,
  type SessionUser,
} from "./sessions.ts";
import { createIntrospectionCache, introspectToken, type IntrospectionResult } from "./oidc.ts";
import { hashAccessCode } from "../httpUtils.ts";

export interface AuthConfig {
  disabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  allowedAudiences: string[];
  apiClientId: string;
  apiClientSecret: string;
  cookieSecure: boolean;
  publicBaseUrl: string;
  sessionTtlSeconds: number;
}

/** The auth configuration, entirely from the environment — no code
 * change is ever needed between a local IdP and the production one. */
export function authConfigFromEnv({ env = process.env }: { env?: NodeJS.ProcessEnv } = {}): AuthConfig {
  const nodeEnv = env.NODE_ENV ?? "";
  return {
    disabled: env.AUTH_DISABLED === "1",
    issuer: (env.AUTH_ISSUER ?? "").replace(/\/+$/, ""),
    clientId: env.AUTH_CLIENT_ID ?? "",
    clientSecret: env.AUTH_CLIENT_SECRET ?? "",
    allowedAudiences: (env.AUTH_ALLOWED_AUDIENCES ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== ""),
    apiClientId: env.AUTH_API_CLIENT_ID ?? "",
    apiClientSecret: env.AUTH_API_CLIENT_SECRET ?? "",
    // Secure cookies in production (or when forced); a browser refuses
    // a Secure cookie over plain HTTP, so local dev turns it off —
    // by configuration, never by a code change.
    cookieSecure: env.AUTH_COOKIE_SECURE !== undefined ? env.AUTH_COOKIE_SECURE === "1" : nodeEnv === "production",
    publicBaseUrl: (env.AUTH_PUBLIC_BASE_URL ?? "").replace(/\/+$/, ""),
    sessionTtlSeconds: Math.max(60, Number(env.AUTH_SESSION_TTL_SECONDS ?? 24 * 60 * 60)),
  };
}

/** The mandatory guard: AUTH_DISABLED=1 must be impossible in
 * production. Throws — the boot fails fast. */
export function assertAuthConfigSafe({
  config,
  nodeEnv = process.env.NODE_ENV ?? "",
}: {
  config: AuthConfig;
  nodeEnv?: string;
}): void {
  if (config.disabled && nodeEnv === "production") {
    throw new Error(
      "AUTH_DISABLED=1 is forbidden with NODE_ENV=production — the auth cannot be switched off in production",
    );
  }
}

export type RequestIdentity =
  | { kind: "dev-user" }
  | { kind: "session"; user: SessionUser }
  | { kind: "bearer-jwt"; sub: string; claims: Record<string, unknown> }
  | { kind: "pat"; sub: string }
  | { kind: "personal-code"; accessCodeHash: string }
  | { kind: "anonymous" };

/** Whether the identity authenticates the request (everything but
 * anonymous). */
export function isAuthenticated({ identity }: { identity: RequestIdentity }): boolean {
  return identity.kind !== "anonymous";
}

export function createAuthService(
  {
    config,
    fetchImpl = fetch,
    now = () => Date.now(),
  }: {
    config: AuthConfig;
    fetchImpl?: FetchLike;
    now?: () => number;
  } = { config: authConfigFromEnv() },
) {
  const discovery = createDiscoveryCache({ fetchImpl, now });
  const jwks = createJwksCache({ fetchImpl, now });
  const sessions: SessionStore = createSessionStore({ ttlSeconds: config.sessionTtlSeconds, now });
  const introspectionCache = createIntrospectionCache({ now });

  async function introspectCached({ token }: { token: string }): Promise<IntrospectionResult> {
    const document = await discovery.get({ issuer: config.issuer });
    if (typeof document.introspection_endpoint !== "string") {
      return { active: false, sub: null, exp: null };
    }
    return introspectionCache.introspect({
      token,
      call: () =>
        introspectToken({
          introspectionEndpoint: document.introspection_endpoint as string,
          clientId: config.apiClientId,
          clientSecret: config.apiClientSecret,
          token,
          fetchImpl,
        }),
    });
  }

  /** Resolve the identity of a request. Never throws on a bad token:
   * a rejected token is simply anonymous (the route answers 401). */
  async function resolveIdentity({ request }: { request: IncomingMessage }): Promise<RequestIdentity> {
    if (config.disabled) return { kind: "dev-user" };

    const cookies = parseCookies({ header: request.headers.cookie });
    const sid = cookies[SESSION_COOKIE_NAME];
    if (typeof sid === "string" && sid !== "") {
      const session = sessions.get({ sid });
      if (session !== null) {
        return { kind: "session", user: session.user };
      }
    }

    const authorization = request.headers.authorization;
    if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
      const token = authorization.slice("Bearer ".length).trim();
      if (token !== "" && config.issuer !== "") {
        if (isJwtShape({ token })) {
          try {
            const document = await discovery.get({ issuer: config.issuer });
            const audiences = config.allowedAudiences.length > 0 ? config.allowedAudiences : [config.clientId];
            const claims = await verifyAccessToken({
              token,
              issuer: config.issuer,
              audiences,
              jwks,
              jwksUri: document.jwks_uri,
              now,
            });
            return {
              kind: "bearer-jwt",
              sub: typeof claims.sub === "string" ? claims.sub : "",
              claims,
            };
          } catch (error) {
            if (error instanceof TokenValidationError) return { kind: "anonymous" };
            throw error;
          }
        }
        // opaque token: a PAT, validated by introspection
        try {
          const result = await introspectCached({ token });
          if (result.active && result.sub !== null) return { kind: "pat", sub: result.sub };
        } catch {
          return { kind: "anonymous" };
        }
        return { kind: "anonymous" };
      }
    }

    // a personal access code (issue #140): the hash is the stable key —
    // the clear code never persists, never logs
    const workshopHeader = request.headers["x-access-code"];
    if (typeof workshopHeader === "string" && workshopHeader.trim() !== "") {
      return { kind: "personal-code", accessCodeHash: hashAccessCode({ code: workshopHeader.trim() }) };
    }

    return { kind: "anonymous" };
  }

  return {
    config,
    sessions,
    discovery,
    jwks,
    resolveIdentity,
    introspectCached,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
