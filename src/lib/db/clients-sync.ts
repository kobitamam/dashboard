import { casesRepo, clientsRepo } from "@/lib/db/entities";
import { getDb } from "@/lib/mongodb";

/** Names are compared without case, surrounding spaces or repeated spaces. */
export const clientKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

type Contact = { name: string; phone?: string; email?: string };

/**
 * Makes sure every client name has a record in the clients list, adding the missing
 * ones (an existing client is never duplicated or changed). Used when a case is
 * opened, and by the clients page so cases opened earlier show up too.
 */
export async function ensureClients(ownerId: string, contacts: Contact[]) {
  const existing = new Set((await clientsRepo.list(ownerId)).map((c) => clientKey(c.name)));
  let added = 0;

  for (const contact of contacts) {
    const name = contact.name.trim().replace(/\s+/g, " ");
    const key = clientKey(name);
    if (!name || existing.has(key)) continue;

    await clientsRepo.insert(ownerId, {
      name,
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      propertyType: "",
      status: "פעיל",
      notes: "",
    });
    existing.add(key);
    added++;
  }
  return added;
}

/**
 * One-time catch-up for cases opened before cases fed the clients list: adds a client
 * for each of them. It runs once per organization, so a client the user deletes later
 * does not come back.
 */
const synced = new Set<string>();

export async function syncClientsFromCases(ownerId: string) {
  // Remembered per server instance too, so the clients page doesn't ask the database every time.
  if (synced.has(ownerId)) return 0;
  const db = await getDb();
  try {
    await db.collection<{ _id: string }>("migrations").insertOne({ _id: `clients-from-cases:${ownerId}` });
  } catch {
    synced.add(ownerId);
    return 0; // already done (duplicate key)
  }
  synced.add(ownerId);

  const cases = await casesRepo.list(ownerId, { createdAt: 1 });
  return ensureClients(
    ownerId,
    cases.map((c) => ({ name: c.clientName, phone: c.clientPhone, email: c.clientEmail })),
  );
}
