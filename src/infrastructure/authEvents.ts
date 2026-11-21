// A session change is a site-wide event: the auth panel lives in the
// site header, but pages like the editor must refresh their session
// when it happens (login or logout). A tiny listener set, no state.

type AuthListener = () => void;

const listeners = new Set<AuthListener>();

/** Announce that the authentication state just changed (login or
 * logout completed). */
export function notifyAuthChanged(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to auth changes; returns the unsubscribe. */
export function onAuthChanged(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
