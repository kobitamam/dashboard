import { inviteMember, removeMemberAction } from "@/app/dashboard/team-actions";
import { DeleteButton } from "@/components/form";
import InviteMemberForm from "@/components/InviteMemberForm";
import { Card, PageHeader } from "@/components/ui";
import { currentRole, currentUserId, requireOwnerId } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";
import { listTeam } from "@/lib/users";

export default async function TeamPage() {
  if ((await currentRole()) !== "partner") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-base font-semibold text-foreground">אין לך הרשאה לצפות בעמוד זה</p>
        <p className="mt-2 text-sm text-muted">ניהול צוות חשוף לשותפים בלבד.</p>
      </div>
    );
  }

  const organizationId = await requireOwnerId();
  const selfId = await currentUserId();
  const team = await listTeam(organizationId);
  const partners = team.filter((m) => m.role === "partner");
  const employees = team.filter((m) => m.role !== "partner");

  const section = (title: string, members: typeof team, empty: string) => (
    <div className="mb-6">
      <h2 className="mb-2 text-sm font-bold text-foreground">
        {title} <span className="font-normal text-muted">({members.length})</span>
      </h2>
      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">{empty}</p>
      ) : (
        <Card className="divide-y divide-border">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {m.name}
                  {m.id === selfId && <span className="mr-2 text-xs font-normal text-muted">(אתה)</span>}
                  {m.isFounder && <span className="mr-2 text-xs font-normal text-muted">(מייסד)</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {m.email} · הצטרף ב-{formatDate(m.createdAt.toISOString())}
                </p>
              </div>
              {m.id !== selfId && !m.isFounder && (
                <DeleteButton
                  action={removeMemberAction.bind(null, m.id)}
                  confirmText={`להסיר את הגישה של ${m.name}?`}
                />
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="צוות"
        subtitle={`${partners.length} שותפים · ${employees.length} עובדים עם גישה למערכת`}
        action={<InviteMemberForm inviteMember={inviteMember} />}
      />

      <div className="mb-6 rounded-xl bg-brand-cyan-light px-4 py-3 text-sm text-brand-blue-dark">
        שותפים רואים הכול. עובדים רואים את אותם לקוחות ותיקים, אבל ללא גישה להצעות מחיר, גבייה
        ושכר טרחה.
      </div>

      {section("שותפים", partners, "אין שותפים")}
      {section("עובדים", employees, "עדיין לא נוספו עובדים")}
    </div>
  );
}
