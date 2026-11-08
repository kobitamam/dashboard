import JSZip from "jszip";
import { toIsraelParts } from "@/lib/format";
import type { AttendanceEntry } from "@/lib/types";

/** The hours of one entry; one still open counts until now. */
export function entryHours(entry: AttendanceEntry, now = Date.now()) {
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : now;
  return (end - new Date(entry.clockIn).getTime()) / 3_600_000;
}

/** The month (by Israel's calendar) an entry belongs to: "2026-11". */
export const entryMonth = (entry: AttendanceEntry) => toIsraelParts(entry.clockIn).date.slice(0, 7);

export const currentMonth = () => toIsraelParts(new Date()).date.slice(0, 7);

export const isMonth = (value: string | undefined): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

/** "נובמבר 2026". */
export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

export type Person = { id: string; name: string };

/** Each person's hours and working days in the given entries (closed entries only), in the order of `people`. */
export function totalsByPerson(entries: AttendanceEntry[], people: Person[]) {
  return people
    .map((person) => {
      const own = entries.filter((e) => e.userId === person.id && e.clockOut);
      return {
        ...person,
        hours: own.reduce((sum, e) => sum + entryHours(e), 0),
        days: new Set(own.map((e) => toIsraelParts(e.clockIn).date)).size,
        open: entries.some((e) => e.userId === person.id && !e.clockOut),
      };
    })
    .filter((t) => t.days > 0 || t.open);
}

// ---------- Excel (.xlsx), written by hand: a few XML files in a zip ----------

const escapeXml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!).replace(
    // Characters XML 1.0 does not allow (e.g. pasted control marks).
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
    "",
  );

// Style ids, matching cellXfs in STYLES below.
const S = { text: 0, header: 1, date: 2, time: 3, duration: 4, hours: 5, title: 6, totalDuration: 7, totalHours: 8, bold: 9 };

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="4"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/><numFmt numFmtId="166" formatCode="[h]:mm"/><numFmt numFmtId="167" formatCode="0.00"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE4F7FB"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color auto="1"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="167" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="166" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="167" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>
</cellXfs>
</styleSheet>`;

type Cell = { text: string; style?: number } | { num: number; style: number } | null;

const column = (i: number) => String.fromCharCode(65 + i); // A..Z is plenty here

function sheetXml(rows: Cell[][], widths: number[]) {
  const body = rows
    .map((cells, r) => {
      const xml = cells
        .map((cell, c) => {
          if (!cell) return "";
          const ref = `${column(c)}${r + 1}`;
          if ("num" in cell) return `<c r="${ref}" s="${cell.style}"><v>${cell.num}</v></c>`;
          return `<c r="${ref}" s="${cell.style ?? S.text}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.text)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${xml}</row>`;
    })
    .join("");
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}

// Excel keeps a date as days since 30.12.1899 and a time as a fraction of a day.
const DAY_MS = 86_400_000;
function excelDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / DAY_MS;
}
function excelTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h * 60 + m) / 1440;
}
const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;
// Hours as a fraction of a day, in whole minutes (a fraction cut short would show 08:00 as 07:59).
const dayFraction = (hours: number) => Math.round(hours * 60) / 1440;

const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "UTC" });

