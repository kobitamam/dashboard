import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import { deriveAlerts } from "@/lib/alerts";
import { loadDashboardData } from "@/lib/db/queries";
import { buildSearchIndex } from "@/lib/search";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userName = session.user.name || session.user.email || "משתמש";
  const isPartner = session.user.role === "partner";

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
