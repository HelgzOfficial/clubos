// The players' companion has its own hostname, where the portal is served at
// the root rather than under /portal. That rewrite happens in middleware, so
// the browser's path on that host is just "/" — which means anything on the
// client that decides "is this the portal?" by looking at the pathname alone
// gets the wrong answer. This is the one place that knows the difference.
//
// Keep PLAYER_HOST in step with middleware.ts.
export const PLAYER_HOST = "players.clubosapp.co";

export function isPlayerHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.toLowerCase() === PLAYER_HOST;
}

// True for every player-facing screen, on either hostname.
export function isPortalPath(pathname: string, playerHost: boolean): boolean {
  return playerHost || pathname === "/portal" || pathname.startsWith("/portal/");
}

// Where a signed-out player should be sent. Same path on both hosts — the
// players' host lets /portal/login through untouched.
export const PORTAL_LOGIN = "/portal/login";

// Where a player lands once they're signed in.
export function portalHome(playerHost: boolean): string {
  return playerHost ? "/" : "/portal";
}
