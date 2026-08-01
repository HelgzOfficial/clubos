"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";
import { isPlayerHost, isPortalPath, PORTAL_LOGIN, portalHome } from "@/lib/portal-host";

// Guards every page behind a Supabase session, but the player portal and the
// staff app have separate front doors and must never send someone to the
// other one.
//
// This previously only knew about /login, so a signed-out player was pushed to
// the staff sign-in — and on the players' hostname, where /login bounces back
// to the portal, that became a loop: redirect, render nothing, redirect. The
// symptom was a blank navy screen, because "render nothing" is exactly what
// this component does while a redirect is in flight.
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Read on the client only, and after mount, so the server-rendered markup
  // and the first client render agree.
  const [playerHost, setPlayerHost] = useState(false);
  useEffect(() => { setPlayerHost(isPlayerHost()); }, []);

  const isStaffLogin = pathname === "/login";
  const isPortalLogin = pathname === PORTAL_LOGIN;
  const isLoginPage = isStaffLogin || isPortalLogin;
  const onPortal = isPortalPath(pathname, playerHost);

  useEffect(() => {
    if (loading || !supabaseConfigured) return;
    if (!session && !isLoginPage) {
      router.replace(onPortal ? PORTAL_LOGIN : "/login");
    } else if (session && isLoginPage) {
      router.replace(isPortalLogin || playerHost ? portalHome(playerHost) : "/dashboard");
    }
  }, [session, loading, isLoginPage, isPortalLogin, onPortal, playerHost, router]);

  if (!supabaseConfigured) {
    return isLoginPage ? <>{children}</> : <SupabaseNotConfigured />;
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-navy-900 text-sm text-neutral-400">
        Loading…
      </div>
    );
  }

  if (!session && !isLoginPage) {
    // Redirect is in flight. Say so rather than rendering an empty screen — if
    // a redirect ever fails again, the player sees words and a way out instead
    // of a blank page with no clue what went wrong.
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-navy-900 px-6 text-center text-sm text-neutral-400">
        <p>Taking you to sign in…</p>
        <a
          href={onPortal ? PORTAL_LOGIN : "/login"}
          className="text-neutral-300 underline underline-offset-2 hover:text-white"
        >
          Tap here if nothing happens
        </a>
      </div>
    );
  }

  return <>{children}</>;
}

function SupabaseNotConfigured() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-navy-900 px-6 text-center text-white">
      <div>
        <p className="text-lg font-semibold">Login isn&apos;t set up yet</p>
        <p className="mt-2 max-w-sm text-sm text-neutral-400">
          The Supabase connection details haven&apos;t been added to this deployment&apos;s Environment Variables yet. Add
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then redeploy.
        </p>
      </div>
    </div>
  );
}
