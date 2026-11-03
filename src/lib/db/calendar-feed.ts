import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/mongodb";

// One subscription link per person, showing what that person sees in the office calendar (an event
// shared with the partners only, or kept private, reaches only those it is shared with). Links made
// before this were one per organization, keyed by its id - which is its founding partner's own id, so
// such a link simply carries on as the founder's.
type FeedDoc = {
  _id: string; // the account's user id
  organizationId?: string; // missing on a link made before feeds were per person (= _id)
  token: string;
  createdAt: Date;
};

async function collection() {
  const db = await getDb();
  return db.collection<FeedDoc>("calendarFeeds");
}

export async function getFeedToken(userId: string): Promise<string | null> {
  const col = await collection();
  return (await col.findOne({ _id: userId }))?.token ?? null;
}

/** Creates the person's subscription link, or replaces it (the old link stops working). */
export async function rotateFeedToken(userId: string, organizationId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const col = await collection();
  await col.updateOne(
    { _id: userId },
    { $set: { token, organizationId, createdAt: new Date() } },
    { upsert: true },
  );
  return token;
}

/** Whose link a token is: the account and the organization its calendar belongs to. */
export async function feedForToken(token: string): Promise<{ userId: string; organizationId: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const col = await collection();
  const doc = await col.findOne({ token });
  return doc ? { userId: doc._id, organizationId: doc.organizationId ?? doc._id } : null;
}
