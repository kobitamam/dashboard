import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export class MissingOneDriveConfigError extends Error {
  constructor() {
    super("תצורת החיבור ל-OneDrive חסרה");
    this.name = "MissingOneDriveConfigError";
  }
}

const AUTHORIZE_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

// Delegated, and deliberately not the broad Files.ReadWrite: this scope limits
// the app to its own special OneDrive folder, so a bug here can never reach
// the rest of a client's drive.
const SCOPE = "offline_access Files.ReadWrite.AppFolder";

const STATE_TTL_MS = 10 * 60 * 1000;

export function isOneDriveConfigured() {
  return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

function config() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new MissingOneDriveConfigError();
  return { clientId, clientSecret };
}

function callbackUrl(origin: string) {
  return `${origin}/api/onedrive/callback`;
}

function sign(payload: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET environment variable");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Signed, time-limited CSRF token carrying the owner id through the redirect. */
export function createState(ownerId: string): string {
  const payload = Buffer.from(`${ownerId}.${Date.now()}.${randomBytes(8).toString("hex")}`).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyState(state: string): string | null {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [ownerId, tsRaw] = Buffer.from(payload, "base64url").toString("utf8").split(".");
  const ts = Number(tsRaw);
  if (!ownerId || !Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS) return null;
  return ownerId;
}

export function getAuthorizeUrl(ownerId: string, origin: string): string {
  const { clientId } = config();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: callbackUrl(origin),
    response_mode: "query",
    scope: SCOPE,
    state: createState(ownerId),
  });
  return `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
}

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
};

async function requestTokens(body: URLSearchParams): Promise<TokenSet> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error_description || json.error || "OneDrive token request failed");
  }
  if (!json.refresh_token) {
    // Happens if offline_access wasn't actually granted in consent.
    throw new Error("לא התקבל refresh token - ודא ש-offline_access מאושר בהרשאות האפליקציה");
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
    scope: json.scope,
  };
}

export async function exchangeCodeForTokens(code: string, origin: string): Promise<TokenSet> {
  const { clientId, clientSecret } = config();
  return requestTokens(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(origin),
      scope: SCOPE,
    }),
  );
}

export async function refreshTokens(refreshToken: string): Promise<TokenSet> {
  const { clientId, clientSecret } = config();
  return requestTokens(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPE,
    }),
  );
}

/** A cheap call to prove a connection is actually alive, not just stored. */
export async function pingAppFolder(accessToken: string): Promise<boolean> {
  const res = await fetch(`${GRAPH_ROOT}/me/drive/special/approot`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.ok;
}

// OneDrive forbids these characters in a folder name (and a trailing dot/space).
export function sanitizeFolderName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*]/g, "-").trim().replace(/[. ]+$/, "");
  return cleaned.slice(0, 255) || "תיקיה";
}

export type OneDriveFolder = { id: string; webUrl: string };

async function createChildFolder(
  accessToken: string,
  parentPath: string,
  name: string,
): Promise<OneDriveFolder> {
  const res = await fetch(`${GRAPH_ROOT}${parentPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: sanitizeFolderName(name),
      folder: {},
      // Microsoft renames on a clash instead of failing the request outright.
      "@microsoft.graph.conflictBehavior": "rename",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`יצירת תיקיה ב-OneDrive נכשלה: ${res.status} ${body}`);
  }

  const json = await res.json();
  return { id: json.id, webUrl: json.webUrl };
}

/**
 * Creates a folder for a case directly under the app's special OneDrive
 * folder, plus one starter sub-folder for files. Best-effort by design: a
 * case is still usable if OneDrive is unreachable, so callers should catch
 * and log rather than fail the surrounding action.
 */
export async function createCaseFolder(accessToken: string, name: string): Promise<OneDriveFolder> {
  const folder = await createChildFolder(accessToken, "/me/drive/special/approot/children", name);
  await createChildFolder(accessToken, `/me/drive/items/${folder.id}/children`, "מסמכים");
  return folder;
}

/** Creates a standalone folder (not tied to a case) directly in the app folder. */
export async function createCustomFolder(accessToken: string, name: string): Promise<OneDriveFolder> {
  return createChildFolder(accessToken, "/me/drive/special/approot/children", name);
}
