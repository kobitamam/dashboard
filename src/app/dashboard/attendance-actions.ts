"use server";

import { revalidatePath } from "next/cache";
import { attendanceRepo } from "@/lib/db/entities";
import { currentRole, currentUserId, currentUserName, requireOwnerId } from "@/lib/db/queries";
import { fromIsraelParts } from "@/lib/format";

function refresh() {
  revalidatePath("/dashboard/attendance");
}

export async function clockIn() {
  const ownerId = await requireOwnerId();
  const userId = await currentUserId();

  const entries = await attendanceRepo.list(ownerId);
  const alreadyOpen = entries.some((e) => e.userId === userId && !e.clockOut);
  if (alreadyOpen) return;

  const userName = await currentUserName();
  await attendanceRepo.insert(ownerId, {
    userId,
    userName,
    clockIn: new Date(),
    clockOut: null,
  });
  refresh();
}

export async function clockOut() {
  const ownerId = await requireOwnerId();
  const userId = await currentUserId();

  const entries = await attendanceRepo.list(ownerId);
  const open = entries.find((e) => e.userId === userId && !e.clockOut);
  if (!open?._id) return;

  await attendanceRepo.update(ownerId, open._id.toString(), { clockOut: new Date() });
  refresh();
}

/** A partner can correct anyone's entry; an employee only their own. */
export async function removeAttendanceEntry(id: string) {
  const ownerId = await requireOwnerId();
  const userId = await currentUserId();
  const role = await currentRole();

  const entry = await attendanceRepo.get(ownerId, id);
  if (!entry) return;
  if (role !== "partner" && entry.userId !== userId) return;

  await attendanceRepo.remove(ownerId, id);
  refresh();
}

type EditResult = { ok: true } | { ok: false; error: string };

const field = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

// The times typed in the edit form (Israel's clock) and the reason, checked: the reason is required,
// and the exit, when given, must come after the entry.
function typedTimes(form: FormData): { ok: true; clockIn: Date; clockOut: Date | null; reason: string } | { ok: false; error: string } {
  const reason = field(form, "reason").slice(0, 300);
  if (reason.length < 2) return { ok: false, error: "יש לכתוב את סיבת השינוי" };
  const date = field(form, "date");
  const clockIn = fromIsraelParts(date, field(form, "clockIn"));
  if (!clockIn) return { ok: false, error: "יש למלא תאריך ושעת כניסה" };
  const outTime = field(form, "clockOut");
  const clockOut = outTime ? fromIsraelParts(date, outTime) : null;
  if (outTime && !clockOut) return { ok: false, error: "שעת היציאה אינה תקינה" };
  if (clockOut && clockOut <= clockIn) return { ok: false, error: "שעת היציאה חייבת להיות אחרי שעת הכניסה" };
  if (clockIn.getTime() > Date.now() + 60_000) return { ok: false, error: "אי אפשר לרשום כניסה בעתיד" };
  return { ok: true, clockIn, clockOut, reason };
}

/** Changes an entry's times by hand, with the reason (kept on the entry). Your own entries, or anyone's for a partner. */
export async function editAttendanceEntry(id: string, form: FormData): Promise<EditResult> {
  const ownerId = await requireOwnerId();
  const userId = await currentUserId();
  const role = await currentRole();

  const entry = await attendanceRepo.get(ownerId, id);
  if (!entry) return { ok: false, error: "הרשומה לא נמצאה" };
  if (role !== "partner" && entry.userId !== userId) return { ok: false, error: "אפשר לערוך רק רשומות שלך" };

  const typed = typedTimes(form);
  if (!typed.ok) return typed;
  // An entry still open (no exit yet) may stay open; a closed one keeps an exit time.
  if (entry.clockOut && !typed.clockOut) return { ok: false, error: "יש למלא שעת יציאה" };

  await attendanceRepo.update(ownerId, id, {
    clockIn: typed.clockIn,
    clockOut: typed.clockOut,
    edits: [
      ...(entry.edits ?? []),
      {
        at: new Date(),
        byUserId: userId,
        byName: await currentUserName(),
        reason: typed.reason,
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
      },
    ],
  });
  refresh();
  return { ok: true };
}

/** Adds a whole day by hand (a forgotten clock-in), with the reason. */
export async function addAttendanceEntry(form: FormData): Promise<EditResult> {
  const ownerId = await requireOwnerId();
  const userId = await currentUserId();
  const userName = await currentUserName();

  const typed = typedTimes(form);
  if (!typed.ok) return typed;
  if (!typed.clockOut) return { ok: false, error: "יש למלא שעת יציאה" };

  await attendanceRepo.insert(ownerId, {
    userId,
    userName,
    clockIn: typed.clockIn,
    clockOut: typed.clockOut,
    edits: [{ at: new Date(), byUserId: userId, byName: userName, reason: typed.reason, clockIn: typed.clockIn, clockOut: typed.clockOut }],
  });
  refresh();
  return { ok: true };
}
