import type { ObjectId, WithId } from "mongodb";
import { Repository, type Owned } from "@/lib/db/repository";
import type {
  Attachment,
  AttendanceEntry,
  CalendarEvent,
  Case,
  CaseStatus,
  Client,
  ClientStatus,
  EventType,
  Fee,
  FeePayment,
  Invoice,
  InvoiceStatus,
  PropertyDetails,
  Quote,
  QuoteStatus,
} from "@/lib/types";

export type AttachmentDoc = {
  key: string;
  fileName: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
};

export type FeePaymentDoc = {
  amount: number;
  date: Date;
  note: string;
};

export type FeeDoc = {
  baseAmount: number;
  successPercentage: number;
  successAmount: number;
  payments: FeePaymentDoc[];
};

// Stored as a flat, all-optional partial so documents written before these
// fields existed still decode cleanly - toPropertyDetails fills in "" for
// whatever a given record doesn't have.
export type PropertyDetailsDoc = Partial<PropertyDetails>;

export type ClientDoc = Owned & {
  _id?: ObjectId;
  name: string;
  phone: string;
  email: string;
  propertyType: string;
  status: ClientStatus;
  notes: string;
};

export type CaseDoc = Owned &
  PropertyDetailsDoc & {
    _id?: ObjectId;
    caseNumber: string;
    clientName: string;
    address: string;
    type: string;
    status: CaseStatus;
    dueDate: Date | null;
    progress: number;
    attachments?: AttachmentDoc[];
    oneDriveFolderId?: string;
    oneDriveFolderUrl?: string;
    fromQuoteId?: string;
    fee?: FeeDoc | null;
  };

export type QuoteDoc = Owned &
  PropertyDetailsDoc & {
    _id?: ObjectId;
    quoteNumber: string;
    date?: Date | null;
    clientName: string;
    address: string;
    type: string;
    amount: number;
    feePercent?: number | null;
    wordFileUrl?: string;
    status: QuoteStatus;
    draftFile?: AttachmentDoc;
    signedFile?: AttachmentDoc;
    linkedCaseId?: string;
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

// Appraisal types a partner added on top of the built-in caseTypes list.
export type CaseTypeDoc = Owned & {
  _id?: ObjectId;
  name: string;
};

export type AttendanceDoc = Owned & {
  _id?: ObjectId;
  // The individual account, as opposed to ownerId (the shared organization) -
  // this is what tells one employee's clock entries apart from another's.
  userId: string;
  userName: string;
  clockIn: Date;
  clockOut: Date | null;
};

export const clientsRepo = new Repository<ClientDoc>("clients");
export const casesRepo = new Repository<CaseDoc>("cases");
export const invoicesRepo = new Repository<InvoiceDoc>("invoices");
export const eventsRepo = new Repository<EventDoc>("events");
export const quotesRepo = new Repository<QuoteDoc>("quotes");
export const attendanceRepo = new Repository<AttendanceDoc>("attendance");
export const caseTypesRepo = new Repository<CaseTypeDoc>("caseTypes");

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

function toAttachment(doc: AttachmentDoc): Attachment {
  return {
    key: doc.key,
    fileName: doc.fileName,
    size: doc.size,
    contentType: doc.contentType,
    uploadedAt: doc.uploadedAt.toISOString(),
  };
}

function toFeePayment(doc: FeePaymentDoc): FeePayment {
  return { amount: doc.amount, date: doc.date.toISOString(), note: doc.note };
}

function toFee(doc: FeeDoc | null | undefined): Fee | null {
  if (!doc) return null;
  return {
    baseAmount: doc.baseAmount,
    successPercentage: doc.successPercentage,
    successAmount: doc.successAmount,
    payments: (doc.payments ?? []).map(toFeePayment),
  };
}

function toPropertyDetails(doc: PropertyDetailsDoc): PropertyDetails {
  return {
    block: doc.block ?? "",
    parcel: doc.parcel ?? "",
    subParcel: doc.subParcel ?? "",
    city: doc.city ?? "",
    description: doc.description ?? "",
    clientEmail: doc.clientEmail ?? "",
    clientPhone: doc.clientPhone ?? "",
    notes: doc.notes ?? "",
    feeNote: doc.feeNote ?? "",
  };
}

export function toCase(doc: WithId<CaseDoc>): Case {
  return {
    ...toPropertyDetails(doc),
    id: doc._id.toString(),
    caseNumber: doc.caseNumber,
    clientName: doc.clientName,
    address: doc.address,
    type: doc.type,
    status: doc.status,
    dueDate: day(doc.dueDate),
    progress: doc.progress,
    attachments: (doc.attachments ?? []).map(toAttachment),
    oneDriveFolderUrl: doc.oneDriveFolderUrl ?? null,
    fromQuoteId: doc.fromQuoteId ?? null,
    fee: toFee(doc.fee),
  };
}

export function toQuote(doc: WithId<QuoteDoc>): Quote {
  return {
    ...toPropertyDetails(doc),
    id: doc._id.toString(),
    quoteNumber: doc.quoteNumber,
    date: day(doc.date),
    clientName: doc.clientName,
    address: doc.address,
    type: doc.type,
    amount: doc.amount,
    feePercent: doc.feePercent ?? null,
    wordFileUrl: doc.wordFileUrl ?? null,
    status: doc.status,
    draftFile: doc.draftFile ? toAttachment(doc.draftFile) : null,
    signedFile: doc.signedFile ? toAttachment(doc.signedFile) : null,
    linkedCaseId: doc.linkedCaseId ?? null,
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

export function toAttendance(doc: WithId<AttendanceDoc>): AttendanceEntry {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    userName: doc.userName,
    clockIn: doc.clockIn.toISOString(),
    clockOut: doc.clockOut ? doc.clockOut.toISOString() : null,
  };
}
