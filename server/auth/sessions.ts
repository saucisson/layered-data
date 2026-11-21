// ============================================================
// Layered Data — server-side sessions (LD-2, milestone Auth v1)
//
// The browser only ever holds the opaque `sid` cookie (httpOnly,
// Secure outside local dev, SameSite=Lax, app domain only). The id,
// access and refresh tokens stay in this in-memory store — never in
// the browser, never in localStorage. The session expires after 24 h
// of inactivity (sliding window).
// ============================================================
import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "sid";
export const SESSION_TTL_SECONDS = 24 * 60 * 60;
/** Pending login states (state → PKCE verifier + nonce) live at
 * most ten minutes — the round trip to the IdP is short. */
export const PENDING_STATE_TTL_MS = 10 * 60 * 1000;

export interface SessionUser {
  sub: string;
  name: string;
  email: string;
}

export interface SessionRecord {
  id: string;
  user: SessionUser;
  idToken: string;
  accessToken: string;
  accessTokenExpiresAt: number | null;
  refreshToken: string | null;
  createdAt: number;
  lastActivityAt: number;
}

export interface PendingLogin {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  createdAt: number;
}

export function createSessionStore({
  ttlSeconds = SESSION_TTL_SECONDS,
  now = () => Date.now(),
}: {
  ttlSeconds?: number;
  now?: () => number;
} = {}) {
  const sessions = new Map<string, SessionRecord>();
  const pendingLogins = new Map<string, PendingLogin>();
  function sweep(): void {
    const horizon = now() - ttlSeconds * 1000;
    for (const [id, record] of sessions) {
      if (record.lastActivityAt < horizon) sessions.delete(id);
    }
    const pendingHorizon = now() - PENDING_STATE_TTL_MS;
    for (const [state, pending] of pendingLogins) {
      if (pending.createdAt < pendingHorizon) pendingLogins.delete(state);
    }
  }
  return {
    create({
      user,
      idToken,
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
    }: {
      user: SessionUser;
      idToken: string;
      accessToken: string;
      accessTokenExpiresAt: number | null;
      refreshToken: string | null;
    }): SessionRecord {
      sweep();
      const id = createHash("sha256").update(randomBytes(32)).digest("hex");
      const record: SessionRecord = {
        id,
        user,
        idToken,
        accessToken,
        accessTokenExpiresAt,
        refreshToken,
        createdAt: now(),
        lastActivityAt: now(),
      };
      sessions.set(id, record);
      return record;
    },
    /** Sliding expiration: a read refreshes the inactivity window. */
    get({ sid }: { sid: string }): SessionRecord | null {
      const record = sessions.get(sid);
      if (record === undefined) return null;
      if (now() - record.lastActivityAt > ttlSeconds * 1000) {
        sessions.delete(sid);
        return null;
      }
      record.lastActivityAt = now();
      return record;
    },
    updateTokens({
      sid,
      accessToken,
      accessTokenExpiresAt,
      refreshToken,
    }: {
      sid: string;
      accessToken: string;
      accessTokenExpiresAt: number | null;
      refreshToken: string | null;
    }): void {
      const record = sessions.get(sid);
      if (record === undefined) return;
      record.accessToken = accessToken;
      record.accessTokenExpiresAt = accessTokenExpiresAt;
      if (refreshToken !== null) record.refreshToken = refreshToken;
    },
    destroy({ sid }: { sid: string }): void {
      sessions.delete(sid);
    },
    addPendingLogin({ pending }: { pending: PendingLogin }): void {
      sweep();
      pendingLogins.set(pending.state, pending);
    },
    /** Single use: the state is consumed by the callback. */
    takePendingLogin({ state }: { state: string }): PendingLogin | null {
      const pending = pendingLogins.get(state);
      if (pending === undefined) return null;
      pendingLogins.delete(state);
      if (now() - pending.createdAt > PENDING_STATE_TTL_MS) return null;
      return pending;
    },
    get size(): number {
      return sessions.size;
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/** Parse a Cookie header into a name → value map. Malformed pairs are
 * skipped, never thrown. */
export function parseCookies({ header }: { header: string | undefined }): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (typeof header !== "string") return cookies;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name === "") continue;
    const rawValue = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
  }
  return cookies;
}

/** The Set-Cookie value of the session cookie. `Secure` is off only
 * in local dev (a browser refuses Secure over plain HTTP) — driven by
 * configuration, never by a code change. */
export function sessionCookieHeader({
  sid,
  secure,
  maxAgeSeconds = SESSION_TTL_SECONDS,
}: {
  sid: string;
  secure: boolean;
  maxAgeSeconds?: number;
}): string {
  const parts = [
    SESSION_COOKIE_NAME + "=" + encodeURIComponent(sid),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + maxAgeSeconds,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** The Set-Cookie value that expires the session cookie immediately. */
export function clearSessionCookieHeader({ secure }: { secure: boolean }): string {
  const parts = [SESSION_COOKIE_NAME + "=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
