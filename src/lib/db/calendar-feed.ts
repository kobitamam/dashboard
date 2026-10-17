import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/mongodb";

type FeedDoc = {
  _id: string; // ownerId - one subscription link per organization
  token: string;
  createdAt: Date;
};

async function collection() {
  const db = await getDb();
  return db.collection<FeedDoc>("calendarFeeds");
}

export async function getFeedToken(ownerId: string): Promise<string | null> {
  const col = await collection();
  return (await col.findOne({ _id: ownerId }))?.token ?? null;
}

/** Creates the subscription link, or replaces it (the old link stops working). */
export async function rotateFeedToken(ownerId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const col = await collection();
  await col.updateOne({ _id: ownerId }, { $set: { token, createdAt: new Date() } }, { upsert: true });
  return token;
}

export async function ownerIdForFeedToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const col = await collection();
  return (await col.findOne({ token }))?._id ?? null;
}
