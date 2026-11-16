// A verified access code is a site-wide event: the form lives in the
// site header (issue #222), but pages like the editor must refresh
// their session when it happens. A tiny listener set, no state.

type AccessCodeListener = () => void;

const listeners = new Set<AccessCodeListener>();

/** Announce that the site access code was just verified. */
export function notifyAccessCodeVerified(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to access-code verifications; returns the unsubscribe. */
export function onAccessCodeVerified(listener: AccessCodeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
