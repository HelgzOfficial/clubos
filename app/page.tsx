"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// If Supabase's invite/reset-password link ever lands here at the bare
// domain instead of straight on /login (e.g. because the exact redirect
// path hasn't been added to Supabase's Redirect URLs allow-list yet), the
// auth tokens Supabase attaches to the URL would otherwise be silently lost
// the moment we redirect to /dashboard. Forwarding them on to /login instead
// means an invite still completes even if that allow-list isn't perfectly
// configured yet.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    const hasAuthHash =
      hash.includes("access_token") || hash.includes("type=invite") || hash.includes("type=recovery") || hash.includes("type=signup") || hash.includes("error");
    const code = new URLSearchParams(window.location.search).get("code");

    if (hasAuthHash) {
      router.replace(`/login${hash}`);
    } else if (code) {
      router.replace(`/login${window.location.search}`);
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return null;
}
