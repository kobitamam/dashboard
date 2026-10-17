"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { matchesQuery, type SearchEntry } from "@/lib/search";

const MAX_RESULTS = 8;

/** The search box in the top bar: finds cases and clients and jumps to them. */
export default function HeaderSearch({ index }: { index: SearchEntry[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const results = useMemo(
    () => (query.trim() ? index.filter((e) => matchesQuery(e.haystack, query)).slice(0, MAX_RESULTS) : []),
    [index, query],
  );

  // Close the list when clicking anywhere else.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(entry: SearchEntry) {
    setOpen(false);
    setQuery("");
    router.push(entry.href);
  }

  return (
    <div ref={box} className="relative w-full min-w-0 sm:w-72">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted"
      >
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && results[0]) go(results[0]);
        }}
        placeholder="חיפוש לקוח או תיק..."
        aria-label="חיפוש לקוח או תיק"
        className="w-full rounded-full border border-border bg-background py-2 pr-9 pl-4 text-sm outline-none focus:border-brand-cyan"
      />

      {open && query.trim() && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-96 min-w-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">לא נמצאו תוצאות</p>
          ) : (
            results.map((entry) => (
              <button
                key={`${entry.kind}-${entry.id}`}
                type="button"
                onClick={() => go(entry)}
                className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-right hover:bg-background"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    entry.kind === "case"
                      ? "bg-brand-cyan-light text-brand-blue"
                      : "bg-success/10 text-success"
                  }`}
                >
                  {entry.kind === "case" ? "תיק" : "לקוח"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{entry.title}</span>
                  {entry.subtitle && (
                    <span className="block truncate text-xs text-muted">{entry.subtitle}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
