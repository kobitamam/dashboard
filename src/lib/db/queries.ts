import { cache } from "react";
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
import { findAccountById, organizationIdOf } from "@/lib/users";
import { caseTypes, eventTypes, type CalendarEvent, type Case, type CaseType, type Client, type Quote } from "@/lib/types";

export type DashboardData = {
  clients: Client[];
  cases: Case[];
  events: CalendarEvent[];
  quotes: Quote[];
};

export type LoadResult =
  | { ok: true; data: DashboardData }
  | { ok: false; reason: string };

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "partner" | "employee";
  organizationId: string;
};

// A sign-in token stays valid for weeks, so the account behind it is looked up again:
// a removed employee loses access, and a changed role applies, within a minute. The
// result is remembered per server instance so this costs at most one query a minute.
const ACCOUNT_CHECK_MS = 60_000;
const checkedAccounts = new Map<string, { at: number; account: Awaited<ReturnType<typeof findAccountById>> }>();

async function storedAccount(id: string) {
  const memo = checkedAccounts.get(id);
  if (memo && Date.now() - memo.at < ACCOUNT_CHECK_MS) return memo.account;
  const account = await findAccountById(id);
  checkedAccounts.set(id, { at: Date.now(), account });
  return account;
}

/**
 * The signed-in account, or null. Read once per request (layout and page share it).
 * If the database can't be reached the token's own details are used, so a database
 * hiccup shows the "no connection" screen rather than logging everybody out.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;

  const fromToken: SessionUser = {
    id: user.id,
    name: user.name || user.email || "משתמש",
    email: user.email ?? "",
    role: user.role ?? "partner",
    organizationId: user.organizationId,
  };

  let account;
  try {
    account = await storedAccount(user.id);
  } catch (err) {
    console.error("Failed to verify the signed-in account:", err);
    return fromToken;
  }
  if (!account) return null;

  return {
    ...fromToken,
    name: account.name || fromToken.name,
    // Accounts created before roles existed were always the organization's partner.
    role: account.role ?? "partner",
    organizationId: organizationIdOf(account),
  };
});

async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Returns the organization id every record is scoped by - shared by a
 * partner and the employees they created, so everyone in the same office
 * sees the same clients/cases/quotes. Not the individual account id; use
 * currentUserId() for that.
 */
export async function requireOwnerId(): Promise<string> {
  return (await requireUser()).organizationId;
}

export class NotAPartnerError extends Error {
  constructor() {
    super("פעולה זו מוגבלת לשותפים בלבד");
    this.name = "NotAPartnerError";
  }
}

/** Like requireOwnerId, but also rejects employee accounts (fee data is partners-only). */
export async function requirePartnerId(): Promise<string> {
  const user = await requireUser();
  if (user.role !== "partner") throw new NotAPartnerError();
  return user.organizationId;
}

/** The individual logged-in account, as opposed to the shared organization id. */
export async function currentUserId(): Promise<string> {
  return (await requireUser()).id;
}

export async function currentUserName(): Promise<string> {
  return (await requireUser()).name;
}

export async function currentRole(): Promise<"partner" | "employee"> {
  return (await requireUser()).role;
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

// A short, secret-free description of why the data could not be loaded, shown on the
// error screen because the server logs are not readable from the development side.
function describeFailure(err: unknown) {
  const name = err instanceof Error ? err.name : "Error";
  const message = (err instanceof Error ? err.message : String(err))
    .replace(/mongodb(\+srv)?:\/\/\S+/gi, "[mongodb]")
    .replace(/\/\/[^@\s]+@/g, "//***:***@")
    .replace(/\s+/g, " ")
    .slice(0, 160);
  return `${name}: ${message}`;
}

/**
 * A Server Component that throws on the initial request bypasses error.tsx and
 * renders a bare 500, so an unreachable database is reported as data instead of
 * an exception. requireOwnerId stays outside the try because its redirect works
 * by throwing, and swallowing that would break the auth guard.
 */
export const loadDashboardData = cache(async (): Promise<LoadResult> => {
  const { organizationId: ownerId, role } = await requireUser();
  const isPartner = role === "partner";

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
    return { ok: false, reason: describeFailure(err) };
  }
});
