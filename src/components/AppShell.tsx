"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import HeaderSearch from "@/components/HeaderSearch";
import Sidebar from "@/components/Sidebar";
import type { SearchEntry } from "@/lib/search";

export default function AppShell({
  children,
  userName,
  alertCount,
  isPartner,
  searchIndex,
}: {
  children: React.ReactNode;
  userName: string;
  alertCount: number;
  isPartner: boolean;
  searchIndex: SearchEntry[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = userName.slice(0, 2);

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 lg:block">
        <Sidebar userName={userName} alertCount={alertCount} isPartner={isPartner} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-64">
            <Sidebar
              userName={userName}
              alertCount={alertCount}
              isPartner={isPartner}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-h-full min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
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
            <HeaderSearch index={searchIndex} />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link
              href="/dashboard/alerts"
              className="relative rounded-full border border-border p-2 text-brand-blue hover:bg-background"
              aria-label={alertCount > 0 ? `התראות (${alertCount})` : "התראות"}
              title={alertCount > 0 ? `${alertCount} התראות פתוחות` : "אין התראות פתוחות"}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path
                  d="M6 10.5a6 6 0 1 1 12 0c0 3 1 4.5 1.8 5.5H4.2C5 15 6 13.5 6 10.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              {alertCount > 0 && (
                <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-danger" />
              )}
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-cyan-light text-sm font-bold text-brand-blue">
                {initials}
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-foreground">{userName}</p>
                <p className="text-xs text-muted">{isPartner ? "מנהל המשרד" : "עובד"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground/70 hover:bg-background"
            >
              התנתקות
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
