import { NextResponse, type NextRequest } from "next/server";

// The players' companion runs on its own address. Same deployment, same code,
// but a player who bookmarks it, installs it, or gets sent a link never sees
// the staff app's domain — and staff URLs simply don't resolve there.
//
// Both hostnames point at this one Vercel project. Everything below is about
// making one project behave like two apps depending on which door you came in.
const PLAYER_HOST = "players.clubosapp.co";
const STAFF_HOST = "clubosapp.co";

// Files that must be served byte-for-byte on either host.
const PASSTHROUGH = /^\/(sw\.js|offline\.html|favicon\.ico|robots\.txt)$/;
const STATIC_FILE = /\.(png|jpe?g|webp|svg|ico|txt|css|js|woff2?|webmanifest)$/i;

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];

  if (path.startsWith("/_next") || path.startsWith("/api") || PASSTHROUGH.test(path)) {
    return NextResponse.next();
  }

  // -------------------------------------------------------------------------
  // The players' address
  // -------------------------------------------------------------------------
  if (host === PLAYER_HOST) {
    // A different manifest, because on this host the app starts at "/" rather
    // than "/portal". Getting start_url wrong is the usual reason an installed
    // icon opens the wrong screen.
    if (path === "/manifest-portal.json" || path === "/manifest.json") {
      return NextResponse.rewrite(new URL("/manifest-players.json", url));
    }
    if (STATIC_FILE.test(path)) return NextResponse.next();

    // The root of this host IS the portal. A rewrite rather than a redirect,
    // so the address bar keeps saying players.clubosapp.co with nothing after
    // it — which is the whole point of having the subdomain.
    if (path === "/") return NextResponse.rewrite(new URL("/portal", url));

    // AuthGate sends signed-out users to /login; on this host that means the
    // players' sign-in, never the staff one.
    if (path === "/login") return NextResponse.redirect(new URL("/portal/login", url));

    if (path === "/portal" || path.startsWith("/portal/")) return NextResponse.next();

    // Anything staff-facing doesn't belong on the players' address. Send it to
    // the staff app rather than 404ing, so an old bookmark still works.
    const staff = new URL(path, `https://${STAFF_HOST}`);
    staff.search = url.search;
    return NextResponse.redirect(staff);
  }

  // -------------------------------------------------------------------------
  // The staff address
  // -------------------------------------------------------------------------
  if (host === STAFF_HOST || host === `www.${STAFF_HOST}`) {
    // Old /portal links keep working, they just move across to the players'
    // address. Without this, players would carry on installing from the staff
    // domain and the subdomain would never take.
    if (path === "/portal" || path.startsWith("/portal/")) {
      const target = new URL(path === "/portal" ? "/" : path, `https://${PLAYER_HOST}`);
      target.search = url.search;
      return NextResponse.redirect(target);
    }
  }

  // Vercel preview deployments and localhost fall through untouched, so the
  // app still behaves normally when you're testing a branch.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
