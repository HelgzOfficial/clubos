import type { Metadata, Viewport } from "next";

// Overrides the root metadata for everything under /portal — this is the
// condensed player companion app, so "Add to Home Screen" from in here should
// install its own icon, under its own name, opening straight back to /portal
// rather than the full staff-facing ClubOS at "/".
//
// The icon and title matter more than they look. Without them iOS reuses the
// staff app's badge and calls it "ClubOS", so a coach with both installed ends
// up with two identical icons and no way to tell them apart.
export const metadata: Metadata = {
  title: "Player Portal",
  manifest: "/manifest-portal.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Portal",
  },
  icons: {
    icon: [
      { url: "/icon-portal-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-portal-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon-portal.png", sizes: "180x180", type: "image/png" }],
  },
};

// Amber rather than the staff app's navy, so even the status bar tint says
// "this is the players' app".
export const viewport: Viewport = {
  themeColor: "#f59e0b",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
