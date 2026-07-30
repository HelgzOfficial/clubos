"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (loading || !supabaseConfigured) return;
    if (!session && !isLoginPage) {
      router.replace("/login");
    } else if (session && isLoginPage) {
      router.replace("/dashboard");
    }
  }, [session, loading, isLoginPage, router]);

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
    // Redirect is in flight — render nothing to avoid a flash of protected content.
    return null;
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
