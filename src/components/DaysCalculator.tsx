"use client";

import { useState } from "react";

const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-3 text-base outline-none focus:border-brand-cyan";

const todayInIsrael = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

const dateText = new Intl.DateTimeFormat("he-IL", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** The date `days` calendar days after `start` (before it, if negative). Whole days in UTC, so no daylight-saving drift. */
function addDays(start: string, days: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function DaysCalculator() {
  const [start, setStart] = useState(todayInIsrael);
  const [days, setDays] = useState("");

  const count = Math.trunc(Number(days));
  const result = start && days.trim() !== "" && Number.isFinite(count) ? addDays(start, count) : null;

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
              תאריך התחלה
              <button
                type="button"
                onClick={() => setStart(todayInIsrael())}
                className="font-semibold text-brand-blue hover:underline"
              >
                היום
              </button>
            </span>
            <input
              type="date"
              className={fieldClass}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">מספר ימים</span>
            <input
              type="number"
              inputMode="numeric"
              className={fieldClass}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="לדוגמה: 30"
              autoFocus
            />
          </label>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
        {result ? (
          <>
            <p className="text-xs font-medium text-muted">בתום הספירה</p>
            <p className="mt-2 text-3xl font-extrabold text-foreground">
              יום {dayNames[result.getUTCDay()]}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{dateText.format(result)}</p>
          </>
        ) : (
          <p className="text-sm text-muted">הקלד מספר ימים כדי לראות את התאריך.</p>
        )}
      </div>
    </div>
  );
}
