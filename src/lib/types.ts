export type ClientStatus = "פעיל" | "ליד חדש" | "סגור";
export type CaseStatus = "בתהליך" | "ממתין למידע" | "דחוף" | "הושלם";
export type InvoiceStatus = "שולם" | "ממתין לתשלום" | "באיחור";
export type AlertSeverity = "גבוהה" | "בינונית" | "נמוכה";
export type EventType = "ביקור בנכס" | "פגישת לקוח" | "הגשת שומה" | "שיחת טלפון";

export const clientStatuses: ClientStatus[] = ["פעיל", "ליד חדש", "סגור"];
export const caseStatuses: CaseStatus[] = ["דחוף", "בתהליך", "ממתין למידע", "הושלם"];
export const invoiceStatuses: InvoiceStatus[] = ["ממתין לתשלום", "שולם", "באיחור"];
export const eventTypes: EventType[] = [
  "ביקור בנכס",
  "פגישת לקוח",
  "הגשת שומה",
  "שיחת טלפון",
];

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyType: string;
  status: ClientStatus;
  notes: string;
};

export type Case = {
  id: string;
  caseNumber: string;
  clientName: string;
  address: string;
  type: string;
  status: CaseStatus;
  dueDate: string | null;
  progress: number;
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
