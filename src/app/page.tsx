import Link from "next/link";

const features = [
  {
    title: "ריכוז לקוחות",
    description: "כל הלקוחות, פרטי הקשר וההיסטוריה שלהם במקום אחד, מסונכרן ומעודכן.",
    icon: UsersIcon,
  },
  {
    title: "מעקב תיקים",
    description: "לוח תיקים חיה לפי סטטוס - מה בתהליך, מה דחוף ומה ממתין למידע מהלקוח.",
    icon: FolderIcon,
  },
  {
    title: "גבייה",
    description: "מעקב חשבוניות ותשלומים, עם התראה אוטומטית על חובות בפיגור.",
    icon: WalletIcon,
  },
  {
    title: "התראות חכמות",
    description: "המערכת מתריעה על דדליינים מתקרבים, תשלומים שלא התקבלו ומסמכים חסרים.",
    icon: BellIcon,
  },
  {
    title: "יומן ומייל",
    description: "אינטגרציה עם Google Calendar ו-Gmail - כל הפגישות והמיילים מקושרים לתיקים.",
    icon: CalendarIcon,
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-6 py-5 lg:px-16">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-cyan to-brand-blue text-lg font-extrabold text-white shadow-lg shadow-brand-blue/20">
            TA
          </div>
          <div>
            <p className="text-base font-bold leading-tight text-foreground">TA-Estate</p>
            <p className="text-xs text-muted">שמאות מקרקעין</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-brand-cyan-light"
          >
            כניסה
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            הרשמה
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-6 pb-16 pt-10 lg:px-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full bg-brand-cyan-light px-4 py-1.5 text-sm font-semibold text-brand-blue">
              מערכת ניהול לשמאי מקרקעין
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
              כל המשרד שלך, במקום אחד
            </h1>
            <p className="mt-4 text-lg text-muted">
              TA-Estate מרכזת עבורך לקוחות, תיקים, גבייה, יומן ומייל - כדי שתתמקד בשומה ולא
              בניהול.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href="/register"
                className="rounded-xl bg-brand-blue px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-blue/20 transition hover:opacity-90"
              >
                התחל בחינם
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-border bg-surface px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-background"
              >
                כניסה למערכת
              </Link>
            </div>
          </div>
        </section>

        <section className="px-6 pb-20 lg:px-16">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-2xl border border-border bg-surface p-6 shadow-sm shadow-black/[0.02]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-cyan-light text-brand-blue">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted">{f.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted lg:px-16">
        TA-Estate © {new Date().getFullYear()} · תמאם אברהם, שמאי מקרקעין מוסמך
      </footer>
    </div>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l1.6 2h8a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17.5V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="6.5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="14.3" r="1.2" fill="currentColor" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M6 10.5a6 6 0 1 1 12 0c0 3 1 4.5 1.8 5.5H4.2C5 15 6 13.5 6 10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
