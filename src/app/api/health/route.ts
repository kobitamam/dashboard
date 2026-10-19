import { NextResponse } from "next/server";
import { databaseName, getDb } from "@/lib/mongodb";
import { isOneDriveConfigured } from "@/lib/onedrive";

export const dynamic = "force-dynamic";

// Connection errors can echo back the URI, which carries the password.
function redact(message: string) {
  return message.replace(/\/\/[^@\s]+@/g, "//***:***@");
}

export async function GET() {
  const mongoUriConfigured = !!process.env.MONGODB_URI;
  const authSecretConfigured = !!(
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  );

  const checks: Record<string, unknown> = {
    mongoUriConfigured,
    authSecretConfigured,
    database: mongoUriConfigured ? databaseName() : null,
    // Optional: OneDrive connect button is hidden, not broken, without this.
    oneDriveConfigured: isOneDriveConfigured(),
  };

  if (!mongoUriConfigured) {
    checks.database_connection = "לא נבדק - MONGODB_URI חסר";
  } else {
    try {
      const db = await getDb();
      await db.command({ ping: 1 });
      checks.database_connection = "ok";
      // Where the server and the database run, and the time of one round trip between them:
      // every page makes several, so a server far from the database makes the whole app slow.
      const started = Date.now();
      const hello = await db.command({ hello: 1 });
      checks.database_round_trip_ms = Date.now() - started;
      checks.database_region = hello.tags?.region ?? null;
      checks.database_provider = hello.tags?.provider ?? null;
      checks.server_region = process.env.VERCEL_REGION ?? null;
    } catch (err) {
      checks.database_connection = "failed";
      checks.database_error = redact(
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const ok =
    mongoUriConfigured &&
    authSecretConfigured &&
    checks.database_connection === "ok";

  // Always 200: the login page reads this to explain a failure, and a non-2xx
  // here would just add console noise resembling the fault being diagnosed.
  return NextResponse.json({ ok, ...checks });
}
