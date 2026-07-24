import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-navy-800 dark:bg-navy-950 text-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
