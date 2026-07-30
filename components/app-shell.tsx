import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  // `h-dvh` (dynamic viewport height) instead of `h-screen` (static 100vh) —
  // on Android Chrome/tablets, 100vh is measured with the browser's address
  // bar collapsed, so once it's showing the layout is taller than what's
  // actually visible. With `overflow-hidden` on this wrapper, that pushed
  // bottom-anchored touch targets (nav drawer items, sticky bars) below the
  // real viewport edge, making them unreachable/unresponsive even though
  // they were "there" in the DOM. `h-dvh` tracks the real visible height.
  return (
    <div className="flex h-dvh w-full bg-navy-800 dark:bg-navy-950 text-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
