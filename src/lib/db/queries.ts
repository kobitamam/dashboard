import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  casesRepo,
  clientsRepo,
  eventsRepo,
  invoicesRepo,
  quotesRepo,
  toCase,
  toClient,
  toEvent,
  toInvoice,
  toQuote,
} from "@/lib/db/entities";
import type { CalendarEvent, Case, Client, Invoice, Quote } from "@/lib/types";

export type DashboardData = {
  clients: Client[];
  cases: Case[];
  invoices: Invoice[];
  events: CalendarEvent[];
  quotes: Quote[];
};

export type LoadResult =
  | { ok: true; data: DashboardData }
  | { ok: false };

/**
 * Returns the organization id every record is scoped by - shared by a
 * partner and the employees they created, so everyone in the same office
 * sees the same clients/cases/quotes. Not the individual account id; use
 * currentUserId() for that.
 */
export async function requireOwnerId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.organizationId;
}

export class NotAPartnerError extends Error {
  constructor() {
    super("פעולה זו מוגבלת לשותפים בלבד");
    this.name = "NotAPartnerError";
  }
}

/** Like requireOwnerId, but also rejects employee accounts (fee data is partners-only). */
export async function requirePartnerId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "partner") throw new NotAPartnerError();
  return session.user.organizationId;
}

/** The individual logged-in account, as opposed to the shared organization id. */
export async function currentUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function currentUserName(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.name || session.user.email || "משתמש";
}

export async function currentRole(): Promise<"partner" | "employee"> {
  const session = await auth();
  return session?.user?.role ?? "partner";
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
    const [clients, cases, invoices, events, quotes] = await Promise.all([
      clientsRepo.list(ownerId, { name: 1 }),
      casesRepo.list(ownerId, { dueDate: 1 }),
      invoicesRepo.list(ownerId, { dueDate: 1 }),
      eventsRepo.list(ownerId, { start: 1 }),
      quotesRepo.list(ownerId),
    ]);

    return {
      ok: true,
      data: {
        clients: clients.map(toClient),
        cases: cases.map(toCase),
        invoices: invoices.map(toInvoice),
        events: events.map(toEvent),
        quotes: quotes.map(toQuote),
      },
    };
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    return { ok: false };
  }
}
