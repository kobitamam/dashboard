import { getDb } from "@/lib/mongodb";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { refreshTokens, type TokenSet } from "@/lib/onedrive";

type ConnectionDoc = {
  _id: string; // ownerId - one connection per account, so it doubles as the key.
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  expiresAt: Date;
  scope: string;
  connectedAt: Date;
  updatedAt: Date;
};

async function collection() {
  const db = await getDb();
  return db.collection<ConnectionDoc>("oneDriveConnections");
}

export async function saveConnection(ownerId: string, tokens: TokenSet) {
  const col = await collection();
  const now = new Date();
  await col.updateOne(
    { _id: ownerId },
    {
      $set: {
        accessToken: encryptSecret(tokens.accessToken),
        refreshToken: encryptSecret(tokens.refreshToken),
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        updatedAt: now,
      },
      $setOnInsert: { connectedAt: now },
    },
    { upsert: true },
  );
}

export async function isConnected(ownerId: string): Promise<boolean> {
  const col = await collection();
  return (await col.countDocuments({ _id: ownerId })) > 0;
}

export async function disconnect(ownerId: string) {
  const col = await collection();
  await col.deleteOne({ _id: ownerId });
}

const REFRESH_SKEW_MS = 5 * 60 * 1000;

/** Returns a usable access token, transparently refreshing it if it's stale. */
export async function getValidAccessToken(ownerId: string): Promise<string | null> {
  const col = await collection();
  const doc = await col.findOne({ _id: ownerId });
  if (!doc) return null;

  if (doc.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) {
    return decryptSecret(doc.accessToken);
  }

  try {
    const fresh = await refreshTokens(decryptSecret(doc.refreshToken));
    await saveConnection(ownerId, fresh);
    return fresh.accessToken;
  } catch (err) {
    console.error("Failed to refresh OneDrive token:", err);
    return null;
  }
}
