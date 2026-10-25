import JSZip from "jszip";
import { QUOTE_TEMPLATE_BASE64 } from "./quote-template";
import { escapeXml } from "./quote-document";

export type TransactionDocumentValues = {
  hebrewDate: string;
  date: string;
  reference: string; // e.g. "TA-100/26 · חשבון עסקה 1"
  number: string; // the statement's own number, e.g. "TA-100-26/1"
  caseNumber: string;
  client: string;
  subject: string;
  parcel: string;
  address: string;
  lines: { label: string; amount: number }[]; // VAT included
  totalExVat: number;
  vat: number;
  total: number;
  vatPercent: number;
};

const money = (value: number) =>
  `${value.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ש״ח`;

// A paragraph in the template's own style (right-to-left, the letter's font).
function paragraph(text: string, options: { bold?: boolean; underline?: boolean; spaceBefore?: boolean } = {}) {
  const runStyle = `${options.bold ? "<w:b/><w:bCs/>" : ""}${options.underline ? '<w:u w:val="single"/>' : ""}`;
  return (
    `<w:p><w:pPr>${options.spaceBefore ? '<w:spacing w:before="120"/>' : ""}<w:rPr>${runStyle}<w:rtl/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:hint="cs"/>${runStyle}<w:rtl/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
  );
}

/**
 * Builds a transaction statement (חשבון עסקה) on the office's own letterhead: the quote template keeps
 * its header, footer, date/reference/addressee block, bank details and signature, and the quote's
 * body (work, fee terms, the client's approval) is replaced by the amounts to pay.
 */
export async function buildTransactionDocx(values: TransactionDocumentValues): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(Buffer.from(QUOTE_TEMPLATE_BASE64, "base64"));
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Quote template is missing word/document.xml");

  const xml = await file.async("string");
  const start = xml.indexOf("<w:body>") + "<w:body>".length;
  const end = xml.indexOf("</w:body>");
  const blocks = xml.slice(start, end).match(/<w:p[ >][\s\S]*?<\/w:p>|<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? [];
  const find = (text: string) => {
    const index = blocks.findIndex((b) => b.replace(/<[^>]+>/g, "").includes(text));
    if (index < 0) throw new Error(`Quote template changed: "${text}" not found`);
    return index;
  };

  // The template's parts that are kept, located by their text so a small edit to it doesn't break this.
  const addressee = blocks.slice(0, find("לבקשת הלקוח")); // date, reference, client, subject, parcel, address
  const bank = blocks.slice(find("פרטי חשבון להעברה בנקאית"), find("חתימת מזמין העבודה"));
  const signature = blocks.slice(find("בכבוד רב"));

  const body = [
    paragraph(`להלן חשבון עסקה עבור שכר הטרחה בתיק ${values.caseNumber}.`),
    paragraph(`חשבון עסקה מס׳ ${values.number}`, { bold: true, underline: true, spaceBefore: true }),
    ...values.lines.map((line) => paragraph(`${line.label}: ${money(line.amount)} (כולל מע״מ)`)),
    paragraph(`סה״כ לפני מע״מ: ${money(values.totalExVat)}`, { spaceBefore: true }),
    paragraph(`מע״מ (${values.vatPercent}%): ${money(values.vat)}`),
    paragraph(`סה״כ לתשלום: ${money(values.total)}`, { bold: true }),
    paragraph("מסמך זה אינו חשבונית מס. חשבונית מס / קבלה תופק עם קבלת התשלום.", { spaceBefore: true }),
  ];

  let document = xml.slice(0, start) + [...addressee, ...body, ...bank, ...signature].join("") + xml.slice(end);
  const replacements: Record<string, string> = {
    "{{HEBDATE}}": values.hebrewDate,
    "{{DATE}}": values.date,
    "{{REF}}": values.reference,
    "{{CLIENT}}": values.client,
    "{{SUBJECT}}": values.subject,
    "{{PARCEL}}": values.parcel,
    "{{ADDRESS}}": values.address,
  };
  for (const [placeholder, value] of Object.entries(replacements)) {
    document = document.split(placeholder).join(escapeXml(value));
  }
  zip.file("word/document.xml", document);

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
