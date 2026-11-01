import { formatParcel } from "@/lib/format";
import type { Case, Client } from "@/lib/types";

/** What the header search box looks through: one entry per case and per client. */
export type SearchEntry = {
  kind: "case" | "client";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  haystack: string;
};

// Lower case, without the invisible direction/joiner marks that text pasted from Word or a website
// carries inside words (a name with one of them would otherwise not match what is typed).
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g, "")
    .trim();

/** Every word typed must appear somewhere in the text (in any order). */
export function matchesQuery(haystack: string, query: string) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = normalize(haystack);
  return words.every((word) => text.includes(word));
}

export function caseHaystack(c: Case) {
  return [
    c.caseNumber,
    c.clientName,
    c.address,
    c.city,
    c.description,
    c.type,
    c.clientEmail,
    c.clientPhone,
    formatParcel(c.block, c.parcel, c.subParcel),
    c.block,
    c.parcel,
  ].join(" ");
}

export function clientHaystack(c: Client) {
  return [c.name, c.phone, c.email, c.propertyType].join(" ");
}

export function buildSearchIndex(cases: Case[], clients: Client[]): SearchEntry[] {
  return [
    ...cases.map((c) => ({
      kind: "case" as const,
      id: c.id,
      title: `${c.caseNumber} · ${c.clientName}`,
      subtitle: [c.address, c.city, formatParcel(c.block, c.parcel, c.subParcel)]
        .filter(Boolean)
        .join(" · "),
      href: `/dashboard/cases?search=${encodeURIComponent(c.caseNumber)}`,
      haystack: caseHaystack(c),
    })),
    ...clients.map((c) => ({
      kind: "client" as const,
      id: c.id,
      title: c.name,
      subtitle: [c.phone, c.email].filter(Boolean).join(" · "),
      href: `/dashboard/clients?search=${encodeURIComponent(c.name)}`,
      haystack: clientHaystack(c),
    })),
  ];
}
