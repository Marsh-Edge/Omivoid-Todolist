"use client";

import { Sidebar } from "./Sidebar";
import { AppHeader } from "./AppHeader";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden p-4">{children}</main>
      </div>
    </div>
  );
}
