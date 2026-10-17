import { createHash } from "node:crypto";
import { caseDeadlines } from "@/lib/deadlines";
import {
  connections,
  deadlineMap,
  getCalendarConnection,
  getValidCalendarToken,
} from "@/lib/db/calendar-connection";
import { casesRepo, eventsRepo, toCase } from "@/lib/db/entities";
import { getDb } from "@/lib/mongodb";
import {
  createCalendar,
  createRemoteEvent,
  deleteRemoteEvent,
  listRemoteEvents,
  updateRemoteEvent,
  type OutgoingEvent,
  type RemoteEvent,
} from "@/lib/ms-calendar";

/**
 * Two-way sync between the office calendar and a dedicated "TA-Estate" calendar
 * in Outlook (which the iPhone/Mac calendar can show and edit):
 *  - meetings/hearings are mirrored both ways; an event added, changed or deleted
 *    in Outlook shows up here, and the other way round;
 *  - case deadlines are derived from the cases and only pushed to Outlook (an edit
 *    made to them in Outlook is overwritten on the next change here).
 * `outlookId` links an event to its twin; `syncHash` remembers what both sides
 * looked like at the last sync, so a change can be attributed to the right side.
 */

type SyncResult =
  | { ok: true; changes: number; skipped?: boolean }
  | { ok: false; error: string };

const LOCK_MS = 60_000;
const MIN_INTERVAL_MS = 60_000;
const DEFAULT_EVENT_TYPE = "פגישת לקוח" as const;

const hash = (...parts: string[]) =>
  createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 16);

// An event is stored by its start only; Outlook needs an end, so it gets an hour.
const localString = (date: Date) => date.toISOString().slice(0, 19);
const plusHour = (date: Date) => localString(new Date(date.getTime() + 60 * 60_000));

function remoteStart(remote: RemoteEvent): Date {
  // An all-day event added in Outlook becomes a 09:00 entry here.
  return new Date(`${remote.isAllDay ? `${remote.start.slice(0, 10)}T09:00:00` : remote.start}Z`);
}

function plusDay(day: string) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function syncCalendar(
  ownerId: string,
  options: { force?: boolean } = {},
): Promise<SyncResult> {
  const conn = await getCalendarConnection(ownerId);
  if (!conn) return { ok: false, error: "היומן לא מחובר" };
  if (!options.force && conn.lastSyncAt && Date.now() - conn.lastSyncAt.getTime() < MIN_INTERVAL_MS) {
    return { ok: true, changes: 0, skipped: true };
  }

  // One sync at a time per office, so two page loads can't both create the same events.
  const col = await connections();
  const claimed = await col.findOneAndUpdate(
    { _id: ownerId, $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: new Date() } }] },
    { $set: { lockedUntil: new Date(Date.now() + LOCK_MS) } },
  );
  if (!claimed) return { ok: true, changes: 0, skipped: true };

  try {
    const token = await getValidCalendarToken(conn);
    if (!token) throw new Error("החיבור ל-Outlook פג - יש לחבר את היומן מחדש");

    const changes = await runSync(ownerId, token, conn.calendarId);
    await col.updateOne({ _id: ownerId }, { $set: { lastSyncAt: new Date(), lastError: null } });
    return { ok: true, changes };
  } catch (err) {
    console.error("Calendar sync failed:", err);
    const error = err instanceof Error ? err.message : "הסנכרון נכשל";
    await col.updateOne({ _id: ownerId }, { $set: { lastError: error } });
    return { ok: false, error };
  } finally {
    await col.updateOne({ _id: ownerId }, { $unset: { lockedUntil: "" } });
  }
}

