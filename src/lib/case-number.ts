import { getDb } from "@/lib/mongodb";

type CounterDoc = {
  _id: string; // `${ownerId}:${prefix}:${year}`
  value: number;
};

// Starts at 100 and resets every calendar year, matching the TA-100/26 format
// (prefix, sequence, 2-digit year the case/quote was opened).
const START_AT = 99;

async function nextSequence(ownerId: string, prefix: string, year: number): Promise<number> {
  const db = await getDb();
  const counters = db.collection<CounterDoc>("numberCounters");
  const key = `${ownerId}:${prefix}:${year}`;

  // $inc on a field that doesn't exist yet initializes it at 0 then applies
  // the increment, so the very first call for a given owner/prefix/year
  // atomically creates the counter at 1 - no separate "does it exist" check.
  const result = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return result!.value;
}

function twoDigitYear(date: Date) {
  return String(date.getFullYear() % 100).padStart(2, "0");
}

/** Formats e.g. "TA-100/26" - prefix, sequence starting at 100, 2-digit year. */
export async function nextNumber(ownerId: string, prefix: "TA" | "Q", openedAt: Date): Promise<string> {
  const year = openedAt.getFullYear();
  const seq = (await nextSequence(ownerId, prefix, year)) + START_AT;
  return `${prefix}-${seq}/${twoDigitYear(openedAt)}`;
}
