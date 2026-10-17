import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export class MissingOneDriveConfigError extends Error {
  constructor() {
    super("תצורת החיבור ל-OneDrive חסרה");
    this.name = "MissingOneDriveConfigError";
  }
}

export const AUTHORIZE_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
export const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

// Delegated, and deliberately not the broad Files.ReadWrite: this scope limits
// the app to its own special OneDrive folder, so a bug here can never reach
// the rest of a client's drive.
const SCOPE = "offline_access Files.ReadWrite.AppFolder";

const STATE_TTL_MS = 10 * 60 * 1000;

export function isOneDriveConfigured() {
  return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

export function config() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new MissingOneDriveConfigError();
  return { clientId, clientSecret };
}

export function callbackUrl(origin: string) {
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

export async function requestTokens(body: URLSearchParams): Promise<TokenSet> {
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
  const cleaned = name
    // Invisible control / direction marks arrive with text pasted from Word or
    // Excel and make OneDrive reject the whole name.
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
  return cleaned.slice(0, 255) || "תיקיה";
}

export type OneDriveFolder = { id: string; webUrl: string; name: string };

// Everything is addressed by name, relative to the app folder. Looking items up
// by id is rejected (itemNotFound) for a token limited to the app folder, while
// path-based access to the same items works.
function appPath(...segments: string[]) {
  return `/me/drive/special/approot:/${segments.map((s) => encodeURIComponent(sanitizeFolderName(s))).join("/")}`;
}

export async function graphError(res: Response, what: string) {
  const error = (await res.json().catch(() => null))?.error;
  // Graph's message is a generic description of the problem, never a secret.
  const detail = [error?.code, typeof error?.message === "string" ? error.message.slice(0, 120) : ""]
    .filter(Boolean)
    .join(" - ");
  return new Error(`${what}: ${res.status}${detail ? ` ${detail}` : ""}`);
}

async function getAppFolder(accessToken: string, name: string): Promise<OneDriveFolder | null> {
  const res = await fetch(`${GRAPH_ROOT}${appPath(name)}?select=id,name,webUrl`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await graphError(res, `בדיקת תיקייה "${name}" ב-OneDrive נכשלה`);
  const json = await res.json();
  return { id: json.id, webUrl: json.webUrl, name: json.name };
}

// An empty file whose upload makes Graph create the folders on its path. Creating
// the folders with a POST to ".../children" is rejected (400 invalidRequest) for
// an app-folder token, while a path-based upload creates missing parents and is
// the one folder-creating call known to work here.
const KEEP_FILE = ".keep";

/** The sub-folder of every case folder that holds the case's documents. */
export const CASE_DOCUMENTS_FOLDER = "מסמכים";

async function ensureFolders(accessToken: string, ...folders: string[]) {
  const res = await fetch(
    `${GRAPH_ROOT}${appPath(...folders, KEEP_FILE)}:/content?@microsoft.graph.conflictBehavior=replace`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/octet-stream" },
      body: new Uint8Array(0) as unknown as BodyInit,
    },
  );
  if (!res.ok) throw await graphError(res, `יצירת התיקייה "${folders.join("/")}" ב-OneDrive נכשלה`);

  // Only the folders were wanted; the marker file is cosmetic to remove.
  await fetch(`${GRAPH_ROOT}${appPath(...folders, KEEP_FILE)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch((err) => console.error("Failed to remove the folder marker file:", err));
}

/**
 * Creates a case's folder directly under the app's special OneDrive folder,
 * with a starter "מסמכים" sub-folder. Safe to run again: existing folders are
 * reused. Callers decide what to do with an error - during case creation it is
 * only logged.
 */
export async function createCaseFolder(accessToken: string, name: string): Promise<OneDriveFolder> {
  const folderName = sanitizeFolderName(name);
  await ensureFolders(accessToken, folderName, CASE_DOCUMENTS_FOLDER);

  const folder = await getAppFolder(accessToken, folderName);
  if (!folder) throw new Error(`התיקייה "${folderName}" נוצרה אך לא נמצאה ב-OneDrive`);
  return folder;
}

/**
 * A link that opens ONLY a case's documents folder, for people without access to the
 * office's OneDrive (the employees): anyone holding the link can view and edit that one
 * folder and nothing above it. It is deliberately a link to the "מסמכים" sub-folder, so
 * the quote files that may sit in the case folder's root are never reachable through it.
 * Asking again for the same link returns the existing one.
 */
export async function createDocumentsShareLink(accessToken: string, caseFolderName: string): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const folderPath = appPath(caseFolderName, CASE_DOCUMENTS_FOLDER);

  // Which way Graph accepts this call for an app-folder token is not known, so the
  // variants are tried in turn and, if none works, each one's answer is reported.
  const attempts: { label: string; url: () => Promise<string | null>; body: object }[] = [
    { label: "נתיב+anonymous", url: async () => `${folderPath}:/createLink`, body: { type: "edit", scope: "anonymous" } },
    { label: "נתיב", url: async () => `${folderPath}:/createLink`, body: { type: "edit" } },
    {
      label: "מזהה+anonymous",
      url: async () => {
        const res = await fetch(`${GRAPH_ROOT}${folderPath}?select=id`, { headers });
        const id = res.ok ? (await res.json())?.id : null;
        return id ? `/me/drive/items/${encodeURIComponent(id)}/createLink` : null;
      },
      body: { type: "edit", scope: "anonymous" },
    },
  ];

  const failures: string[] = [];
  for (const attempt of attempts) {
    try {
      const path = await attempt.url();
      if (!path) {
        failures.push(`${attempt.label}: לא נמצא מזהה`);
        continue;
      }
      const res = await fetch(`${GRAPH_ROOT}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(attempt.body),
      });
      if (res.ok) {
        const url = (await res.json())?.link?.webUrl;
        if (typeof url === "string" && url) return url;
        failures.push(`${attempt.label}: לא התקבל קישור`);
        continue;
      }
      const error = (await res.json().catch(() => null))?.error;
      failures.push(`${attempt.label}: ${res.status} ${error?.code ?? ""}`.trim());
    } catch (err) {
      failures.push(`${attempt.label}: ${err instanceof Error ? err.message.slice(0, 60) : "שגיאה"}`);
    }
  }
  throw new Error(`יצירת קישור שיתוף לתיקיית המסמכים נכשלה (${failures.join(" | ")})`);
}

