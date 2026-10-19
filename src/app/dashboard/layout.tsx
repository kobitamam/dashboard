import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { deriveAlerts } from "@/lib/alerts";
import { getSessionUser, loadDashboardData } from "@/lib/db/queries";
import { buildSearchIndex } from "@/lib/search";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const userName = user.name;
  const isPartner = user.role === "partner";

  // The shell must render even when the database is unreachable, so the page
  // inside can explain the problem instead of the dashboard going blank.
  const result = await loadDashboardData();
  const alertCount = result.ok ? deriveAlerts(result.data).length : 0;
  const searchIndex = result.ok ? buildSearchIndex(result.data.cases, result.data.clients) : [];

  return (
    <AppShell
      userName={userName}
      alertCount={alertCount}
      isPartner={isPartner}
      searchIndex={searchIndex}
    >
      {children}
    </AppShell>
  );
}
