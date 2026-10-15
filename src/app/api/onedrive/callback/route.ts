import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveConnection } from "@/lib/db/onedrive-connection";
import { exchangeCodeForTokens, verifyState } from "@/lib/onedrive";

export const dynamic = "force-dynamic";

function redirectTo(origin: string, status: "connected" | "error", message?: string) {
  const url = new URL("/dashboard/calendar", origin);
  url.searchParams.set("onedrive", status);
  if (message) url.searchParams.set("onedrive_error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");

  if (oauthError) {
    return redirectTo(url.origin, "error", oauthError);
  }
  if (!code || !state) {
    return redirectTo(url.origin, "error", "תשובה לא תקינה ממיקרוסופט");
  }

  // The state proves this redirect belongs to a request we actually issued,
  // and carries the owner id without needing a separate server-side session.
  const stateOwnerId = verifyState(state);
  if (!stateOwnerId) {
    return redirectTo(url.origin, "error", "הבקשה פגה או אינה תקינה, נסה שוב");
  }

  // Defense in depth: also require a live session that matches the state.
  const session = await auth();
  if (!session?.user?.id || session.user.id !== stateOwnerId) {
    return redirectTo(url.origin, "error", "יש להתחבר למערכת לפני חיבור OneDrive");
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
