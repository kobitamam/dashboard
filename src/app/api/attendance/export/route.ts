import { attendanceRepo, toAttendance } from "@/lib/db/entities";
import { getSessionUser } from "@/lib/db/queries";
import { attendanceWorkbook, currentMonth, entryMonth, isMonth, peopleOf } from "@/lib/attendance-report";
import { listOrganizationMembers } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * The hours report of a month as an Excel file: ?month=2026-11&person=<user id>. A partner may ask for
 * anyone or (no person) the whole team; an employee always gets their own hours only.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const params = new URL(request.url).searchParams;
  const month = isMonth(params.get("month") ?? undefined) ? params.get("month")! : currentMonth();
  const person = user.role === "partner" ? params.get("person") || "" : user.id;

  const [docs, members] = await Promise.all([
    attendanceRepo.list(user.organizationId, { clockIn: 1 }),
    listOrganizationMembers(user.organizationId),
  ]);
  const all = docs.map(toAttendance);
  const entries = all.filter((e) => entryMonth(e) === month && (!person || e.userId === person));
  const everyone = peopleOf(members, all);
  const people = person ? everyone.filter((p) => p.id === person) : everyone;
  if (person && people.length === 0) return new Response("Not found", { status: 404 });

  const file = await attendanceWorkbook(entries, people, month, !!person);
  const name = `דוח שעות ${month}${person ? ` ${people[0].name}` : ""}.xlsx`.replace(/[\\/:*?"<>|]/g, " ");
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="attendance-${month}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
