"use client";

import { useMemo, useState } from "react";
import {
  addCalendar,
  countDays,
  moveDays,
  toDate,
  toDay,
  weekdayNames,
  type Exclusions,
} from "@/lib/days-calculator";

type Mode = "add" | "subtract" | "count";

const tabs: { mode: Mode; label: string }[] = [
  { mode: "add", label: "הוסף ימים" },
  { mode: "subtract", label: "החסר ימים" },
  { mode: "count", label: "ספירת ימים" },
];

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan";

const todayInIsrael = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

const dateText = new Intl.DateTimeFormat("he-IL", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const hebrewText = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const toNumber = (value: string) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        className={fieldClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function DaysCalculator() {
  const [mode, setMode] = useState<Mode>("add");
  const [start, setStart] = useState(todayInIsrael);
  const [end, setEnd] = useState(todayInIsrael);
  const [years, setYears] = useState("0");
  const [months, setMonths] = useState("0");
  const [weeks, setWeeks] = useState("0");
  const [days, setDays] = useState("0");
  const [weekdays, setWeekdays] = useState<boolean[]>(Array(7).fill(false));
  const [holidays, setHolidays] = useState(false);
  const [includeStart, setIncludeStart] = useState(false);

  const exclusions: Exclusions = { weekdays, holidays };

  const result = useMemo(() => {
    if (!start || Number.isNaN(toDate(start).getTime())) return null;
    const from = toDate(start);

    if (mode === "count") {
      if (!end || Number.isNaN(toDate(end).getTime())) return null;
      const counted = countDays(from, toDate(end), exclusions, includeStart);
      return { kind: "count" as const, ...counted };
    }

    const sign = mode === "add" ? 1 : -1;
    const shifted = addCalendar(from, sign * toNumber(years), sign * toNumber(months));
    const total = toNumber(weeks) * 7 + toNumber(days);
    const moved = moveDays(shifted, sign * total, exclusions);
    return { kind: "date" as const, date: moved.date, skipped: moved.skipped };
    // exclusions is rebuilt every render from weekdays/holidays, which are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, start, end, years, months, weeks, days, weekdays, holidays, includeStart]);

  const allExcluded = weekdays.every(Boolean);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => setMode(tab.mode)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mode === tab.mode ? "bg-brand-blue text-white" : "text-muted hover:bg-background"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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
            <input type="date" className={fieldClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </label>

          {mode === "count" && (
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted">
                תאריך סיום
                <button
                  type="button"
                  onClick={() => setEnd(todayInIsrael())}
                  className="font-semibold text-brand-blue hover:underline"
                >
                  היום
                </button>
              </span>
              <input type="date" className={fieldClass} value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          )}
        </div>

        {mode !== "count" && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberField label="שנים" value={years} onChange={setYears} />
            <NumberField label="חודשים" value={months} onChange={setMonths} />
            <NumberField label="שבועות" value={weeks} onChange={setWeeks} />
            <NumberField label="ימים" value={days} onChange={setDays} />
          </div>
        )}

        <fieldset className="mt-5 rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-semibold text-foreground">אל תכלול ימים</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {weekdayNames.map((name, index) => (
              <label key={name} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--brand-blue)]"
                  checked={weekdays[index]}
                  onChange={(e) =>
                    setWeekdays((current) => current.map((value, i) => (i === index ? e.target.checked : value)))
                  }
                />
                {index === 6 ? "שבת" : `יום ${name}`}
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--brand-blue)]"
              checked={holidays}
              onChange={(e) => setHolidays(e.target.checked)}
            />
            אל תכלול חגים ציבוריים
          </label>
          <p className="mt-1 text-xs text-muted">
            ראש השנה, יום כיפור, סוכות, שמיני עצרת, פסח (יום ראשון ואחרון), שבועות ויום העצמאות.
          </p>
        </fieldset>

        {mode === "count" && (
          <label className="mt-4 flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--brand-blue)]"
              checked={includeStart}
              onChange={(e) => setIncludeStart(e.target.checked)}
            />
            כלול גם את יום ההתחלה בספירה
          </label>
        )}
        {mode !== "count" && (
          <p className="mt-4 text-xs text-muted">
            שנים וחודשים נספרים לפי לוח השנה. שבועות וימים נספרים בלי הימים שסימנת לדלג עליהם.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-border bg-surface p-5 text-center shadow-sm">
        {allExcluded ? (
          <p className="text-sm text-danger">סימנת לדלג על כל ימי השבוע, אי אפשר לחשב.</p>
        ) : !result ? (
          <p className="text-sm text-muted">בחר תאריך התחלה.</p>
        ) : result.kind === "date" ? (
          <>
            <p className="text-xs font-medium text-muted">התאריך המתקבל</p>
            <p className="mt-1 text-2xl font-extrabold text-foreground">
              יום {weekdayNames[result.date.getUTCDay()]}, {dateText.format(result.date)}
            </p>
            <p className="mt-1 text-sm text-muted">{hebrewText.format(result.date)}</p>
            <p className="mt-1 text-xs text-muted" dir="ltr">
              {toDay(result.date)}
            </p>
            {result.skipped > 0 && (
              <p className="mt-3 text-xs text-muted">דולגו {result.skipped} ימים שסימנת לא לכלול.</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-medium text-muted">
              {result.forward ? "מספר הימים" : "מספר הימים (התאריך מוקדם מההתחלה)"}
            </p>
            <p className="mt-1 text-4xl font-extrabold text-foreground">{result.counted}</p>
            {result.counted >= 7 && (
              <p className="mt-1 text-sm text-muted">
                {Math.floor(result.counted / 7)} שבועות
                {result.counted % 7 ? ` ו-${result.counted % 7} ימים` : ""}
              </p>
            )}
            {result.skipped > 0 && (
              <p className="mt-3 text-xs text-muted">לא נספרו {result.skipped} ימים שסימנת לא לכלול.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