async function runSync(ownerId: string, token: string, knownCalendarId?: string) {
  const map = await deadlineMap();
  const db = await getDb();
  let changes = 0;

  let calendarId = knownCalendarId;
  if (!calendarId) {
    // A brand-new calendar: nothing is mirrored in it yet, so forget any old links.
    calendarId = await createCalendar(token);
    await (await connections()).updateOne({ _id: ownerId }, { $set: { calendarId } });
    await map.deleteMany({ ownerId });
    await db.collection("events").updateMany({ ownerId }, { $unset: { outlookId: "", syncHash: "" } });
  }

  const [remoteList, localEvents, caseDocs, mapDocs] = await Promise.all([
    listRemoteEvents(token, calendarId),
    eventsRepo.list(ownerId),
    casesRepo.list(ownerId),
    map.find({ ownerId }).toArray(),
  ]);
  const remoteById = new Map(remoteList.map((r) => [r.id, r]));
  const cases = caseDocs.map(toCase);
  const caseLabel = new Map(cases.map((c) => [c.id, `תיק ${c.caseNumber} · ${c.clientName}`]));
  const claimedRemote = new Set<string>(mapDocs.map((m) => m.outlookId));

  // If every mirrored event vanished at once, the calendar was most likely deleted
  // in Outlook - don't wipe the events here because of that.
  const mirrored = localEvents.filter((e) => e.outlookId);
  if (mirrored.length >= 3 && mirrored.every((e) => !remoteById.has(e.outlookId!))) {
    throw new Error("כל האירועים נעלמו מיומן Outlook - ייתכן שהיומן נמחק. נתק וחבר מחדש");
  }

  // ---- meetings and hearings ----
  for (const doc of localEvents) {
    const id = doc._id.toString();
    const detail = doc.caseId ? caseLabel.get(doc.caseId) : undefined;
    const localHash = hash(doc.title, localString(doc.start), doc.location ?? "");
    const outgoing: OutgoingEvent = {
      subject: doc.title,
      location: doc.location ?? "",
      body: [doc.type, detail].filter(Boolean).join(" · "),
      start: localString(doc.start),
      end: plusHour(doc.start),
    };

    if (!doc.outlookId) {
      const outlookId = await createRemoteEvent(token, calendarId, outgoing);
      await eventsRepo.update(ownerId, id, { outlookId, syncHash: localHash });
      claimedRemote.add(outlookId);
      changes++;
      continue;
    }

    claimedRemote.add(doc.outlookId);
    const remote = remoteById.get(doc.outlookId);
    if (!remote) {
      // Deleted in Outlook.
      await eventsRepo.remove(ownerId, id);
      changes++;
      continue;
    }

    const start = remoteStart(remote);
    const remoteHash = hash(remote.subject, localString(start), remote.location);
    if (remoteHash !== doc.syncHash) {
      // Changed in Outlook since the last sync: Outlook's version wins.
      await eventsRepo.update(ownerId, id, {
        title: remote.subject || doc.title,
        start,
        location: remote.location,
        syncHash: remoteHash,
      });
      changes++;
    } else if (localHash !== doc.syncHash) {
      await updateRemoteEvent(token, doc.outlookId, outgoing);
      await eventsRepo.update(ownerId, id, { syncHash: localHash });
      changes++;
    }
  }

  // Events that exist only in Outlook were added there (e.g. from the iPhone).
  for (const remote of remoteList) {
    if (claimedRemote.has(remote.id)) continue;
    const start = remoteStart(remote);
    await eventsRepo.insert(ownerId, {
      title: remote.subject || "ללא כותרת",
      start,
      location: remote.location,
      type: DEFAULT_EVENT_TYPE,
      outlookId: remote.id,
      syncHash: hash(remote.subject, localString(start), remote.location),
    });
    changes++;
  }

  // ---- case deadlines (system -> Outlook only) ----
  const wanted = new Map<string, { event: OutgoingEvent; hash: string }>();
  for (const c of cases) {
    if (c.status === "הושלם") continue;
    for (const d of caseDeadlines(c)) {
      const event: OutgoingEvent = {
        subject: `דדליין: ${d.label}`,
        body: `תיק ${c.caseNumber} · ${c.clientName}`,
        start: d.date,
        end: plusDay(d.date),
        allDay: true,
      };
      wanted.set(`${c.id}-${d.key}`, { event, hash: hash(event.subject, d.date, event.body ?? "") });
    }
  }

  const mapped = new Map(mapDocs.map((m) => [m.key, m]));
  for (const [key, { event, hash: wantedHash }] of wanted) {
    const existing = mapped.get(key);
    if (!existing || !remoteById.has(existing.outlookId)) {
      const outlookId = await createRemoteEvent(token, calendarId, event);
      await map.updateOne(
        { _id: `${ownerId}:${key}` },
        { $set: { ownerId, key, outlookId, hash: wantedHash } },
        { upsert: true },
      );
      changes++;
    } else if (existing.hash !== wantedHash) {
      await updateRemoteEvent(token, existing.outlookId, event);
      await map.updateOne({ _id: existing._id }, { $set: { hash: wantedHash } });
      changes++;
    }
  }
  for (const [key, existing] of mapped) {
    if (wanted.has(key)) continue;
    // The case was completed or deleted, or the date was cleared.
    await deleteRemoteEvent(token, existing.outlookId);
    await map.deleteOne({ _id: existing._id });
    changes++;
  }

  return changes;
}

/**
 * Removes an event's twin from Outlook right before the event is deleted here;
 * otherwise the next sync would read the twin as new and bring the event back.
 * Best-effort: the event is deleted here either way.
 */
export async function deleteOutlookTwin(ownerId: string, eventId: string) {
  try {
    const conn = await getCalendarConnection(ownerId);
    if (!conn) return;
    const doc = await eventsRepo.get(ownerId, eventId);
    if (!doc?.outlookId) return;
    const token = await getValidCalendarToken(conn);
    if (token) await deleteRemoteEvent(token, doc.outlookId);
  } catch (err) {
    console.error("Failed to delete the Outlook copy of an event:", err);
  }
}
