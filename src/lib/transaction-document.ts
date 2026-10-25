import JSZip from "jszip";
import { bettermentTotals, type BettermentStatementInput } from "./betterment-statement";
import { QUOTE_TEMPLATE_BASE64 } from "./quote-template";
import { escapeXml } from "./quote-document";
import { VAT_RATE } from "./vat";

// What every statement's letterhead shows: the dates, the reference and the addressee block.
type LetterValues = {
  hebrewDate: string;
  date: string;
  reference: string; // the case number, e.g. "TA-100/26"
  client: string;
  subject: string;
  parcel: string;
  address: string;
};

export type TransactionDocumentValues = LetterValues & {
  number: string; // the statement's own number, e.g. "TA-100-26/1"
  caseNumber: string;
  lines: { label: string; amount: number }[]; // VAT included
  totalExVat: number;
  vat: number;
  total: number;
  vatPercent: number;
};

const money = (value: number) =>
  `${value.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ש״ח`;

// A paragraph in the template's own style (right-to-left, the letter's font).
function paragraph(
  text: string,
  options: { bold?: boolean; underline?: boolean; spaceBefore?: boolean; size?: number } = {},
) {
  const runStyle =
    `${options.bold ? "<w:b/><w:bCs/>" : ""}${options.underline ? '<w:u w:val="single"/>' : ""}` +
    (options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : "");
  return (
    `<w:p><w:pPr>${options.spaceBefore ? '<w:spacing w:before="120"/>' : ""}<w:rPr>${runStyle}<w:rtl/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:hint="cs"/>${runStyle}<w:rtl/></w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
  );
}

/**
 * Puts a statement's body on the office's own letterhead: the quote template keeps its header, footer,
 * date/reference/addressee block, bank details and signature, and the quote's body (work, fee terms, the
 * client's approval) is replaced. The kept parts are located by their text, so a small edit to the
 * template doesn't break this. `attention` replaces the template's "להלן: ״הלקוח״" line (null keeps it).
 */
async function buildLetter(values: LetterValues, body: string[], attention: string | null): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(Buffer.from(QUOTE_TEMPLATE_BASE64, "base64"));
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("Quote template is missing word/document.xml");

  const xml = await file.async("string");
  const start = xml.indexOf("<w:body>") + "<w:body>".length;
  const end = xml.indexOf("</w:body>");
  const blocks = xml.slice(start, end).match(/<w:p[ >][\s\S]*?<\/w:p>|<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? [];
  const textOf = (block: string) => block.replace(/<[^>]+>/g, "");
  const find = (text: string) => {
    const index = blocks.findIndex((b) => textOf(b).includes(text));
    if (index < 0) throw new Error(`Quote template changed: "${text}" not found`);
    return index;
  };

  // Date, reference, client, subject, parcel, address.
  const addressee = blocks.slice(0, find("לבקשת הלקוח")).flatMap((block) => {
    if (attention === null || !textOf(block).includes("להלן")) return [block];
    return attention ? [paragraph(`לידי ${attention}`)] : [];
  });
  const bank = blocks.slice(find("פרטי חשבון להעברה בנקאית"), find("חתימת מזמין העבודה"));
  const signature = blocks.slice(find("בכבוד רב"));

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
    // split/join rather than replace, so "$&" and friends in user text stay literal.
    document = document.split(placeholder).join(escapeXml(value));
  }
  zip.file("word/document.xml", document);

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** A transaction statement (חשבון עסקה) for the payments that can be collected now. */
export async function buildTransactionDocx(values: TransactionDocumentValues): Promise<Uint8Array> {
  return buildLetter(
    values,
    [
      paragraph(`להלן חשבון עסקה עבור שכר הטרחה בתיק ${values.caseNumber}.`),
      paragraph(`חשבון עסקה מס׳ ${values.number}`, { bold: true, underline: true, spaceBefore: true }),
      ...values.lines.map((line) => paragraph(`${line.label}: ${money(line.amount)} (כולל מע״מ)`)),
      paragraph(`סה״כ לפני מע״מ: ${money(values.totalExVat)}`, { spaceBefore: true }),
      paragraph(`מע״מ (${values.vatPercent}%): ${money(values.vat)}`),
      paragraph(`סה״כ לתשלום: ${money(values.total)}`, { bold: true }),
      paragraph("מסמך זה אינו חשבונית מס. חשבונית מס / קבלה תופק עם קבלת התשלום.", { spaceBefore: true }),
    ],
    null,
  );
}

// ---- the betterment-levy closing statement (גמר חשבון), laid out like the office's own example ----

// A left-to-right mark keeps a minus sign on the left of its digits inside the right-to-left table.
const shekels = (value: number) =>
  value ? `${value < 0 ? "\u200E-" : ""}${Math.abs(value).toLocaleString("he-IL")}${value < 0 ? "\u200E" : ""} ₪` : "";

type Cell = {
  text: string;
  span?: number; // columns the cell covers
  merge?: "restart" | "continue"; // vertically merged with the cells below / above
  bold?: boolean;
  fill?: string; // background, hex
  color?: string; // text color, hex
  align?: "center" | "right";
};

// Column widths (twips) from right to left: address, unit, plan, determining date, then the four levy
// amounts and the saving - together the width of the letter's text.
const COLUMNS = [1000, 540, 1000, 960, 1180, 1180, 1180, 1180, 1200];

function cell({ text, span = 1, merge, bold, fill, color, align = "center" }: Cell, width: number) {
  const runStyle =
    `${bold ? "<w:b/><w:bCs/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}` +
    '<w:sz w:val="16"/><w:szCs w:val="16"/>';
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}` +
    `${merge ? `<w:vMerge${merge === "restart" ? ' w:val="restart"' : ""}/>` : ""}` +
    `${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr><w:bidi/><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/>` +
    `<w:jc w:val="${align === "center" ? "center" : "left"}"/><w:rPr>${runStyle}<w:rtl/></w:rPr></w:pPr>` +
    (text ? `<w:r><w:rPr><w:rFonts w:hint="cs"/>${runStyle}<w:rtl/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>` : "") +
    `</w:p></w:tc>`
  );
}

function row(cells: Cell[]) {
  let column = 0;
  const xml = cells
    .map((c) => {
      const width = COLUMNS.slice(column, column + (c.span ?? 1)).reduce((s, w) => s + w, 0);
      column += c.span ?? 1;
      return cell(c, width);
    })
    .join("");
  return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${xml}</w:tr>`;
}

// A unit's address/plan/date is merged with the rows below that repeat it, as in the office's example.
function mergeState(values: string[], index: number): Cell["merge"] {
  const repeatsAbove = index > 0 && values[index - 1] === values[index];
  const repeatsBelow = index < values.length - 1 && values[index + 1] === values[index];
  return repeatsAbove ? "continue" : repeatsBelow ? "restart" : undefined;
}

function bettermentTable(input: BettermentStatementInput) {
  const totals = bettermentTotals(input);
  const header = "D9D9D9";
  const border = (side: string) => `<w:${side} w:val="single" w:sz="6" w:space="0" w:color="000000"/>`;
  const units = input.units;
  const addresses = units.map((u) => u.address);
  const plans = units.map((u) => u.plan);
  const dates = units.map((u) => u.date);

  const rows = [
    row(
      [
        "כתובת",
        "יחידה",
        "תכנית / הקלות",
        "מועד קובע",
        "היטל השבחה ע״פ שומת ועדה",
        "היטל ועדה צמוד מדד (1)",
        "היטל השבחה ע״פ שמאי מכריע",
        "היטל שמאי מכריע צמוד מדד (1)",
        "חיסכון בהיטל השבחה",
      ].map((text) => ({ text, bold: true, fill: header })),
    ),
    ...units.map((u, i) =>
      row([
        { text: mergeState(addresses, i) === "continue" ? "" : u.address, merge: mergeState(addresses, i) },
        { text: u.unit },
        { text: mergeState(plans, i) === "continue" ? "" : u.plan, merge: mergeState(plans, i) },
        { text: mergeState(dates, i) === "continue" ? "" : u.date, merge: mergeState(dates, i) },
        { text: shekels(Math.round(u.committee)) },
        { text: shekels(Math.round(u.committeeIndexed)) },
        { text: shekels(Math.round(u.arbitrator)) },
        { text: shekels(Math.round(u.arbitratorIndexed)) },
        { text: shekels(totals.savings[i]) },
      ]),
    ),
    row([
      { text: "סה״כ", span: 4, bold: true, fill: header },
      { text: "", fill: header },
      { text: shekels(totals.committeeIndexed), bold: true, fill: header },
      { text: "", fill: header },
      { text: shekels(totals.arbitratorIndexed), bold: true, fill: header },
      { text: shekels(totals.saving), bold: true, fill: header },
    ]),
    row([{ text: "סה״כ חיסכון", span: 8, align: "right" }, { text: shekels(totals.saving) }]),
    row([
      { text: "שכ״ט מהחיסכון בהיטל השבחה", span: 7, align: "right" },
      { text: `${input.feePercent}%` },
      { text: shekels(totals.fee) },
    ]),
    ...(input.offset > 0
      ? [
          row([
            { text: "קיזוז תשלום בגין פתיחת תיק", span: 8, align: "right" },
            { text: shekels(-Math.round(input.offset)), color: "C00000" },
          ]),
        ]
      : []),
    row([
      { text: "סה״כ שכ״ט לתשלום כולל מע״מ", span: 7, bold: true, fill: "FFFF00", align: "right" },
      { text: `${Math.round((1 + VAT_RATE) * 100)}%`, bold: true, fill: "FFFF00" },
      { text: shekels(totals.total), bold: true, fill: "FFFF00" },
    ]),
  ];

  return (
    `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${COLUMNS.reduce((s, w) => s + w, 0)}" w:type="dxa"/>` +
    `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar>` +
    `</w:tblPr><w:tblGrid>${COLUMNS.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`
  );
}

/** The closing statement of a betterment-levy case (גמר חשבון): the saving, unit by unit, and the fee on it. */
export async function buildBettermentDocx(
  values: LetterValues & { number: string },
  input: BettermentStatementInput,
): Promise<Uint8Array> {
  return buildLetter(
    values,
    [
      paragraph(
        "בהמשך לשירות שניתן לכם ע״י משרדנו בהליך שמאות מכרעת, להלן חישוב שכר הטרחה בגין החיסכון בהיטל השבחה.",
      ),
      paragraph(`חשבון עסקה מס׳ ${values.number}`, { bold: true, underline: true, spaceBefore: true }),
      bettermentTable(input),
      paragraph("(1) הצמדה כמפורט בסעיף 9 לתוספת השלישית לחוק התכנון והבנייה.", { size: 16 }),
      paragraph("מסמך זה אינו חשבונית מס. חשבונית מס / קבלה תופק עם קבלת התשלום.", { spaceBefore: true }),
    ],
    input.attention.trim(),
  );
}
