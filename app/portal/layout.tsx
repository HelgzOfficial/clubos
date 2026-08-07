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

// The status bar tint above the installed app. This value is only what shows
// before the page's JavaScript runs — ClubColorProvider replaces it with the
// club's own App Background colour on load, so the bar matches whatever the
// club has set in Settings > Appearance rather than a colour fixed at build
// time. Kept in step with the default in lib/sample-data.ts.
export const viewport: Viewport = {
  themeColor: "#0B1428",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
