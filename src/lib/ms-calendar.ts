import {
  AUTHORIZE_ENDPOINT,
  GRAPH_ROOT,
  callbackUrl,
  config,
  createState,
  graphError,
  requestTokens,
  type TokenSet,
} from "@/lib/onedrive";

// The calendar link is a separate Microsoft connection from OneDrive on purpose:
// the OneDrive token keeps its narrow app-folder scope, and this one can only
// touch calendars. Redirects come back through the OneDrive callback route (the
// redirect address already registered with Microsoft); the state's "cal:" prefix
// tells the two apart.
const CALENDAR_SCOPE = "offline_access Calendars.ReadWrite";
export const CALENDAR_STATE_PREFIX = "cal:";
export const CALENDAR_NAME = "TA-Estate";

// Event times are the office's wall-clock times (see lib/calendar.ts), so they
// are exchanged with Outlook as Israel local times.
const TIME_ZONE = "Israel Standard Time";

export function getCalendarAuthorizeUrl(ownerId: string, origin: string): string {
  const { clientId } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: callbackUrl(origin),
    response_mode: "query",
    scope: CALENDAR_SCOPE,
    state: createState(`${CALENDAR_STATE_PREFIX}${ownerId}`),
  });
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

export function exchangeCalendarCode(code: string, origin: string): Promise<TokenSet> {
  const { clientId, clientSecret } = config();
  return requestTokens(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(origin),
      scope: CALENDAR_SCOPE,
    }),
  );
}

export function refreshCalendarTokens(refreshToken: string): Promise<TokenSet> {
  const { clientId, clientSecret } = config();
  return requestTokens(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: CALENDAR_SCOPE,
    }),
  );
}

// ---- Graph calls ----

export type RemoteEvent = {
  id: string;
  subject: string;
  isAllDay: boolean;
  location: string;
  /** Israel local time as "YYYY-MM-DDTHH:MM:SS" */
  start: string;
};

export type OutgoingEvent = {
  subject: string;
  location?: string;
  body?: string;
  /** "YYYY-MM-DDTHH:MM:SS" Israel local time, or a plain "YYYY-MM-DD" for an all-day event */
  start: string;
  end: string;
  allDay?: boolean;
};

async function call(token: string, path: string, what: string, init: RequestInit = {}) {
  const res = await fetch(`${GRAPH_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: `outlook.timezone="${TIME_ZONE}"`,
      ...init.headers,
    },
  });
  if (!res.ok) throw await graphError(res, what);
  return res;
}

export async function createCalendar(token: string): Promise<string> {
  const res = await call(token, "/me/calendars", "יצירת היומן ב-Outlook נכשלה", {
    method: "POST",
    body: JSON.stringify({ name: CALENDAR_NAME }),
  });
  return (await res.json()).id;
}

export async function listRemoteEvents(token: string, calendarId: string): Promise<RemoteEvent[]> {
  const out: RemoteEvent[] = [];
  let next: string | null =
    `/me/calendars/${encodeURIComponent(calendarId)}/events?$select=id,subject,start,isAllDay,location&$top=100`;
  for (let page = 0; next && page < 20; page++) {
    const res: Response = await call(token, next, "קריאת האירועים מ-Outlook נכשלה");
    const json = await res.json();
    for (const e of json.value ?? []) {
      out.push({
        id: e.id,
        subject: e.subject ?? "",
        isAllDay: !!e.isAllDay,
        location: e.location?.displayName ?? "",
        start: String(e.start?.dateTime ?? "").slice(0, 19),
      });
    }
    next = json["@odata.nextLink"] ? String(json["@odata.nextLink"]).replace(GRAPH_ROOT, "") : null;
  }
  // A partial list would make the sync read the missing events as deleted.
  if (next) throw new Error("יש יותר מדי אירועים ביומן Outlook לסנכרון");
  return out;
}

function payload(event: OutgoingEvent) {
  const suffix = (value: string) => (event.allDay ? `${value}T00:00:00` : value);
  return {
    subject: event.subject,
    isAllDay: !!event.allDay,
    start: { dateTime: suffix(event.start), timeZone: TIME_ZONE },
    end: { dateTime: suffix(event.end), timeZone: TIME_ZONE },
    location: { displayName: event.location ?? "" },
    ...(event.body !== undefined ? { body: { contentType: "text", content: event.body } } : {}),
  };
}

export async function createRemoteEvent(
  token: string,
  calendarId: string,
  event: OutgoingEvent,
): Promise<string> {
  const res = await call(
    token,
    `/me/calendars/${encodeURIComponent(calendarId)}/events`,
    "יצירת אירוע ב-Outlook נכשלה",
    { method: "POST", body: JSON.stringify(payload(event)) },
  );
  return (await res.json()).id;
}

export async function updateRemoteEvent(token: string, id: string, event: OutgoingEvent) {
  await call(token, `/me/events/${encodeURIComponent(id)}`, "עדכון אירוע ב-Outlook נכשל", {
    method: "PATCH",
    body: JSON.stringify(payload(event)),
  });
}

/** Deleting an event that is already gone counts as done. */
export async function deleteRemoteEvent(token: string, id: string) {
  const res = await fetch(`${GRAPH_ROOT}/me/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw await graphError(res, "מחיקת אירוע ב-Outlook נכשלה");
}
