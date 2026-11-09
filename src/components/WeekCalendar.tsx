"use client";

import { useRef, useState } from "react";
import { deleteEvent } from "@/app/dashboard/actions";
import EventDialog, { newEventDraft, type EventDraft, type EventFormOptions } from "@/components/EventDialog";
import { DeleteButton } from "@/components/form";
import type { CalendarItem } from "@/lib/calendar";
import { dayNames } from "@/lib/calendar";
import { MEDIATOR_REQUEST_DEADLINE, type CalendarEvent } from "@/lib/types";

const HOUR_PX = 56;
const MIN_EVENT_MINUTES = 30;

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const clock = (mins: number) => {
  const m = Math.min(Math.max(mins, 0), 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const SNAP = 15; // a marked slot snaps to quarter hours

// A saved event as the form's starting point.
function draftOf(e: CalendarEvent): EventDraft {
  return {
    title: e.title,
    date: e.start.slice(0, 10),
    allDay: e.allDay,
    startTime: e.allDay ? "09:00" : e.start.slice(11, 16),
    endTime: e.allDay ? "" : e.end ? e.end.slice(11, 16) : "",
    location: e.location,
    type: e.type,
    caseId: e.caseId ?? "",
    visibility: e.visibility,
  };
}

// Clicks on an event's ✕ must neither open the event nor start marking a slot.
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

// One colour per kind of event, like the colour-coded calendars in Apple Calendar.
const kindStyles: Record<string, string> = {
  דיון: "bg-warning/15 text-warning border-warning/40",
  "פגישת לקוח": "bg-brand-blue/10 text-brand-blue border-brand-blue/30",
  "ביקור בנכס": "bg-success/15 text-success border-success/40",
  "הגשת שומה": "bg-danger/10 text-danger border-danger/30",
  "שיחת טלפון": "bg-brand-cyan-light text-brand-blue border-brand-cyan/40",
  דדליין: "bg-warning/15 text-warning border-warning/40",
};
kindStyles[MEDIATOR_REQUEST_DEADLINE] = kindStyles["דדליין"];

// A type the office added gets a stable colour of its own, picked from its name.
const customStyles = [
  "bg-brand-cyan-light text-brand-blue border-brand-cyan/40",
  "bg-success/15 text-success border-success/40",
  "bg-danger/10 text-danger border-danger/30",
  "bg-warning/15 text-warning border-warning/40",
  "bg-brand-blue/10 text-brand-blue border-brand-blue/30",
];
const styleFor = (kind: string) => {
  if (kindStyles[kind]) return kindStyles[kind];
  let hash = 0;
  for (const ch of kind) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return customStyles[hash % customStyles.length];
};

// An event a partner added takes their colour (it wins over its type's colour).
const partnerStyles = {
  yellow: "bg-yellow-100 text-yellow-900 border-yellow-300",
  pink: "bg-pink-100 text-pink-900 border-pink-300",
} as const;
const itemStyle = (item: CalendarItem) => (item.color ? partnerStyles[item.color] : styleFor(item.kind));
// Shown before the title of an event not shared with everyone.
const visibilityMark = (item: CalendarItem) =>
  item.visibility === "private" ? "🔒 " : item.visibility === "partners" ? "👥 " : "";

type Placed = { item: CalendarItem; start: number; end: number; lane: number; lanes: number };

/** Side-by-side lanes for events that overlap in time within one day. */
function place(items: CalendarItem[]): Placed[] {
  const timed = items
    .filter((i) => i.time)
    .map((item) => {
      const start = minutes(item.time!);
      let end = item.endTime ? minutes(item.endTime) : start + 60;
      if (end <= start) end = 24 * 60; // runs past midnight
      return { item, start, end: Math.max(end, start + MIN_EVENT_MINUTES), lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const closeCluster = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    for (const p of cluster) p.lanes = lanes;
    cluster = [];
  };
  for (const p of timed) {
    if (cluster.length && p.start >= clusterEnd) closeCluster();
    const taken = new Set(cluster.filter((c) => c.end > p.start).map((c) => c.lane));
    while (taken.has(p.lane)) p.lane++;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.end);
  }
  closeCluster();
  return timed;
}

/**
 * The week as a time grid. Dragging over a day's hours marks a slot and opens the new-event form with
 * its day and times (a click or a tap gives an hour); a click on an empty all-day cell opens a whole-day
 * event; a click on a meeting opens it for editing.
 */
export default function WeekCalendar({
  days,
  today,
  nowMinutes,
  items,
  events,
  options,
}: {
  days: string[];
  today: string;
  nowMinutes: number;
  items: CalendarItem[];
  events: CalendarEvent[];
  options: EventFormOptions;
}) {
  const [dialog, setDialog] = useState<{ draft: EventDraft; eventId?: string } | null>(null);
  const [marking, setMarking] = useState<{ day: string; anchor: number; from: number; to: number } | null>(null);
  const dragged = useRef(false); // a mouse drag just opened the form: ignore the click that follows
  const eventById = new Map(events.map((e) => [e.id, e]));
  const openEvent = (eventId?: string) => {
    const event = eventId ? eventById.get(eventId) : undefined;
    if (event) setDialog({ draft: draftOf(event), eventId: event.id });
  };

  const byDay = new Map(days.map((d) => [d, items.filter((i) => i.day === d)]));
  const placed = new Map(days.map((d) => [d, place(byDay.get(d) ?? [])]));

  // 7:00-20:00 by default, stretched to fit any event outside that.
  const all = [...placed.values()].flat();
  const firstHour = Math.min(7, ...all.map((p) => Math.floor(p.start / 60)));
  const lastHour = Math.max(20, ...all.map((p) => Math.ceil(p.end / 60)));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const bodyHeight = (lastHour - firstHour) * HOUR_PX;
  const columns = { gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` };
  const top = (mins: number) => ((mins - firstHour * 60) / 60) * HOUR_PX;
  // The minute (snapped down to a quarter) under the pointer in a day column.
  const minuteAt = (e: React.PointerEvent | React.MouseEvent, column: HTMLElement) => {
    const y = e.clientY - column.getBoundingClientRect().top;
    const mins = firstHour * 60 + (y / HOUR_PX) * 60;
    const clamped = Math.min(Math.max(mins, firstHour * 60), lastHour * 60 - SNAP);
    return Math.floor(clamped / SNAP) * SNAP;
  };
  const openSlot = (day: string, from: number, to: number) =>
    setDialog({ draft: newEventDraft(day, clock(from), clock(Math.min(to, lastHour * 60))) });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Day headers */}
        <div className="grid border-b border-border" style={columns}>
          <div />
          {days.map((day) => {
            const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
            const isToday = day === today;
            return (
              <div key={day} className="px-2 py-2 text-center">
                <span className={`text-xs ${isToday ? "font-bold text-danger" : "text-muted"}`}>
                  יום {dayNames[weekday]}
                </span>
                <span
                  className={`mr-1.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-semibold ${
                    isToday ? "bg-danger text-white" : "text-foreground"
                  }`}
                >
                  {Number(day.slice(8, 10))}
                </span>
              </div>
            );
          })}
        </div>

        {/* All-day row: case deadlines */}
        <div className="grid border-b border-border" style={columns}>
          <div className="px-1 py-1.5 text-center text-[10px] leading-tight text-muted">יום שלם</div>
          {days.map((day) => (
            <div
              key={day}
              className="min-h-8 cursor-pointer space-y-1 border-r border-border p-1 hover:bg-brand-cyan-light/40"
              title="לחץ להוספת אירוע של יום שלם"
              onClick={() => setDialog({ draft: newEventDraft(day, "09:00", "10:00", true) })}
            >
              {(byDay.get(day) ?? [])
                .filter((i) => !i.time)
                .map((i) => (
                  <div
                    key={i.id}
                    title={`${i.title} · ${i.detail}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEvent(i.eventId);
                    }}
                    className={`rounded-md border px-1.5 py-1 text-[11px] leading-snug ${i.eventId ? "cursor-pointer" : "cursor-default"} ${itemStyle(i)}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="font-semibold">
                        {visibilityMark(i)}
                        {i.title}
                      </p>
                      {i.eventId && (
                        <div className="-mt-1 -ml-1.5 shrink-0" onClick={stop}>
                          <DeleteButton
                            action={deleteEvent.bind(null, i.eventId)}
                            confirmText="למחוק את האירוע?"
                            label="✕"
                          />
                        </div>
                      )}
                    </div>
                    {i.detail && <p className="opacity-80">{i.detail}</p>}
                  </div>
                ))}
            </div>
          ))}
        </div>

        {/* Hours */}
        <div className="grid pt-3" style={columns}>
          <div className="relative" style={{ height: bodyHeight }}>
            {hours.slice(0, -1).map((h) => (
              <span
                key={h}
                className="absolute inset-x-0 -translate-y-1/2 text-center text-[11px] text-muted"
                style={{ top: (h - firstHour) * HOUR_PX }}
              >
                {h}:00
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day}
              className="relative cursor-cell touch-pan-y select-none border-r border-border"
              // Mouse: press, drag over the hours, release. Touch: a tap marks an hour (dragging scrolls).
              onPointerDown={(e) => {
                dragged.current = false;
                if (e.pointerType !== "mouse" || e.button !== 0) return;
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                const at = minuteAt(e, e.currentTarget);
                setMarking({ day, anchor: at, from: at, to: at + SNAP });
              }}
              onPointerMove={(e) => {
                if (!marking || marking.day !== day) return;
                const at = minuteAt(e, e.currentTarget);
                setMarking({
                  ...marking,
                  from: Math.min(marking.anchor, at),
                  to: Math.max(marking.anchor, at) + SNAP,
                });
              }}
              onPointerUp={() => {
                if (!marking || marking.day !== day) return;
                const { from, to } = marking;
                setMarking(null);
                dragged.current = true;
                // A plain click (one quarter) gives an hour.
                openSlot(day, from, to - from <= SNAP ? from + 60 : to);
              }}
              onPointerCancel={() => setMarking(null)}
              onClick={(e) => {
                if (dragged.current) {
                  dragged.current = false;
                  return;
                }
                const at = minuteAt(e, e.currentTarget);
                openSlot(day, at, at + 60);
              }}
              style={{
                height: bodyHeight,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, var(--border) ${HOUR_PX - 1}px, var(--border) ${HOUR_PX}px)`,
              }}
            >
              {day === today && nowMinutes >= firstHour * 60 && nowMinutes <= lastHour * 60 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 h-px bg-danger"
                  style={{ top: top(nowMinutes) }}
                >
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger" />
                </div>
              )}

              {marking?.day === day && (
                <div
                  className="pointer-events-none absolute inset-x-0.5 z-20 rounded-md border-2 border-brand-blue bg-brand-blue/15 px-1.5 py-0.5 text-[11px] font-semibold text-brand-blue"
                  style={{ top: top(marking.from), height: top(marking.to) - top(marking.from) }}
                >
                  {clock(marking.from)}–{clock(marking.to)}
                </div>
              )}

              {(placed.get(day) ?? []).map(({ item, start, end, lane, lanes }) => (
                <div
                  key={item.id}
                  title={`${item.time}  ${item.title}${item.detail ? ` · ${item.detail}` : ""}${item.eventId ? "\nלחץ לעריכה" : ""}`}
                  onPointerDown={stop}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEvent(item.eventId);
                  }}
                  className={`absolute cursor-pointer overflow-hidden rounded-md border px-1.5 py-1 text-[11px] leading-snug ${itemStyle(item)}`}
                  style={{
                    top: top(start) + 1,
                    height: Math.max(top(end) - top(start) - 2, 20),
                    width: `calc(${100 / lanes}% - 3px)`,
                    right: `calc(${(100 / lanes) * lane}% + 1px)`,
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-semibold">
                      {visibilityMark(item)}
                      {item.title}
                    </p>
                    {item.eventId && (
                      <div className="-mt-1 -ml-1.5 shrink-0" onClick={stop}>
                        <DeleteButton
                          action={deleteEvent.bind(null, item.eventId)}
                          confirmText="למחוק את הפגישה?"
                          label="✕"
                        />
                      </div>
                    )}
                  </div>
                  <p className="opacity-80">
                    {item.time}
                    {item.endTime ? `–${item.endTime}` : ""}
                  </p>
                  {item.detail && <p className="opacity-80">{item.detail}</p>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {dialog && (
        <EventDialog
          key={dialog.eventId ?? `${dialog.draft.date}-${dialog.draft.startTime}-${dialog.draft.allDay}`}
          draft={dialog.draft}
          eventId={dialog.eventId}
          options={options}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
