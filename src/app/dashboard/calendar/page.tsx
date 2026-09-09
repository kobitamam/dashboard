import { createEvent, deleteEvent } from "@/app/dashboard/actions";
import {
  AddRecord,
  DataUnavailable,
  DeleteButton,
  EmptyState,
  Field,
  SelectField,
} from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { loadDashboardData } from "@/lib/db/queries";
import { daysUntil, formatDate, formatTime } from "@/lib/format";
import { eventTypes } from "@/lib/types";

export default async function CalendarPage() {
  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const { events } = result.data;
  const upcoming = events.filter((e) => (daysUntil(e.start) ?? 0) >= 0);

  const form = (
    <AddRecord label="+ פגישה חדשה" action={createEvent}>
      <Field label="נושא" name="title" required placeholder="ביקור בנכס - רחוב, עיר" />
      <Field label="מועד" name="start" type="datetime-local" required />
      <Field label="מיקום" name="location" placeholder="עיר / מקוון / טלפוני" />
      <SelectField label="סוג" name="type" options={eventTypes} defaultValue="פגישת לקוח" />
    </AddRecord>
  );

  return (
    <div>
      <PageHeader
        title="יומן ופגישות"
        subtitle="הפגישות, הביקורים בנכסים ומועדי ההגשה שלך"
        action={events.length > 0 ? form : undefined}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {events.length === 0 ? (
            <EmptyState
              title="היומן ריק"
              hint="הוסף פגישה או ביקור בנכס. פגישות שמתקיימות היום יופיעו אוטומטית בדשבורד ובהתראות."
              action={form}
            />
          ) : (
            <Card className="p-5">
              <h2 className="mb-4 text-lg font-bold">
                פגישות קרובות
                <span className="mr-2 text-sm font-normal text-muted">
                  ({upcoming.length})
                </span>
              </h2>
              <div className="space-y-3">
                {events.map((e) => {
                  const days = daysUntil(e.start);
                  const past = days !== null && days < 0;
                  return (
                    <div
                      key={e.id}
                      className={`flex items-center gap-3 rounded-xl border border-border p-3 ${past ? "opacity-50" : ""}`}
                    >
                      <div className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-cyan-light text-brand-blue">
                        <span className="text-sm font-bold">{formatTime(e.start)}</span>
                        <span className="text-[11px]">{formatDate(e.start)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{e.title}</p>
                        <p className="text-xs text-muted">
                          {e.type}
                          {e.location ? ` · ${e.location}` : ""}
                          {days === 0 ? " · היום" : ""}
                        </p>
                      </div>
                      <DeleteButton
                        action={deleteEvent.bind(null, e.id)}
                        confirmText="למחוק את הפגישה?"
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-bold">סנכרון מייל ויומן</h2>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            לא מחובר
          </span>
          <p className="mt-3 text-sm text-muted">
            סנכרון דו-כיווני עם Google Calendar ו-Gmail, כולל קישור אוטומטי של מיילים לתיקים,
            דורש חיבור OAuth לחשבון Google שלך. הפגישות כאן נשמרות כרגע במסד הנתונים של
            המערכת.
          </p>
        </Card>
      </div>
    </div>
  );
}
