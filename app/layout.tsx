import type { Metadata } from "next";
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
