const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | null) {
  if (!iso) return "—";
  return dateFormatter.format(new Date(iso));
}

export function formatTime(iso: string) {
  return timeFormatter.format(new Date(iso));
}

export function formatMoney(amount: number) {
  return `₪${amount.toLocaleString("he-IL")}`;
}

/** Formats decimal hours as "H:MM", e.g. 2.25 -> "2:15". */
export function formatDuration(hours: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function isSameDay(iso: string, reference: Date) {
  const date = new Date(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

/** Whole days from today until `iso`; negative once the date has passed. */
export function daysUntil(iso: string | null, today = new Date()): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  const startOfTarget = Date.UTC(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((startOfTarget - startOfToday) / 86_400_000);
}
