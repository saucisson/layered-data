// ============================================================
// Layered Data — the /auth/* routes (LD-2, milestone Auth v1)
//
//   GET /auth/login     → 302 to the IdP authorize endpoint (PKCE
//                         S256 + state + nonce, server-side)
//   GET /auth/callback  → code exchange, id_token verification
//                         (signature, iss, aud, nonce), session
//                         creation, Set-Cookie sid, 302 home
//   GET /auth/me        → the connected user, or 401
//   GET /auth/logout    → local session destruction + RP-initiated
//                         logout at the IdP (id_token_hint)
//
// The handler returns true when it answered the request, so the main
// router can delegate the /auth/ namespace to it.
// ============================================================
import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson } from "../httpUtils.ts";
import { decodeJwt, verifyAccessToken, TokenValidationError, type FetchLike } from "./jwt.ts";
import {
  buildAuthorizationUrl,
  buildEndSessionUrl,
  createOpaqueValue,
  createPkcePair,
  exchangeCodeForTokens,
  refreshTokens,
  OidcError,
  type TokenSet,
} from "./oidc.ts";
import {
  clearSessionCookieHeader,
  parseCookies,
  sessionCookieHeader,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "./sessions.ts";
import type { AuthService } from "./service.ts";

function sendRedirect({
  response,
  location,
  extraHeaders = {},
}: {
  response: ServerResponse;
  location: string;
  extraHeaders?: Record<string, string>;
}): void {
  response.writeHead(302, { Location: location, ...extraHeaders });
  response.end();
}

/** Only same-site paths are valid return targets — never an absolute
 * URL (open redirect). */
function safeReturnTo({ candidate }: { candidate: string | null }): string {
  if (candidate !== null && candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  return "/";
}

/** The public base URL of the app: the configured one wins; otherwise
 * it is derived from the request (behind a reverse proxy,
 * x-forwarded-proto / x-forwarded-host carry the truth). */
function publicBaseUrlOf({ configBaseUrl, request }: { configBaseUrl: string; request: IncomingMessage }): string {
  if (configBaseUrl !== "") return configBaseUrl;
  const forwardedHost = request.headers["x-forwarded-host"];
  const host = typeof forwardedHost === "string" && forwardedHost !== "" ? forwardedHost : request.headers.host;
  const forwardedProto = request.headers["x-forwarded-proto"];
  const proto = typeof forwardedProto === "string" && forwardedProto !== "" ? forwardedProto : "http";
  return host ? proto + "://" + host : "http://localhost";
}

function userOfIdToken({ claims }: { claims: Record<string, unknown> }): SessionUser {
  const name =
    typeof claims.name === "string" && claims.name !== ""
      ? claims.name
      : typeof claims.preferred_username === "string"
        ? claims.preferred_username
        : "utilisateur";
  return {
    sub: typeof claims.sub === "string" ? claims.sub : "",
    name,
    email: typeof claims.email === "string" ? claims.email : "",
  };
}

/** The exp claim of a token, read without verification — only used to
 * decide WHEN to refresh, never to trust the token. */
function expiryOf({ token }: { token: string }): number | null {
  try {
    const decoded = decodeJwt({ token });
    return typeof decoded.payload.exp === "number" ? decoded.payload.exp : null;
  } catch {
    return null;
  }
}

/** Silent refresh with rotation, server-side only: when the session's
 * access token is expired and a refresh token exists, exchange it and
 * rotate. A failed refresh destroys the session — the user logs in
 * again. */
export async function refreshSessionIfNeeded({
  service,
  sid,
  fetchImpl = fetch,
  now = () => Date.now(),
}: {
  service: AuthService;
  sid: string;
  fetchImpl?: FetchLike;
  now?: () => number;
}): Promise<void> {
  const session = service.sessions.get({ sid });
  if (session === null) return;
  const expired = session.accessTokenExpiresAt !== null && Math.floor(now() / 1000) >= session.accessTokenExpiresAt;
  if (!expired || session.refreshToken === null) return;
  try {
    const document = await service.discovery.get({ issuer: service.config.issuer });
    const refreshed = await refreshTokens({
      discovery: document,
      refreshToken: session.refreshToken,
      clientId: service.config.clientId,
      clientSecret: service.config.clientSecret,
      fetchImpl,
    });
    service.sessions.updateTokens({
      sid,
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: expiryOf({ token: refreshed.accessToken }),
      refreshToken: refreshed.refreshToken,
    });
  } catch {
    service.sessions.destroy({ sid });
  }
}

export function createAuthRouteHandler({
  service,
  fetchImpl = fetch,
  now = () => Date.now(),
}: {
  service: AuthService;
  fetchImpl?: FetchLike;
  now?: () => number;
}) {
  return async function handleAuthRoute({
    request,
    response,
    url,
  }: {
    request: IncomingMessage;
    response: ServerResponse;
    url: URL;
  }): Promise<boolean> {
    const { config } = service;

    // ---- GET /auth/login ----
    if (url.pathname === "/auth/login" && request.method === "GET") {
      const returnTo = safeReturnTo({ candidate: url.searchParams.get("returnTo") });
      if (config.disabled) {
        // local mode without IdP: no round trip, straight home
        sendRedirect({ response, location: returnTo });
        return true;
      }
      if (config.issuer === "" || config.clientId === "") {
        sendJson({
          response,
          statusCode: 503,
          body: { erreur: "IdP non configuré — posez AUTH_ISSUER et AUTH_CLIENT_ID (ou AUTH_DISABLED=1 en local)" },
        });
        return true;
      }
      const discovery = await service.discovery.get({ issuer: config.issuer });
      const baseUrl = publicBaseUrlOf({ configBaseUrl: config.publicBaseUrl, request });
      const redirectUri = baseUrl + "/auth/callback";
      const { codeVerifier, codeChallenge } = createPkcePair();
      const state = createOpaqueValue();
      const nonce = createOpaqueValue();
      service.sessions.addPendingLogin({
        pending: { state, nonce, codeVerifier, returnTo, createdAt: now() },
      });
      sendRedirect({
        response,
        location: buildAuthorizationUrl({
          discovery,
          clientId: config.clientId,
          redirectUri,
          state,
          nonce,
          codeChallenge,
        }),
      });
      return true;
    }

    // ---- GET /auth/callback ----
    if (url.pathname === "/auth/callback" && request.method === "GET") {
      const errorParam = url.searchParams.get("error");
      if (errorParam !== null) {
        sendJson({
          response,
          statusCode: 400,
          body: { erreur: "l'IdP a refusé la connexion : " + errorParam },
        });
        return true;
      }
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const pending = state === null ? null : service.sessions.takePendingLogin({ state });
      if (code === null || pending === null) {
        sendJson({
          response,
          statusCode: 400,
          body: { erreur: "state inconnu ou code manquant — recommencez la connexion" },
        });
        return true;
      }
      const baseUrl = publicBaseUrlOf({ configBaseUrl: config.publicBaseUrl, request });
      const discovery = await service.discovery.get({ issuer: config.issuer });
      let tokens: TokenSet;
      try {
        tokens = await exchangeCodeForTokens({
          discovery,
          code,
          codeVerifier: pending.codeVerifier,
          redirectUri: baseUrl + "/auth/callback",
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          fetchImpl,
        });
      } catch (error) {
        const statusCode = error instanceof OidcError ? (error.statusCode ?? 502) : 502;
        sendJson({
          response,
          statusCode,
          body: { erreur: "échange du code refusé par l'IdP" },
        });
        return true;
      }
      // verify the id_token: signature via JWKS, iss, aud = client_id,
      // exp/nbf, and the nonce bound to this login round trip
      try {
        const claims = await verifyAccessToken({
          token: tokens.idToken,
          issuer: config.issuer,
          audiences: [config.clientId],
          jwks: service.jwks,
          jwksUri: discovery.jwks_uri,
          now,
        });
        if (claims.nonce !== pending.nonce) {
          throw new TokenValidationError({ reason: "malformed", message: "nonce mismatch" });
        }
        const session = service.sessions.create({
          user: userOfIdToken({ claims }),
          idToken: tokens.idToken,
          accessToken: tokens.accessToken,
          accessTokenExpiresAt: expiryOf({ token: tokens.accessToken }),
          refreshToken: tokens.refreshToken,
        });
        sendRedirect({
          response,
          location: pending.returnTo,
          extraHeaders: {
            "Set-Cookie": sessionCookieHeader({
              sid: session.id,
              secure: config.cookieSecure,
              maxAgeSeconds: config.sessionTtlSeconds,
            }),
          },
        });
      } catch {
        sendJson({
          response,
          statusCode: 401,
          body: { erreur: "id_token invalide — la connexion est refusée" },
        });
      }
      return true;
    }

    // ---- GET /auth/me ----
    if (url.pathname === "/auth/me" && request.method === "GET") {
      const identity = await service.resolveIdentity({ request });
      if (identity.kind === "anonymous") {
        sendJson({ response, statusCode: 401, body: { erreur: "authentification requise" } });
        return true;
      }
      if (identity.kind === "session") {
        const cookies = parseCookies({ header: request.headers.cookie });
        const sid = cookies[SESSION_COOKIE_NAME];
        if (typeof sid === "string") await refreshSessionIfNeeded({ service, sid, fetchImpl, now });
        sendJson({
          response,
          statusCode: 200,
          body: {
            utilisateur: identity.user.name,
            email: identity.user.email,
            sub: identity.user.sub,
            identity: identity.kind,
          },
        });
        return true;
      }
      if (identity.kind === "dev-user") {
        sendJson({
          response,
          statusCode: 200,
          body: { utilisateur: "développeur-local", identity: "dev-user" },
        });
        return true;
      }
      if (identity.kind === "bearer-jwt" || identity.kind === "pat") {
        const claims = identity.kind === "bearer-jwt" ? identity.claims : {};
        sendJson({
          response,
          statusCode: 200,
          body: {
            utilisateur: typeof claims.name === "string" && claims.name !== "" ? claims.name : identity.sub,
            sub: identity.sub,
            identity: identity.kind,
          },
        });
        return true;
      }
      // a personal access code keeps its historical shape
      sendJson({
        response,
        statusCode: 200,
        body: { utilisateur: "code-personnel", identity: identity.kind },
      });
      return true;
    }

    // ---- GET /auth/logout ----
    if (url.pathname === "/auth/logout" && request.method === "GET") {
      const cookies = parseCookies({ header: request.headers.cookie });
      const sid = cookies[SESSION_COOKIE_NAME];
      let idTokenHint: string | null = null;
      if (typeof sid === "string" && sid !== "") {
        const session = service.sessions.get({ sid });
        if (session !== null) idTokenHint = session.idToken;
        service.sessions.destroy({ sid });
      }
      const clearCookie = clearSessionCookieHeader({ secure: config.cookieSecure });
      if (config.disabled || config.issuer === "" || idTokenHint === null) {
        sendRedirect({ response, location: "/", extraHeaders: { "Set-Cookie": clearCookie } });
        return true;
      }
      try {
        const discovery = await service.discovery.get({ issuer: config.issuer });
        if (typeof discovery.end_session_endpoint === "string") {
          const baseUrl = publicBaseUrlOf({ configBaseUrl: config.publicBaseUrl, request });
          sendRedirect({
            response,
            location: buildEndSessionUrl({
              endSessionEndpoint: discovery.end_session_endpoint,
              idTokenHint,
              postLogoutRedirectUri: baseUrl + "/",
            }),
            extraHeaders: { "Set-Cookie": clearCookie },
          });
          return true;
        }
      } catch {
        // the IdP is unreachable: the local session is already gone
      }
      sendRedirect({ response, location: "/", extraHeaders: { "Set-Cookie": clearCookie } });
      return true;
    }

    return false;
  };
}