/**
 * Uploads a small file (under ~4MB, Graph's simple-upload limit) into a
 * folder. An existing file of the same name is replaced.
 */
export async function uploadSmallFile(
  accessToken: string,
  parent: UploadParent,
  fileName: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<OneDriveItem> {
  const res = await fetch(
    `${GRAPH_ROOT}${parentPath(parent)}/${encodeURIComponent(sanitizeFolderName(fileName))}:/content?@microsoft.graph.conflictBehavior=replace`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": contentType },
      body: bytes as unknown as BodyInit,
    },
  );
  if (!res.ok) {
    throw new Error(`העלאת קובץ ל-OneDrive נכשלה: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return { id: json.id, webUrl: json.webUrl, name: json.name, size: json.size };
}

export type OneDriveItem = { id: string; webUrl: string; name: string; size: number };

/** Where an upload goes: a named folder directly under the app folder. */
export type UploadParent = { appFolderName: string; subFolder?: string };

function parentPath(parent: UploadParent) {
  return appPath(parent.appFolderName, ...(parent.subFolder ? [parent.subFolder] : []));
}

/**
 * Starts a resumable upload. The returned URL is pre-authenticated, so it
 * must stay on the server - the browser only ever talks to our own route.
 */
export async function createUploadSession(
  accessToken: string,
  parent: UploadParent,
  fileName: string,
): Promise<string> {
  const res = await fetch(
    `${GRAPH_ROOT}${parentPath(parent)}/${encodeURIComponent(sanitizeFolderName(fileName))}:/createUploadSession`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      // Never overwrite a file the user already has under that name.
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
    },
  );
  if (!res.ok) {
    throw new Error(`פתיחת העלאה ל-OneDrive נכשלה: ${res.status} ${await res.text()}`);
  }
  return (await res.json()).uploadUrl;
}

/** Sends one chunk; the last one returns the finished item. */
export async function uploadChunk(
  uploadUrl: string,
  bytes: Uint8Array,
  start: number,
  end: number,
  total: number,
): Promise<{ done: false } | { done: true; item: OneDriveItem }> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    // No Authorization header: the upload URL carries its own credentials.
    headers: { "Content-Range": `bytes ${start}-${end}/${total}` },
    body: bytes as unknown as BodyInit,
  });
  if (res.status === 202) return { done: false };
  if (!res.ok) throw new Error(`העלאת קטע נכשלה: ${res.status} ${await res.text()}`);

  const json = await res.json();
  return { done: true, item: { id: json.id, webUrl: json.webUrl, name: json.name, size: json.size } };
}

type ItemLocation = {
  name: string;
  webUrl: string;
  parentReference?: { driveId?: string; path?: string };
};

export async function getAppFolderFile(
  accessToken: string,
  folders: string[],
  fileName: string,
): Promise<ItemLocation> {
  const res = await fetch(
    `${GRAPH_ROOT}${appPath(...folders, fileName)}?select=name,webUrl,parentReference`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const code = (await res.json().catch(() => null))?.error?.code;
    throw new Error(`קריאת פרטי קובץ מ-OneDrive נכשלה: ${res.status}${code ? ` ${code}` : ""}`);
  }
  return res.json();
}

/**
 * The link that opens a file in the Word desktop app (rather than Word for the
 * web). Word needs the file's direct address: for a work/school account that is
 * its webUrl, for a personal OneDrive the webUrl is only a viewer link, so the
 * direct address is rebuilt from the drive id and folder path.
 */
export function wordDesktopUri(item: ItemLocation): string {
  let url = item.webUrl;
  if (!/sharepoint\.com$/i.test(new URL(item.webUrl).hostname)) {
    const cid = item.parentReference?.driveId?.toLowerCase();
    const folder = item.parentReference?.path?.split("root:")[1] ?? "";
    if (cid) url = `https://d.docs.live.net/${cid}${folder}/${item.name}`;
  }
  return `ms-word:ofe|u|${encodeURI(url)}`;
}
