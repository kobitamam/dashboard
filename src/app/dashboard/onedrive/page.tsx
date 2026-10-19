import { disconnectOneDrive } from "@/app/dashboard/actions";
import { Card, PageHeader } from "@/components/ui";
import { isConnected } from "@/lib/db/onedrive-connection";
import { currentRole, requireOwnerId } from "@/lib/db/queries";
import { getAuthorizeUrl, isOneDriveConfigured } from "@/lib/onedrive";
import { requestOrigin } from "@/lib/origin";

// The Mac shortcut's script. It finds the synced "מסמכי תיקים" folder wherever OneDrive keeps it
// (the owner's app folder, a shared "TA-Estate Dashboard", or a shared "מסמכי תיקים"), so the same
// text works on every Mac, and it accepts only a plain case number (TA-100-26).
const MAC_SCRIPT = `n="$1"; [ -z "$n" ] && n="$(pbpaste)"
case "$n" in ""|*[!A-Za-z0-9-]*) exit 0;; esac
for d in "$HOME"/Library/CloudStorage/*; do
  for f in "$d/Apps/TA-Estate Dashboard/מסמכי תיקים" "$d/TA-Estate Dashboard/מסמכי תיקים" "$d/מסמכי תיקים"; do
    [ -d "$f/$n" ] && { open "$f/$n"; exit 0; }
  done
done`;

export default async function OneDrivePage({
  searchParams,
}: {
  searchParams: Promise<{ onedrive?: string; onedrive_error?: string }>;
}) {
  const [params, ownerId, role] = await Promise.all([searchParams, requireOwnerId(), currentRole()]);
  // The connection is the office's own OneDrive, shared by everyone; only a partner manages it.
  const isPartner = role === "partner";
  const connected = isOneDriveConfigured() && (await isConnected(ownerId));
  const authorizeUrl =
    isPartner && isOneDriveConfigured() ? getAuthorizeUrl(ownerId, await requestOrigin()) : null;

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
        <h2 className="text-lg font-bold">OneDrive של המשרד</h2>

        {connected ? (
          <>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              מחובר
            </span>
            <p className="mt-3 text-sm text-muted">
              התיקיות שהמערכת יוצרת לתיקים נשמרות בתיקייה הייעודית של האפליקציה ב-OneDrive של המשרד.
            </p>
            {isPartner && (
              <form action={disconnectOneDrive} className="mt-3">
                <button
                  type="submit"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-background"
                >
                  נתק את OneDrive
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              לא מחובר
            </span>
            {isPartner ? (
              <>
                <p className="mt-3 text-sm text-muted">
                  חיבור ל-OneDrive של המשרד מאפשר למערכת ליצור תיקייה לכל תיק, בתוך תיקייה ייעודית - עם גישה רק
                  לתיקייה הזו, לא לשאר הקבצים. בחלון של מיקרוסופט בחר את החשבון של המשרד.
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
            ) : (
              <p className="mt-3 text-sm text-muted">החיבור נעשה על ידי שותף, פעם אחת לכל המשרד.</p>
            )}
          </>
        )}
      </Card>

      <Card className="mt-6 max-w-xl p-5">
        <h2 className="text-lg font-bold">פתיחת תיקיית תיק במחשב</h2>
        <p className="mt-2 text-sm text-muted">
          הכפתור &quot;פתח ב-Finder / בתיקייה&quot; בכרטיס התיק פותח את התיקייה של התיק בתוך התיקייה המסונכרנת
          במחשב, במקום בדפדפן. צריך לעשות התקנה חד-פעמית בכל מחשב.
        </p>

        <h3 className="mt-4 text-sm font-bold">Windows</h3>
        <ol className="mt-1 list-decimal space-y-1 pr-5 text-sm text-muted">
          <li>
            ודא שהתיקייה המשותפת <b>מסמכי תיקים</b> מסונכרנת אצלך: בהזמנה ששותפה איתך ב-OneDrive בחר
            &quot;הוסף קיצור דרך אל הקבצים שלי&quot;, והיא תופיע בתיקיית ה-OneDrive שלך.
          </li>
          <li>
            <a href="/api/windows-setup" className="font-semibold text-brand-blue hover:underline">
              הורד את קובץ ההתקנה
            </a>{" "}
            ולחץ עליו פעמיים. אשר את ההודעות של Windows (&quot;כן&quot;).
          </li>
          <li>
            חזור למערכת ולחץ &quot;פתח בתיקייה&quot; בכרטיס תיק. בפעם הראשונה הדפדפן ישאל אם לאפשר, ואפשר לסמן
            &quot;תמיד&quot;.
          </li>
        </ol>

        <h3 className="mt-4 text-sm font-bold">Mac</h3>
        <ol className="mt-1 list-decimal space-y-1 pr-5 text-sm text-muted">
          <li>
            פתח את האפליקציה &quot;קיצורי דרך&quot; (Shortcuts) וצור קיצור חדש בשם <b dir="ltr">OpenCase</b>, באותיות
            אלה בדיוק.
          </li>
          <li>
            הוסף פעולה &quot;הפעלת תסריט מעטפת&quot; (בהעדפות של קיצורי דרך ← מתקדם, יש לאפשר הפעלת תסריטים), ובתיבת
            הסקריפט הדבק את הטקסט הזה כמו שהוא. הוא מוצא לבד את התיקייה <b>מסמכי תיקים</b> במחשב, כך שהוא זהה בכל
            מחשב Mac:
            <pre dir="ltr" className="mt-1 overflow-x-auto rounded bg-background px-2 py-1 text-left text-[11px]">
              {MAC_SCRIPT}
            </pre>
          </li>
          <li>בשדה &quot;העברת קלט&quot; בחר &quot;כארגומנטים&quot;.</li>
          <li>
            בפעם הראשונה הדפדפן ישאל אם לפתוח את &quot;קיצורי דרך&quot;. אשר, ואפשר לסמן &quot;תמיד&quot;.
          </li>
        </ol>
      </Card>
    </div>
  );
}
