import { buildCalendarItems, buildIcs, canSeeEvent } from "@/lib/calendar";
import { feedForToken } from "@/lib/db/calendar-feed";
import { casesRepo, eventsRepo, toCase, toEvent } from "@/lib/db/entities";
import { findAccountById } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * A person's view of the office calendar as an iCalendar feed that Apple Calendar subscribes to: the
 * same events they see on the calendar page. Calendar apps can't sign in, so the long random token in
 * the URL is the credential; its owner can replace it from the calendar page.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const feed = await feedForToken(token.replace(/\.ics$/, ""));
  if (!feed) return new Response("Not found", { status: 404 });

  try {
    const [account, events, cases] = await Promise.all([
      findAccountById(feed.userId),
      eventsRepo.list(feed.organizationId),
      casesRepo.list(feed.organizationId),
    ]);
    // A removed account's link stops working.
    if (!account) return new Response("Not found", { status: 404 });
    const viewer = { id: feed.userId, role: account.role ?? "partner" };
    const visible = events.map(toEvent).filter((e) => canSeeEvent(e, viewer));
    const body = buildIcs(buildCalendarItems(visible, cases.map(toCase)));
    return new Response(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Failed to build calendar feed:", err);
    return new Response("Calendar unavailable", { status: 503 });
  }
}
