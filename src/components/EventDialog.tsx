"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createEvent, deleteEvent, updateEvent } from "@/app/dashboard/actions";
import { SelectWithNewField } from "@/components/form";
import type { EventVisibility } from "@/lib/types";

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-brand-cyan";

/** What the event form starts from: a new event (from the button or a slot marked on the calendar) or a saved one. */
export type EventDraft = {
  title: string;
  date: string; // YYYY-MM-DD
  allDay: boolean;
  startTime: string; // HH:MM
  endTime: string; // HH:MM, "" for none
  location: string;
  type: string;
  caseId: string;
  visibility: EventVisibility | ""; // "" = not chosen yet (a partner must choose)
};

export type EventFormOptions = {
  eventTypes: string[];
  cases: { id: string; label: string }[];
  isPartner: boolean;
};

export const newEventDraft = (date: string, startTime = "09:00", endTime = "10:00", allDay = false): EventDraft => ({
  title: "",
  date,
  allDay,
  startTime,
  endTime,
  location: "",
  type: "פגישת לקוח",
  caseId: "",
  visibility: "",
});

/** The event form over the page: adds an event, or (with eventId) changes or deletes a saved one. */
export default function EventDialog({
  draft,
  eventId,
  options,
  onClose,
}: {
  draft: EventDraft;
  eventId?: string;
  options: EventFormOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const [allDay, setAllDay] = useState(draft.allDay);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const types = options.eventTypes.includes(draft.type) ? options.eventTypes : [draft.type, ...options.eventTypes];

  async function run(task: () => Promise<{ ok: true } | { ok: false; error: string } | void>) {
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      if (result && !result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("השמירה נכשלה, נסה שוב");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form
        // Submitted by hand, so a refused save keeps what was typed (React clears a form after its action).
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          void run(() => (eventId ? updateEvent(eventId, form) : createEvent(form)));
        }}
        className="mt-10 w-full max-w-2xl rounded-2xl border border-border bg-surface p-5 text-right shadow-lg"
      >
        <h2 className="mb-4 text-lg font-bold">{eventId ? "עריכת פגישה" : "פגישה חדשה"}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted">נושא</span>
            <input
              className={fieldClass}
              name="title"
              required
              autoFocus
              defaultValue={draft.title}
              placeholder="ביקור בנכס - רחוב, עיר"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">תאריך</span>
            <input className={fieldClass} name="date" type="date" required defaultValue={draft.date} />
          </label>
          <div>
            {!allDay && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted">משעה</span>
                  <input className={fieldClass} name="startTime" type="time" step={300} required defaultValue={draft.startTime} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-muted">עד שעה</span>
                  <input className={fieldClass} name="endTime" type="time" step={300} defaultValue={draft.endTime} />
                </label>
              </div>
            )}
            <label className={`flex items-center gap-2 text-sm text-foreground ${allDay ? "mt-7" : "mt-2"}`}>
              <input
                type="checkbox"
                name="allDay"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="h-4 w-4 accent-[var(--brand-blue)]"
              />
              יום שלם
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted">מיקום</span>
            <input className={fieldClass} name="location" defaultValue={draft.location} placeholder="עיר / מקוון / טלפוני" />
          </label>
          <SelectWithNewField
            label="סוג"
            name="type"
            newName="newType"
            options={types}
            defaultValue={draft.type}
            newOptionLabel="➕ סוג חדש..."
            newPlaceholder="שם סוג האירוע החדש"
          />

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-muted">תיק קשור (אופציונלי)</span>
            <select name="caseId" defaultValue={draft.caseId} className={fieldClass}>
              <option value="">ללא תיק</option>
              {options.cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          {options.isPartner && (
            // A new event asks every time, with no answer chosen in advance.
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-xs font-medium text-muted">עם מי לשתף את האירוע?</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {(
                  [
                    ["private", "רק אני"],
                    ["partners", "השותפים בלבד"],
                    ["all", "כולם"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="visibility"
                      value={value}
                      required
                      defaultChecked={draft.visibility === value}
                      className="accent-[var(--brand-blue)]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "שומר..." : "שמירה"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground/70 hover:bg-background"
          >
            ביטול
          </button>
          {eventId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => confirm("למחוק את הפגישה?") && void run(() => deleteEvent(eventId))}
              className="mr-auto rounded-xl px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10"
            >
              מחיקה
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

/** "+ פגישה חדשה" in the page header: the same form, for today at 9:00. */
export function NewEventButton({ today, options }: { today: string; options: EventFormOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
      >
        + פגישה חדשה
      </button>
      {open && <EventDialog draft={newEventDraft(today)} options={options} onClose={() => setOpen(false)} />}
    </>
  );
}
