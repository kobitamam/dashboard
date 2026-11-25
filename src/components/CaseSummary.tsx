import Link from "next/link";
import { formatParcel } from "@/lib/format";
import type { Case } from "@/lib/types";

/**
 * A case at a glance - the same details as its folded card on the cases board: client, case number,
 * address (or גוש/חלקה) and type. Links to the case, which opens unfolded there.
 */
export default function CaseSummary({ c }: { c: Case }) {
  const place = [c.address, c.city].filter(Boolean).join(", ") || formatParcel(c.block, c.parcel, c.subParcel);
  return (
    <Link
      href={`/dashboard/cases?search=${encodeURIComponent(c.caseNumber)}`}
      className="block rounded-xl border border-border bg-background/60 px-3 py-2 transition hover:border-brand-cyan"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{c.clientName}</p>
        <span className="shrink-0 font-mono text-[11px] text-muted">{c.caseNumber}</span>
      </div>
      {place && <p className="mt-0.5 text-xs text-muted">{place}</p>}
      {c.type && <p className="mt-0.5 text-xs text-muted">{c.type}</p>}
    </Link>
  );
}
