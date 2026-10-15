import { inviteEmployee, removeEmployeeAction } from "@/app/dashboard/team-actions";
import { DeleteButton, EmptyState } from "@/components/form";
import InviteEmployeeForm from "@/components/InviteEmployeeForm";
import { Card, PageHeader } from "@/components/ui";
import { currentRole, requireOwnerId } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";
import { listEmployees } from "@/lib/users";

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
  const employees = await listEmployees(organizationId);
  const form = <InviteEmployeeForm inviteEmployee={inviteEmployee} />;

  return (
    <div>
      <PageHeader
        title="צוות"
        subtitle={
          employees.length
            ? `${employees.length} עובדים עם גישה למערכת`
            : "אין עדיין עובדים עם גישה למערכת"
        }
        action={employees.length > 0 ? form : undefined}
      />

      <div className="mb-4 rounded-xl bg-brand-cyan-light px-4 py-3 text-sm text-brand-blue-dark">
        עובדים רואים את אותם לקוחות, תיקים והצעות מחיר כמוך, אבל ללא גישה לנתוני שכר הטרחה.
      </div>

      {employees.length === 0 ? (
        <EmptyState
          title="אין עובדים במערכת"
          hint="הוסף עובד ראשון. עובד יתחבר עם האימייל והסיסמה שתגדיר לו, ויראה את אותם לקוחות ותיקים כמוך - אך ללא גישה לשכר טרחה."
          action={form}
        />
      ) : (
        <Card className="divide-y divide-border">
          {employees.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{e.name}</p>
                <p className="truncate text-xs text-muted">
                  {e.email} · הצטרף ב-{formatDate(e.createdAt.toISOString())}
                </p>
              </div>
              <DeleteButton
                action={removeEmployeeAction.bind(null, e.id)}
                confirmText={`להסיר את הגישה של ${e.name}?`}
              />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
