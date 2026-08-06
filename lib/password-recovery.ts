// Tracks that a sign-in came from an invite or a password-reset link, so the
// app can insist a password is actually set before letting anyone in.
//
// The problem this solves: Supabase turns a recovery link into a real session
// the moment the page loads, and then strips the token out of the URL. So by
// the time any component looks at the address bar, every trace that this was a
// reset is gone and the user simply looks signed in. The sign-in guard then
// did the obvious thing and sent them to the dashboard — password never set,
// which defeats the point of requiring one.
//
// The flag is captured at module load, which runs before React renders, and
// held in sessionStorage so it survives the redirect Supabase performs.

const KEY = "clubos-password-recovery";

function looksLikeRecovery(url: string): boolean {
  return /type=(recovery|invite|signup)/.test(url);
}

// Runs once, on first import, as early as possible in the page's life.
if (typeof window !== "undefined") {
  try {
    if (looksLikeRecovery(window.location.hash + window.location.search)) {
      window.sessionStorage.setItem(KEY, "1");
    }
  } catch {
    // Private browsing can refuse sessionStorage. Losing the flag means the
    // old behaviour, not a crash.
  }
}

// A recovery is only meaningful while there's a session — the link is what
// creates one. So a signed-out user can never legitimately be mid-recovery,
// and any flag still lying around at that point is stale. Calling this on the
// sign-out path makes every stuck case heal itself rather than locking someone
// out of their own account.
export function clearStaleRecovery(hasSession: boolean): void {
  if (!hasSession) clearPasswordRecovery();
}

const EVENT = "clubos-recovery-change";

// Lets the sign-in guard react the moment the flag changes, rather than only
// on a full page load. Without this, clearing the flag after a password was
// saved left the guard still holding the old value and bouncing the user back
// to the sign-in screen for ever.
export function onPasswordRecoveryChange(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

function announce(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function markPasswordRecovery(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
  announce();
}

export function isPasswordRecovery(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function clearPasswordRecovery(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  announce();
}
