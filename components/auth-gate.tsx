"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { isPlayerHost, isPortalPath, PORTAL_LOGIN, portalHome } from "@/lib/portal-host";
import {
  isPasswordRecovery, markPasswordRecovery, clearStaleRecovery, onPasswordRecoveryChange,
} from "@/lib/password-recovery";

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

  // Whether this session came from an invite or a reset link and still owes us
  // a password.
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    // Kept in step with the flag rather than read once. Reading it once was a
    // trap: clearing the flag after a password was saved left this holding the
    // old value, so the guard kept pushing the user back to the sign-in screen
    // and they could never get in.
    const sync = () => setRecovery(isPasswordRecovery());
    sync();
    const off = onPasswordRecoveryChange(sync);

    if (!supabase) return off;
    // Belt and braces alongside the URL check: Supabase announces a recovery
    // sign-in on this channel too, and the two catch slightly different cases
    // depending on how the link was opened.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") markPasswordRecovery();
    });
    return () => {
      off();
      data.subscription.unsubscribe();
    };
  }, []);

  // A recovery only exists alongside a session, so a signed-out user can never
  // legitimately be mid-recovery. Anything left over at that point is stale and
  // gets cleared — which is what makes every stuck case heal itself instead of
  // locking someone out.
  useEffect(() => {
    if (loading) return;
    if (!session) clearStaleRecovery(false);
  }, [session, loading]);

  const isStaffLogin = pathname === "/login";
  const isPortalLogin = pathname === PORTAL_LOGIN;
  const isLoginPage = isStaffLogin || isPortalLogin;
  const onPortal = isPortalPath(pathname, playerHost);

  useEffect(() => {
    if (loading || !supabaseConfigured) return;

    if (!session && !isLoginPage) {
      router.replace(onPortal ? PORTAL_LOGIN : "/login");
      return;
    }

    // Mid-recovery, the sign-in screen is where they need to be — it's the
    // screen that asks for the new password. Sending them to the dashboard
    // here is exactly the bug that let people through a reset link without
    // ever typing one.
    if (session && recovery && !onPortal) {
      if (!isStaffLogin) router.replace("/login");
      return;
    }

    if (session && isLoginPage) {
      router.replace(isPortalLogin || playerHost ? portalHome(playerHost) : "/dashboard");
    }
  }, [session, loading, isLoginPage, isStaffLogin, isPortalLogin, onPortal, playerHost, recovery, router]);

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
