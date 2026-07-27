import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth";
import { AuthGate } from "@/components/auth-gate";
import { PermissionsProvider } from "@/lib/permissions";
import { ModuleGate } from "@/components/module-gate";
import { ClubColorProvider } from "@/components/club-color-provider";

export const metadata: Metadata = {
  title: "ClubOS",
  description: "The operating system for your football club.",
  appleWebApp: {
    // Lets someone add ClubOS to their iPhone/iPad home screen and have it
    // open full-screen like a native app instead of inside Safari's chrome.
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ClubOS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Deliberately not capped below 5 and userScalable isn't disabled — some
  // users rely on pinch-zoom for accessibility, so this only fixes layout
  // width/scale to device size without taking that away from them.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#141F3D" },
    { media: "(prefers-color-scheme: dark)", color: "#060B1A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <ClubColorProvider>
            <AuthProvider>
              <AuthGate>
                <PermissionsProvider>
                  <ModuleGate>{children}</ModuleGate>
                </PermissionsProvider>
              </AuthGate>
            </AuthProvider>
          </ClubColorProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
