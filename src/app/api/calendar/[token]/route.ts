import { buildCalendarItems, buildIcs } from "@/lib/calendar";
import { casesRepo, eventsRepo, toCase, toEvent } from "@/lib/db/entities";
import { ownerIdForFeedToken } from "@/lib/db/calendar-feed";

export const dynamic = "force-dynamic";

/**
 * The office calendar as an iCalendar feed that Apple Calendar subscribes to.
 * Calendar apps can't sign in, so the long random token in the URL is the
 * credential; a partner can replace it from the calendar page.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ownerId = await ownerIdForFeedToken(token.replace(/\.ics$/, ""));
  if (!ownerId) return new Response("Not found", { status: 404 });

  try {
    const [events, cases] = await Promise.all([eventsRepo.list(ownerId), casesRepo.list(ownerId)]);
    const body = buildIcs(buildCalendarItems(events.map(toEvent), cases.map(toCase)));
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
