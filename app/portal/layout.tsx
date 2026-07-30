import type { Metadata } from "next";

// Overrides the root manifest for everything under /portal — this is the
// condensed player companion app, so "Add to Home Screen" from in here
// should install its own icon that opens straight back to /portal, not the
// full staff-facing ClubOS at "/".
export const metadata: Metadata = {
  title: "ClubOS Companion",
  manifest: "/manifest-portal.json",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
