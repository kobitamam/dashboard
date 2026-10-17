import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/mongodb";
import { refreshCalendarTokens } from "@/lib/ms-calendar";
import type { TokenSet } from "@/lib/onedrive";

export type CalendarConnectionDoc = {
  _id: string; // ownerId - one Outlook calendar link per organization
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  expiresAt: Date;
  calendarId?: string; // the "TA-Estate" calendar created in Outlook
  lastSyncAt?: Date;
  lastError?: string | null;
  lockedUntil?: Date;
  connectedAt: Date;
};

export type DeadlineMapDoc = {
  _id: string; // `${ownerId}:${deadline key}`
  ownerId: string;
  key: string;
  outlookId: string;
  hash: string;
};

export async function connections() {
  const db = await getDb();
  return db.collection<CalendarConnectionDoc>("calendarConnections");
}

export async function deadlineMap() {
  const db = await getDb();
  return db.collection<DeadlineMapDoc>("calendarDeadlineMap");
}

export async function saveCalendarConnection(ownerId: string, tokens: TokenSet) {
  const col = await connections();
  await col.updateOne(
    { _id: ownerId },
    {
      $set: {
        accessToken: encryptSecret(tokens.accessToken),
        refreshToken: encryptSecret(tokens.refreshToken),
        expiresAt: tokens.expiresAt,
        lastError: null,
      },
      $setOnInsert: { connectedAt: new Date() },
    },
    { upsert: true },
  );
}

export async function getCalendarConnection(ownerId: string) {
  return (await connections()).findOne({ _id: ownerId });
}

/** Drops the link. The calendar already in Outlook is left alone. */
export async function removeCalendarConnection(ownerId: string) {
  await (await connections()).deleteOne({ _id: ownerId });
  await (await deadlineMap()).deleteMany({ ownerId });
  const db = await getDb();
  // Without a link the events are no longer mirrored anywhere.
  await db.collection("events").updateMany({ ownerId }, { $unset: { outlookId: "", syncHash: "" } });
}

const REFRESH_SKEW_MS = 5 * 60 * 1000;

export async function getValidCalendarToken(doc: CalendarConnectionDoc): Promise<string | null> {
  if (doc.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) return decryptSecret(doc.accessToken);
  try {
    const fresh = await refreshCalendarTokens(decryptSecret(doc.refreshToken));
    await saveCalendarConnection(doc._id, fresh);
    return fresh.accessToken;
  } catch (err) {
    console.error("Failed to refresh calendar token:", err);
    return null;
  }
}
