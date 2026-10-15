"use server";

import { revalidatePath } from "next/cache";
import { attendanceRepo } from "@/lib/db/entities";
import { currentRole, currentUserId, currentUserName, requireOwnerId } from "@/lib/db/queries";

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
