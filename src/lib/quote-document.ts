import JSZip from "jszip";
import { QUOTE_TEMPLATE_BASE64 } from "./quote-template";

export type QuoteDocumentValues = {
  hebrewDate: string;
  date: string;
  reference: string;
  client: string;
  subject: string;
  parcel: string;
  address: string;
  // With more than one property, each one's line ("גוש ... - כתובת"); replaces the parcel and address lines.
  properties?: string[];
  work: string;
  fee: string;
};

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A letter about several properties lists one line per property: the template's {{PARCEL}} paragraph is
 * repeated for each (keeping its formatting) and its {{ADDRESS}} paragraph, now part of each line, is dropped.
 */
export function expandPropertyLines(xml: string, lines: string[] | undefined) {
  if (!lines || lines.length < 2) return xml;
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const parcel = paragraphs.find((p) => p.includes("{{PARCEL}}"));
  const address = paragraphs.find((p) => p.includes("{{ADDRESS}}"));
  if (!parcel) return xml;
  const repeated = lines.map((line) => parcel.split("{{PARCEL}}").join(escapeXml(line))).join("");
  let result = xml.replace(parcel, () => repeated);
  if (address) result = result.replace(address, () => "");
  return result;
}

/** Fills the office's quote template and returns the .docx bytes. */
export async function buildQuoteDocx(values: QuoteDocumentValues): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(Buffer.from(QUOTE_TEMPLATE_BASE64, "base64"));
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Quote template is missing word/document.xml");

  const replacements: Record<string, string> = {
    "{{HEBDATE}}": values.hebrewDate,
    "{{DATE}}": values.date,
    "{{REF}}": values.reference,
    "{{CLIENT}}": values.client,
    "{{SUBJECT}}": values.subject,
    "{{PARCEL}}": values.parcel,
    "{{ADDRESS}}": values.address,
    "{{WORK}}": values.work,
    "{{FEE}}": values.fee,
  };

  let xml = expandPropertyLines(await file.async("string"), values.properties);
  for (const [placeholder, value] of Object.entries(replacements)) {
    // split/join rather than replace, so "$&" and friends in user text stay literal.
    xml = xml.split(placeholder).join(escapeXml(value));
  }
  zip.file("word/document.xml", xml);

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

const hebrewDateFormat = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const gregorianDateFormat = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// Quote dates are stored as midnight UTC of the Israeli calendar day, so they
// are formatted in UTC to show that same day.
export function formatQuoteDates(date: Date) {
  return { hebrewDate: hebrewDateFormat.format(date), date: gregorianDateFormat.format(date) };
}
