import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  casesRepo,
  clientsRepo,
  eventsRepo,
  invoicesRepo,
  toCase,
  toClient,
  toEvent,
  toInvoice,
} from "@/lib/db/entities";
import type { CalendarEvent, Case, Client, Invoice } from "@/lib/types";

export type DashboardData = {
  clients: Client[];
  cases: Case[];
  invoices: Invoice[];
  events: CalendarEvent[];
};

export type LoadResult =
  | { ok: true; data: DashboardData }
  | { ok: false };

export async function requireOwnerId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

/**
 * A Server Component that throws on the initial request bypasses error.tsx and
 * renders a bare 500, so an unreachable database is reported as data instead of
 * an exception. requireOwnerId stays outside the try because its redirect works
 * by throwing, and swallowing that would break the auth guard.
 */
export async function loadDashboardData(): Promise<LoadResult> {
  const ownerId = await requireOwnerId();

  try {
    const [clients, cases, invoices, events] = await Promise.all([
      clientsRepo.list(ownerId, { name: 1 }),
      casesRepo.list(ownerId, { dueDate: 1 }),
      invoicesRepo.list(ownerId, { dueDate: 1 }),
      eventsRepo.list(ownerId, { start: 1 }),
    ]);

    return {
      ok: true,
      data: {
        clients: clients.map(toClient),
        cases: cases.map(toCase),
        invoices: invoices.map(toInvoice),
        events: events.map(toEvent),
      },
    };
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    return { ok: false };
  }
}
