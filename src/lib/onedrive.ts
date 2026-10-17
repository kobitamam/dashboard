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

export type OneDriveFolder = { id: string; webUrl: string; name: string };

// Everything is addressed by name, relative to the app folder. Looking items up
// by id is rejected (itemNotFound) for a token limited to the app folder, while
// path-based access to the same items works.
function appPath(...segments: string[]) {
  return `/me/drive/special/approot:/${segments.map((s) => encodeURIComponent(sanitizeFolderName(s))).join("/")}`;
}

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
  return { id: json.id, webUrl: json.webUrl, name: json.name };
}

/**
 * Creates a folder for a case directly under the app's special OneDrive
 * folder, plus one starter sub-folder for files. Best-effort by design: a
 * case is still usable if OneDrive is unreachable, so callers should catch
 * and log rather than fail the surrounding action.
 */
export async function createCaseFolder(accessToken: string, name: string): Promise<OneDriveFolder> {
  const folder = await createChildFolder(accessToken, "/me/drive/special/approot/children", name);
  await createChildFolder(accessToken, `${appPath(folder.name)}:/children`, "מסמכים");
  return folder;
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
export type UploadParent = { appFolderName: string };

function parentPath(parent: UploadParent) {
  return appPath(parent.appFolderName);
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

/** Moves a file between two folders of the app folder; returns its new web link. */
export async function moveFileBetweenFolders(
  accessToken: string,
  fromFolder: string,
  fileName: string,
  toFolder: string,
): Promise<{ webUrl: string }> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  // A move names its destination by id, so look that one folder's id up by path.
  const dest = await fetch(`${GRAPH_ROOT}${appPath(toFolder)}?select=id`, { headers });
  if (!dest.ok) throw new Error(`תיקיית היעד ב-OneDrive לא נמצאה: ${dest.status}`);
  const folderId = (await dest.json()).id;

  const res = await fetch(`${GRAPH_ROOT}${appPath(fromFolder, fileName)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ parentReference: { id: folderId } }),
  });
  if (!res.ok) throw new Error(`העברת קובץ ב-OneDrive נכשלה: ${res.status} ${await res.text()}`);
  return { webUrl: (await res.json()).webUrl };
}

type ItemLocation = {
  name: string;
  webUrl: string;
  parentReference?: { driveId?: string; path?: string };
};

/**
 * Finds a file in an app-folder folder by listing it, preferring the exact
 * name and otherwise any .docx starting with `prefix`. When nothing matches
 * the error names what the folder does contain, so a mismatch can be seen.
 */
export async function findAppFolderFile(
  accessToken: string,
  folderName: string,
  fileName: string,
  prefix: string,
): Promise<ItemLocation> {
  const res = await fetch(
    `${GRAPH_ROOT}${appPath(folderName)}:/children?select=name,webUrl,parentReference&$top=200`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const code = (await res.json().catch(() => null))?.error?.code;
    throw new Error(
      `פתיחת התיקייה "${folderName}" ב-OneDrive נכשלה: ${res.status}${code ? ` ${code}` : ""}`,
    );
  }

  const items: ItemLocation[] = (await res.json()).value ?? [];
  const found =
    items.find((i) => i.name === fileName) ??
    items.find((i) => i.name.startsWith(prefix) && i.name.toLowerCase().endsWith(".docx"));
  if (!found) {
    const names = items.slice(0, 6).map((i) => i.name);
    throw new Error(
      `הקובץ "${fileName}" לא נמצא בתיקייה "${folderName}" (יש שם: ${names.join(", ") || "אין קבצים"})`,
    );
  }
  return found;
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

/** Creates a standalone folder (not tied to a case) directly in the app folder. */
export async function createCustomFolder(accessToken: string, name: string): Promise<OneDriveFolder> {
  return createChildFolder(accessToken, "/me/drive/special/approot/children", name);
}
