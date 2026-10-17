import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  casesRepo,
  caseTypesRepo,
  clientsRepo,
  eventsRepo,
  eventTypesRepo,
  quotesRepo,
  toCase,
  toClient,
  toEvent,
  toQuote,
} from "@/lib/db/entities";
import { caseTypes, eventTypes, type CalendarEvent, type Case, type CaseType, type Client, type Quote } from "@/lib/types";

export type DashboardData = {
  clients: Client[];
  cases: Case[];
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
 * The built-in appraisal types plus any a partner added, with "אחר" kept last.
 * Falls back to the built-ins if the database can't be read, so a form still renders.
 */
export async function loadCaseTypes(ownerId: string): Promise<string[]> {
  const builtIn = caseTypes.filter((t) => t !== "אחר");
  try {
    const custom = (await caseTypesRepo.list(ownerId, { createdAt: 1 })).map((c) => c.name);
    const extra = [...new Set(custom)].filter((n) => !caseTypes.includes(n as CaseType));
    return [...builtIn, ...extra, "אחר"];
  } catch (err) {
    console.error("Failed to load custom case types:", err);
    return [...builtIn, "אחר"];
  }
}

/** The built-in calendar event types plus any the office added. */
export async function loadEventTypes(ownerId: string): Promise<string[]> {
  try {
    const custom = (await eventTypesRepo.list(ownerId, { createdAt: 1 })).map((t) => t.name);
    return [...eventTypes, ...[...new Set(custom)].filter((n) => !eventTypes.includes(n))];
  } catch (err) {
    console.error("Failed to load custom event types:", err);
    return [...eventTypes];
  }
}

/**
 * A Server Component that throws on the initial request bypasses error.tsx and
 * renders a bare 500, so an unreachable database is reported as data instead of
 * an exception. requireOwnerId stays outside the try because its redirect works
 * by throwing, and swallowing that would break the auth guard.
 */
export async function loadDashboardData(): Promise<LoadResult> {
  const ownerId = await requireOwnerId();
  const isPartner = (await currentRole()) === "partner";

  try {
    const [clients, cases, events, quotes] = await Promise.all([
      clientsRepo.list(ownerId, { name: 1 }),
      casesRepo.list(ownerId, { dueDate: 1 }),
      eventsRepo.list(ownerId, { start: 1 }),
      // Quotes are partners-only, so an employee's session never loads them.
      isPartner ? quotesRepo.list(ownerId) : Promise.resolve([]),
    ]);

    return {
      ok: true,
      data: {
        clients: clients.map(toClient),
        // Fee data is partners-only: an employee's cases arrive without it.
        cases: cases.map((c) => {
          const view = toCase(c);
          return isPartner ? view : { ...view, fee: null, feeNote: "" };
        }),
        events: events.map(toEvent),
        quotes: quotes.map(toQuote),
      },
    };
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    return { ok: false };
  }
}
