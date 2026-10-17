import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveCalendarConnection } from "@/lib/db/calendar-connection";
import { saveConnection } from "@/lib/db/onedrive-connection";
import { CALENDAR_STATE_PREFIX, exchangeCalendarCode } from "@/lib/ms-calendar";
import { exchangeCodeForTokens, verifyState } from "@/lib/onedrive";

export const dynamic = "force-dynamic";

function redirectTo(
  origin: string,
  status: "connected" | "error",
  message?: string,
  param: "onedrive" | "calendar" = "onedrive",
) {
  const url = new URL(param === "calendar" ? "/dashboard/calendar" : "/dashboard/onedrive", origin);
  url.searchParams.set(param, status);
  if (message) url.searchParams.set(`${param}_error`, message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");

  // The Outlook calendar link comes back through this same redirect address; its
  // state is marked with a "cal:" prefix (see the check below).
  const verifiedEarly = state ? verifyState(state) : null;
  const isCalendar = !!verifiedEarly?.startsWith(CALENDAR_STATE_PREFIX);
  const param = isCalendar ? "calendar" : "onedrive";

  if (oauthError) {
    return redirectTo(url.origin, "error", oauthError, param);
  }
  if (!code || !state) {
    return redirectTo(url.origin, "error", "תשובה לא תקינה ממיקרוסופט", param);
  }

  // The state proves this redirect belongs to a request we actually issued,
  // and carries the owner id without needing a separate server-side session.
  const verified = verifiedEarly;
  if (!verified) {
    return redirectTo(url.origin, "error", "הבקשה פגה או אינה תקינה, נסה שוב", param);
  }
  const stateOwnerId = isCalendar ? verified.slice(CALENDAR_STATE_PREFIX.length) : verified;

  // Defense in depth: also require a live session that matches the state.
  // The state carries the organization id (requireOwnerId's scope), not the
  // individual account id, since the connection is shared by the whole office.
  const session = await auth();
  if (!session?.user?.id || session.user.organizationId !== stateOwnerId) {
    return redirectTo(url.origin, "error", "יש להתחבר למערכת לפני החיבור", param);
  }

  if (isCalendar) {
    try {
      await saveCalendarConnection(stateOwnerId, await exchangeCalendarCode(code, url.origin));
    } catch (err) {
      console.error("Calendar connect failed:", err);
      const message = err instanceof Error ? err.message : "החיבור נכשל, נסה שוב";
      return redirectTo(url.origin, "error", message, param);
    }
    return redirectTo(url.origin, "connected", undefined, param);
  }

  try {
    const tokens = await exchangeCodeForTokens(code, url.origin);
    await saveConnection(stateOwnerId, tokens);
  } catch (err) {
    console.error("OneDrive connect failed:", err);
    const message = err instanceof Error ? err.message : "החיבור נכשל, נסה שוב";
    return redirectTo(url.origin, "error", message);
  }

  return redirectTo(url.origin, "connected");
}
