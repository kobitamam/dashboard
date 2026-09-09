import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/AppShell";

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

  return <AppShell userName={userName}>{children}</AppShell>;
}
