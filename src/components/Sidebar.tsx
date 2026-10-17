"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "דשבורד", icon: HomeIcon },
  { href: "/dashboard/clients", label: "לקוחות", icon: UsersIcon },
  { href: "/dashboard/cases", label: "מעקב תיקים", icon: FolderIcon },
  { href: "/dashboard/attendance", label: "שעון נוכחות", icon: ClockIcon },
  { href: "/dashboard/alerts", label: "התראות חכמות", icon: BellIcon },
  { href: "/dashboard/calendar", label: "יומן", icon: CalendarIcon },
  { href: "/dashboard/days", label: "מחשבון ימים", icon: CalculatorIcon },
  { href: "/dashboard/onedrive", label: "OneDrive", icon: CloudIcon },
];

const partnerOnlyNavItems = [
  { href: "/dashboard/quotes", label: "הצעות מחיר", icon: QuoteIcon },
  { href: "/dashboard/billing", label: "גבייה", icon: WalletIcon },
  { href: "/dashboard/team", label: "צוות", icon: TeamIcon },
];

export default function Sidebar({
  onNavigate,
  userName,
  alertCount,
  isPartner,
}: {
  onNavigate?: () => void;
  userName: string;
  alertCount: number;
  isPartner: boolean;
}) {
  const pathname = usePathname();
  const initials = userName.slice(0, 2);
  const items = isPartner ? [...navItems, ...partnerOnlyNavItems] : navItems;

  return (
    <div className="flex h-full flex-col bg-brand-blue-dark text-white">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-cyan to-brand-blue text-lg font-extrabold shadow-lg shadow-black/20">
          TA
        </div>
        <div>
          <p className="text-base font-bold leading-tight">TA-Estate</p>
          <p className="text-xs text-white/60">שמאות מקרקעין</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white text-brand-blue-dark shadow-sm"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={`h-5 w-5 ${active ? "text-brand-blue" : "text-brand-cyan"}`}
                />
                {item.label}
              </span>
              {item.href === "/alerts" && alertCount > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    active
                      ? "bg-brand-blue-dark/10 text-brand-blue-dark"
                      : "bg-brand-cyan text-brand-blue-dark"
                  }`}
                >
                  {alertCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-4 rounded-xl bg-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-cyan text-sm font-bold text-brand-blue-dark">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{userName}</p>
            <p className="truncate text-xs text-white/60">שמאי מקרקעין מוסמך</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 10.5 12 3l9 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 20c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="17" cy="8.5" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15.8 14.7c2.4.3 4.2 2.4 4.2 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6.5 3.5h8l4 4V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 12.5h7M8.5 16h4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l1.6 2h8a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17.5V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="3"
        y="6.5"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="14.3" r="1.2" fill="currentColor" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M6 10.5a6 6 0 1 1 12 0c0 3 1 4.5 1.8 5.5H4.2C5 15 6 13.5 6 10.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 18.5a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="8.5" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 19.5c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14.5 14.3c2.6.2 4.5 2.6 4.5 5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3.5 10h17M8 3.5v4M16 3.5v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.6 4.7 4.7 0 0 1 17.5 18H7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalculatorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 7.5h7M8.5 12h1M12 12h1M15.5 12h0M8.5 16h1M12 16h1M15.5 16h0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
