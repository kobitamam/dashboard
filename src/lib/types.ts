export type ClientStatus = "פעיל" | "ליד חדש" | "סגור";
export type CaseStatus = "בתהליך" | "ממתין למידע" | "דחוף" | "הושלם";
export type InvoiceStatus = "שולם" | "ממתין לתשלום" | "באיחור";
export type AlertSeverity = "גבוהה" | "בינונית" | "נמוכה";
export type EventType = "ביקור בנכס" | "פגישת לקוח" | "הגשת שומה" | "שיחת טלפון";
export type CaseType =
  | "שומה לצרכי מכירה"
  | "שומה לצרכי מימון/משכנתא"
  | "שומה לצרכי מיסוי"
  | "שומת ירושה"
  | "שומה לבית משפט/ליטיגציה"
  | "ייעוץ והשגה"
  | "אחר";
export type QuoteStatus = "ממתין לאישור" | "אושרה" | "נדחתה";
export type Role = "partner" | "employee";

export const clientStatuses: ClientStatus[] = ["פעיל", "ליד חדש", "סגור"];
export const caseStatuses: CaseStatus[] = ["דחוף", "בתהליך", "ממתין למידע", "הושלם"];
export const invoiceStatuses: InvoiceStatus[] = ["ממתין לתשלום", "שולם", "באיחור"];
export const eventTypes: EventType[] = [
  "ביקור בנכס",
  "פגישת לקוח",
  "הגשת שומה",
  "שיחת טלפון",
];
export const caseTypes: CaseType[] = [
  "שומה לצרכי מכירה",
  "שומה לצרכי מימון/משכנתא",
  "שומה לצרכי מיסוי",
  "שומת ירושה",
  "שומה לבית משפט/ליטיגציה",
  "ייעוץ והשגה",
  "אחר",
];
export const quoteStatuses: QuoteStatus[] = ["ממתין לאישור", "אושרה", "נדחתה"];

// The select's sentinel for "add a type that isn't in the list yet".
export const NEW_CASE_TYPE = "__new__";

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyType: string;
  status: ClientStatus;
  notes: string;
};

export type Attachment = {
  key: string; // the OneDrive item id
  fileName: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  webUrl: string | null;
};

// Where an in-app upload lands: a case's OneDrive folder, or - for the signed
// quote - the quote's file (moved into the case folder when it's approved).
export type UploadTarget = { kind: "case"; caseId: string } | { kind: "quote"; quoteId: string };

export type FeePayment = {
  amount: number;
  date: string;
  note: string;
};

export type Fee = {
  baseAmount: number;
  successPercentage: number;
  successAmount: number;
  payments: FeePayment[];
};

// The fields a quote and the job it becomes share, matching the columns of
// the office's existing quotes spreadsheet (גוש/חלקה/תת חלקה/עיר/תיאור/...).
export type PropertyDetails = {
  block: string; // גוש
  parcel: string; // חלקה
  subParcel: string; // תת חלקה
  city: string; // עיר
  description: string; // תיאור
  clientEmail: string; // מייל
  clientPhone: string; // טלפון
  notes: string; // הערות
  feeNote: string; // שכ"ט - a free-text summary, e.g. "10,000 ₪ + מע״מ"
};

export type Case = PropertyDetails & {
  id: string;
  caseNumber: string;
  clientName: string;
  address: string;
  type: string;
  status: CaseStatus;
  dueDate: string | null;
  progress: number;
  attachments: Attachment[];
  oneDriveFolderUrl: string | null;
  fromQuoteId: string | null;
  fee: Fee | null;
};

export type Quote = PropertyDetails & {
  id: string;
  quoteNumber: string;
  date: string | null; // תאריך ההצעה
  clientName: string;
  address: string;
  type: string;
  amount: number;
  feePercent: number | null; // אחוז שכ״ט מהפחתה
  wordFileUrl: string | null; // the quote letter (Word) created in OneDrive
  status: QuoteStatus;
  signedFile: Attachment | null;
  linkedCaseId: string | null;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  issueDate: string | null;
  dueDate: string | null;
  status: InvoiceStatus;
};

export type AttendanceEntry = {
  id: string;
  userId: string;
  userName: string;
  clockIn: string;
  clockOut: string | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  location: string;
  type: EventType;
};

export type Alert = {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: "תשלום" | "תיק" | "פגישה";
};
