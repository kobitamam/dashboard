"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 lg:block">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-64">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-border p-2 text-brand-blue lg:hidden"
              aria-label="פתח תפריט"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path
                  d="M4 6h16M4 12h16M4 18h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <div className="relative hidden sm:block">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted"
              >
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M20 20l-3.2-3.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="text"
                placeholder="חיפוש לקוח, תיק או חשבונית..."
                className="w-72 rounded-full border border-border bg-background py-2 pr-9 pl-4 text-sm outline-none focus:border-brand-cyan"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative rounded-full border border-border p-2 text-brand-blue"
              aria-label="התראות"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path
                  d="M6 10.5a6 6 0 1 1 12 0c0 3 1 4.5 1.8 5.5H4.2C5 15 6 13.5 6 10.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-cyan-light text-sm font-bold text-brand-blue">
                תא
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-foreground">תמאם אברהם</p>
                <p className="text-xs text-muted">מנהל המשרד</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