function personSheet(person: Person, entries: AttendanceEntry[], month: string) {
  const own = entries.filter((e) => e.userId === person.id).sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  const rows: Cell[][] = [
    [{ text: `דוח שעות - ${person.name} - ${monthLabel(month)}`, style: S.title }],
    [],
    ["תאריך", "יום", "כניסה", "יציאה", "משך (שעות:דקות)", "שעות (עשרוני)", "הערות"].map((text) => ({ text, style: S.header })),
  ];
  let total = 0;
  for (const e of own) {
    const start = toIsraelParts(e.clockIn);
    const end = e.clockOut ? toIsraelParts(e.clockOut) : null;
    const hours = e.clockOut ? entryHours(e) : 0;
    total += hours;
    const notes = [
      !e.clockOut ? "לא הוחתמה יציאה" : "",
      e.clockOut && end && end.date !== start.date ? `יציאה ב-${end.date.split("-").reverse().join("/")}` : "",
      ...e.edits.map((edit) => `שונה ידנית ע״י ${edit.byName}: ${edit.reason}`),
    ].filter(Boolean);
    rows.push([
      { num: excelDate(start.date), style: S.date },
      { text: weekday.format(new Date(`${start.date}T00:00:00Z`)) },
      { num: excelTime(start.time), style: S.time },
      end ? { num: excelTime(end.time), style: S.time } : { text: "-" },
      e.clockOut ? { num: dayFraction(hours), style: S.duration } : null,
      e.clockOut ? { num: round(hours, 2), style: S.hours } : null,
      { text: notes.join(" | ") },
    ]);
  }
  rows.push([
    { text: "סה״כ", style: S.bold },
    { text: `${new Set(own.filter((e) => e.clockOut).map((e) => toIsraelParts(e.clockIn).date)).size} ימי עבודה`, style: S.bold },
    { text: "", style: S.bold },
    { text: "", style: S.bold },
    { num: dayFraction(total), style: S.totalDuration },
    { num: round(total, 2), style: S.totalHours },
    { text: "", style: S.bold },
  ]);
  return sheetXml(rows, [13, 12, 9, 9, 17, 14, 60]);
}

function summarySheet(people: Person[], entries: AttendanceEntry[], month: string) {
  const totals = totalsByPerson(entries, people);
  const rows: Cell[][] = [
    [{ text: `דוח שעות - כל הצוות - ${monthLabel(month)}`, style: S.title }],
    [],
    ["שם", "ימי עבודה", "משך (שעות:דקות)", "שעות (עשרוני)"].map((text) => ({ text, style: S.header })),
    ...totals.map((t): Cell[] => [
      { text: t.name },
      { num: t.days, style: S.text },
      { num: dayFraction(t.hours), style: S.duration },
      { num: round(t.hours, 2), style: S.hours },
    ]),
  ];
  const sum = totals.reduce((s, t) => s + t.hours, 0);
  rows.push([
    { text: "סה״כ", style: S.bold },
    { text: "", style: S.bold },
    { num: dayFraction(sum), style: S.totalDuration },
    { num: round(sum, 2), style: S.totalHours },
  ]);
  return sheetXml(rows, [24, 12, 17, 14]);
}

// A sheet name: at most 31 characters, none of []:*?/\ and unique in the workbook.
function sheetNames(names: string[]) {
  const used = new Set<string>();
  return names.map((name) => {
    const base = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 28) || "גיליון";
    let candidate = base;
    for (let i = 2; used.has(candidate); i++) candidate = `${base} ${i}`;
    used.add(candidate);
    return candidate;
  });
}

/**
 * The hours report of one month as an Excel workbook (right-to-left): for the whole team a summary
 * sheet and then a sheet per person; for one person just their sheet. `entries` are that month's.
 */
export async function attendanceWorkbook(entries: AttendanceEntry[], people: Person[], month: string, single: boolean) {
  const withEntries = totalsByPerson(entries, people);
  const sheets: { name: string; xml: string }[] = [];
  if (!single) sheets.push({ name: "סיכום", xml: summarySheet(people, entries, month) });
  const listed = single ? people : withEntries;
  const names = sheetNames([...(single ? [] : ["סיכום"]), ...listed.map((p) => p.name)]);
  listed.forEach((p, i) =>
    sheets.push({ name: names[i + (single ? 0 : 1)], xml: personSheet(p, entries, month) }),
  );

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("")}</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  zip.file("xl/styles.xml", STYLES);
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, s.xml));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** The organization's members, plus anyone with entries who has since been removed (by the name on the entry). */
export function peopleOf(members: Person[], entries: AttendanceEntry[]): Person[] {
  const people = members.map((m) => ({ id: m.id, name: m.name }));
  for (const e of entries) if (!people.some((p) => p.id === e.userId)) people.push({ id: e.userId, name: e.userName });
  return people;
}
