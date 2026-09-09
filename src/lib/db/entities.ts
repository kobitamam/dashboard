import type { ObjectId, WithId } from "mongodb";
import { Repository, type Owned } from "@/lib/db/repository";
import type {
  CalendarEvent,
  Case,
  CaseStatus,
  Client,
  ClientStatus,
  EventType,
  Invoice,
  InvoiceStatus,
} from "@/lib/types";

export type ClientDoc = Owned & {
  _id?: ObjectId;
  name: string;
  phone: string;
  email: string;
  propertyType: string;
  status: ClientStatus;
  notes: string;
};

export type CaseDoc = Owned & {
  _id?: ObjectId;
  caseNumber: string;
  clientName: string;
  address: string;
  type: string;
  status: CaseStatus;
  dueDate: Date | null;
  progress: number;
};

export type InvoiceDoc = Owned & {
  _id?: ObjectId;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  issueDate: Date | null;
  dueDate: Date | null;
  status: InvoiceStatus;
};

export type EventDoc = Owned & {
  _id?: ObjectId;
  title: string;
  start: Date;
  location: string;
  type: EventType;
};

export const clientsRepo = new Repository<ClientDoc>("clients");
export const casesRepo = new Repository<CaseDoc>("cases");
export const invoicesRepo = new Repository<InvoiceDoc>("invoices");
export const eventsRepo = new Repository<EventDoc>("events");

// Server Components hand these to Client Components, so nothing may cross the
// boundary as an ObjectId or Date.
const day = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : null;

export function toClient(doc: WithId<ClientDoc>): Client {
  return {
    id: doc._id.toString(),
    name: doc.name,
    phone: doc.phone,
    email: doc.email,
    propertyType: doc.propertyType,
    status: doc.status,
    notes: doc.notes ?? "",
  };
}

export function toCase(doc: WithId<CaseDoc>): Case {
  return {
    id: doc._id.toString(),
    caseNumber: doc.caseNumber,
    clientName: doc.clientName,
    address: doc.address,
    type: doc.type,
    status: doc.status,
    dueDate: day(doc.dueDate),
    progress: doc.progress,
  };
}

export function toInvoice(doc: WithId<InvoiceDoc>): Invoice {
  return {
    id: doc._id.toString(),
    invoiceNumber: doc.invoiceNumber,
    clientName: doc.clientName,
    amount: doc.amount,
    issueDate: day(doc.issueDate),
    dueDate: day(doc.dueDate),
    status: doc.status,
  };
}

export function toEvent(doc: WithId<EventDoc>): CalendarEvent {
  return {
    id: doc._id.toString(),
    title: doc.title,
    start: doc.start.toISOString(),
    location: doc.location,
    type: doc.type,
  };
}
