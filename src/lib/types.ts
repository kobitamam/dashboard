export type ClientStatus = "פעיל" | "ליד חדש" | "סגור";
export type CaseStatus = "בתהליך" | "ממתין למידע" | "נשלחה טיוטה" | "דחוף" | "הושלם";
export type AlertSeverity = "גבוהה" | "בינונית" | "נמוכה";
// The built-in kinds plus any the office added (see loadEventTypes), so it is just a string.
export type EventType = string;
export type CaseType =
  | "שומה לצרכי מכירה"
  | "שומה לצרכי מימון/משכנתא"
  | "שומה לצרכי מיסוי"
  | "שומת ירושה"
  | "שומה לבית משפט/ליטיגציה"
  | "ייעוץ והשגה"
  | "היטל השבחה"
  | "אחר";
export type QuoteStatus = "ממתין לאישור" | "אושרה" | "נדחתה";
export type Role = "partner" | "employee";

export const clientStatuses: ClientStatus[] = ["פעיל", "ליד חדש", "סגור"];
export const caseStatuses: CaseStatus[] = ["דחוף", "בתהליך", "ממתין למידע", "נשלחה טיוטה", "הושלם"];
export const MEDIATOR_REQUEST_DEADLINE = "יום אחרון לבקשת מינוי שמאי מכריע";
export const eventTypes: EventType[] = [
  "ביקור בנכס",
  "פגישת לקוח",
  "דיון",
  "הגשת שומה",
  "שיחת טלפון",
  MEDIATOR_REQUEST_DEADLINE,
];
export const caseTypes: CaseType[] = [
  "שומה לצרכי מכירה",
  "שומה לצרכי מימון/משכנתא",
  "שומה לצרכי מיסוי",
  "שומת ירושה",
  "שומה לבית משפט/ליטיגציה",
  "ייעוץ והשגה",
  "היטל השבחה",
  "אחר",
];

// A betterment-levy case has two statutory deadlines on top of the general due date.
export const BETTERMENT_LEVY: CaseType = "היטל השבחה";

// A betterment-levy case moves through fixed stages instead of a hand-typed
// percentage; the stage sets the progress. The first entry is the state before
// the first stage, so a freshly opened case doesn't start out "25% done".
export const bettermentStages = [
  { name: "טרם נשלחה טיוטה", progress: 0 },
  { name: "נשלחה טיוטה", progress: 25 },
  { name: "נשלח חתום, ממתין לדיון", progress: 50 },
  { name: "ממתין להחלטה", progress: 75 },
  { name: "הושלם", progress: 100 },
] as const;

export const COMPLETED_STAGE = "הושלם";

export const bettermentStageNames: string[] = bettermentStages.map((s) => s.name);

export function bettermentProgress(stage: string) {
  return bettermentStages.find((s) => s.name === stage)?.progress ?? 0;
}
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

// Where an in-app upload lands: the signed quote, kept in the partners-only quotes folder.
export type UploadTarget = { kind: "quote"; quoteId: string };

export type FeePayment = {
  amount: number;
  date: string;
  note: string;
};

// The fee is collected in two stages: stage 1 (baseAmount) when the case is
// opened, stage 2 when it is completed. Stage 2 is a fixed amount (finalAmount,
// the second half of an ordinary fee) and/or a percentage of the reduction
// achieved (betterment levy).
// One payment of the fixed fee: its share of the fee (percent) and the amount, VAT included.
export type Installment = { percent: number; amount: number };

export type Fee = {
  // When present, the fixed fee is paid in these installments: the first when the case is
  // opened, the last when it is completed, any in between once the draft is sent. The
  // legacy two-stage fields below are used only by fees saved before installments existed.
  installments?: Installment[];
  baseAmount: number;
  finalAmount: number;
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
  // היטל השבחה only: last day to ask for an arbitrator appraiser (מועד א׳)...
  arbitratorRequestDate: string | null;
  // ...and last day to file a counter-appraisal (מועד ב׳).
  counterAppraisalDate: string | null;
  bettermentStage: string | null; // היטל השבחה only: one of bettermentStages
  partnerId: string | null; // the partner handling the case
  employeeId: string | null; // the employee handling the case
  progress: number;
  oneDriveFolderUrl: string | null;
  oneDriveShareUrl: string | null; // opens only the case's documents folder, for employees
  oneDriveFolderName: string | null; // folder name under the app folder, used to address its files
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
  amount: number; // the fee before VAT
  amountInclVat: number; // the fee including VAT
  installments: number[]; // the share of the fee (percent) of each payment, adding up to 100
  feePercent: number | null; // אחוז שכ״ט מהפחתה (betterment levy only)
  wordFileUrl: string | null; // the quote letter (Word) created in OneDrive
  status: QuoteStatus;
  signedFile: Attachment | null;
  linkedCaseId: string | null;
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
  caseId: string | null; // the case a hearing/meeting belongs to, if any
  allDay: boolean; // a whole-day entry (no time of day)
};

export type Alert = {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: "תשלום" | "תיק" | "פגישה";
};
