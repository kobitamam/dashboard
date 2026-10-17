import Link from "next/link";
import { createClient, deleteClient } from "@/app/dashboard/actions";
import {
  AddRecord,
  DataUnavailable,
  DeleteButton,
  EmptyState,
  Field,
  SelectField,
} from "@/components/form";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { syncClientsFromCases, clientKey } from "@/lib/db/clients-sync";
import { currentRole, loadDashboardData, requireOwnerId } from "@/lib/db/queries";
import { feeTotals } from "@/lib/fees";
import { clientHaystack, matchesQuery } from "@/lib/search";
import { formatMoney } from "@/lib/format";
import { clientStatuses } from "@/lib/types";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  // Clients of cases opened before cases fed this list are added here (idempotent).
  await syncClientsFromCases(await requireOwnerId()).catch((err) =>
    console.error("Failed to sync clients from cases:", err),
  );

  const result = await loadDashboardData();
  if (!result.ok) return <DataUnavailable />;
  const isPartner = (await currentRole()) === "partner";
  const { clients: allClients, cases } = result.data;
  const clients = search ? allClients.filter((c) => matchesQuery(clientHaystack(c), search)) : allClients;

  // Derived rather than stored, so the numbers can never go stale.
  const openCasesFor = (name: string) =>
    cases.filter((c) => clientKey(c.clientName) === clientKey(name) && c.status !== "הושלם").length;
  // What has become billable on the client's cases (stage 1 from the opening, stage 2 once completed).
  const billedTo = (name: string) =>
    cases
      .filter((c) => clientKey(c.clientName) === clientKey(name))
      .reduce((sum, c) => sum + feeTotals(c.fee, c.status === "הושלם").dueNow, 0);

  const activeCount = allClients.filter((c) => c.status === "פעיל").length;

  const form = (
    <AddRecord label="+ לקוח חדש" action={createClient}>
      <Field label="שם" name="name" required placeholder="שם הלקוח" />
      <Field label="טלפון" name="phone" placeholder="050-0000000" />
      <Field label="אימייל" name="email" type="email" placeholder="name@example.com" />
      <Field label="סוג נכס" name="propertyType" placeholder="דירת מגורים" />
      <SelectField label="סטטוס" name="status" options={clientStatuses} defaultValue="ליד חדש" />
      <Field label="הערות" name="notes" placeholder="הערות פנימיות" />
    </AddRecord>
  );

  return (
    <div>
      <PageHeader
        title="לקוחות"
        subtitle={
          allClients.length
            ? `${allClients.length} לקוחות במערכת · ${activeCount} פעילים`
            : "עדיין לא הוספת לקוחות"
        }
        action={allClients.length > 0 ? form : undefined}
      />

      {search && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-cyan-light px-4 py-2.5 text-sm text-brand-blue">
          <span>
            תוצאות חיפוש: <strong>{search}</strong> ({clients.length})
          </span>
          <Link href="/dashboard/clients" className="font-semibold underline">
            נקה
          </Link>
        </div>
      )}

      {allClients.length === 0 ? (
        <EmptyState
          title="אין עדיין לקוחות"
          hint="הוסף את הלקוח הראשון שלך, וכל התיקים שלו יתחברו אליו אוטומטית."
          action={form}
        />
      ) : clients.length === 0 ? (
        <EmptyState title="לא נמצאו לקוחות" hint="נסה חיפוש אחר, או לחץ על ״נקה״ כדי לראות את כולם." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead>
                <tr className="border-b border-border bg-background text-xs text-muted">
                  <th className="px-4 py-3 font-medium">לקוח</th>
                  <th className="px-4 py-3 font-medium">סוג נכס</th>
                  <th className="px-4 py-3 font-medium">סטטוס</th>
                  <th className="px-4 py-3 font-medium">תיקים פתוחים</th>
                  {isPartner && <th className="px-4 py-3 font-medium">סה&quot;כ חויב</th>}
                  <th className="px-4 py-3 font-medium">טלפון</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-cyan-light text-xs font-bold text-brand-blue">
                          {c.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{c.name}</p>
                          <p className="truncate text-xs text-muted">{c.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">{c.propertyType || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-foreground/80">{openCasesFor(c.name)}</td>
                    {isPartner && (
                      <td className="px-4 py-3 font-medium text-foreground">
                        {formatMoney(billedTo(c.name))}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted">{c.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <DeleteButton
                        action={deleteClient.bind(null, c.id)}
                        confirmText={`למחוק את ${c.name}?`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
