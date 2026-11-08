"use client";

import { useRouter } from "next/navigation";

const select =
  "rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand-cyan";

/**
 * The attendance page's month and (for a partner) person pickers; choosing one reloads the page
 * with ?month=&person=. The Excel link downloads the same selection.
 */
export default function AttendanceFilters({
  month,
  months,
  person,
  people,
}: {
  month: string;
  months: { value: string; label: string }[];
  person: string;
  people?: { id: string; name: string }[]; // partners only
}) {
  const router = useRouter();
  const query = (next: { month?: string; person?: string }) => {
    const params = new URLSearchParams();
    params.set("month", next.month ?? month);
    const p = next.person ?? person;
    if (p) params.set("person", p);
    return params.toString();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {people && (
        <select
          aria-label="עובד"
          className={select}
          value={person}
          onChange={(e) => router.push(`?${query({ person: e.target.value })}`)}
        >
          <option value="">כל הצוות</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="חודש"
        className={select}
        value={month}
        onChange={(e) => router.push(`?${query({ month: e.target.value })}`)}
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <a
        href={`/api/attendance/export?${query({})}`}
        className="rounded-lg bg-success px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        📊 הורדה לאקסל
      </a>
    </div>
  );
}
