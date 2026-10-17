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
  work: string;
  fee: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  let xml = await file.async("string");
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
