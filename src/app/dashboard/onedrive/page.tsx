import { headers } from "next/headers";
import { disconnectOneDrive } from "@/app/dashboard/actions";
import { Card, PageHeader } from "@/components/ui";
import { isConnected } from "@/lib/db/onedrive-connection";
import { requireOwnerId } from "@/lib/db/queries";
import { getAuthorizeUrl, isOneDriveConfigured } from "@/lib/onedrive";

async function getOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function OneDrivePage({
  searchParams,
}: {
  searchParams: Promise<{ onedrive?: string; onedrive_error?: string }>;
}) {
  const params = await searchParams;
  const ownerId = await requireOwnerId();
  const connected = isOneDriveConfigured() && (await isConnected(ownerId));
  const authorizeUrl = isOneDriveConfigured() ? getAuthorizeUrl(ownerId, await getOrigin()) : null;

  return (
    <div>
      <PageHeader title="OneDrive" subtitle="החיבור לאחסון הקבצים של התיקים וההצעות" />

      {params.onedrive === "connected" && (
        <div className="mb-4 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success">
          OneDrive חובר בהצלחה
        </div>
      )}
      {params.onedrive === "error" && (
        <div className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          חיבור OneDrive נכשל{params.onedrive_error ? `: ${params.onedrive_error}` : ""}
        </div>
      )}

      <Card className="max-w-xl p-5">
        <h2 className="text-lg font-bold">OneDrive</h2>

        {connected ? (
          <>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              מחובר
            </span>
            <p className="mt-3 text-sm text-muted">
              התיקיות שהמערכת יוצרת לתיקים שלך נשמרות בתיקיה הייעודית של האפליקציה ב-OneDrive
              שלך.
            </p>
            <form action={disconnectOneDrive} className="mt-3">
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-background"
              >
                נתק את OneDrive
              </button>
            </form>
          </>
        ) : (
          <>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              לא מחובר
            </span>
            <p className="mt-3 text-sm text-muted">
              חיבור ל-OneDrive שלך מאפשר למערכת ליצור תיקיה לכל תיק, בתוך תיקיה ייעודית באחסון
              שלך - לגישה רק לתיקיה הזו, לא לשאר הקבצים שלך.
            </p>
            {authorizeUrl ? (
              <a
                href={authorizeUrl}
                className="mt-3 inline-block rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              >
                התחבר ל-OneDrive
              </a>
            ) : (
              <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-muted">
                תצורת OneDrive חסרה בצד השרת (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
