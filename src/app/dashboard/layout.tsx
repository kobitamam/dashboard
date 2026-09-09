import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/AppShell";
import { deriveAlerts } from "@/lib/alerts";
import { loadDashboardData } from "@/lib/db/queries";

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

  // The shell must render even when the database is unreachable, so the page
  // inside can explain the problem instead of the dashboard going blank.
  const result = await loadDashboardData();
  const alertCount = result.ok ? deriveAlerts(result.data).length : 0;

  return (
    <AppShell userName={userName} alertCount={alertCount}>
      {children}
    </AppShell>
  );
}
