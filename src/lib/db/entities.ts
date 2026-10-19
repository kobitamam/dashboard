import type { ObjectId, WithId } from "mongodb";
import { Repository, type Owned } from "@/lib/db/repository";
import { addVat } from "@/lib/vat";
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
  PropertyDetails,
  Quote,
  QuoteStatus,
} from "@/lib/types";
import { caseProgress } from "@/lib/types";

export type AttachmentDoc = {
  key: string;
  fileName: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  webUrl?: string;
};

export type FeePaymentDoc = {
  amount: number;
  date: Date;
  note: string;
};

export type FeeDoc = {
  installments?: { percent: number; amount: number }[];
  baseAmount: number;
  finalAmount?: number;
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
    arbitratorRequestDate?: Date | null;
    counterAppraisalDate?: Date | null;
    bettermentStage?: string;
    partnerId?: string; // user ids; "" or missing = nobody assigned
    employeeId?: string;
    progress: number;
    // Legacy: files once uploaded through the app. Case files now live only in OneDrive.
    attachments?: AttachmentDoc[];
    oneDriveFolderId?: string;
    oneDriveFolderName?: string;
    oneDriveFolderUrl?: string;
    oneDriveShareUrl?: string; // a note left by an earlier version (public share links), no longer used
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
    amountInclVat?: number;
    installments?: number[];
    feePercent?: number | null;
    wordFileUrl?: string;
    wordFileId?: string;
    status: QuoteStatus;
    signedFile?: AttachmentDoc;
    linkedCaseId?: string;
  };

export type EventDoc = Owned & {
  _id?: ObjectId;
  title: string;
  start: Date;
  location: string;
  type: EventType;
  caseId?: string;
  allDay?: boolean;
  // Set while the event is mirrored in the Outlook calendar (see lib/calendar-sync.ts).
  outlookId?: string;
  syncHash?: string;
};

// Appraisal types a partner added on top of the built-in caseTypes list.
export type CaseTypeDoc = Owned & {
  _id?: ObjectId;
  name: string;
};

// Calendar event types the office added on top of the built-in eventTypes list.
export type EventTypeDoc = Owned & {
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
export const eventsRepo = new Repository<EventDoc>("events");
export const quotesRepo = new Repository<QuoteDoc>("quotes");
export const attendanceRepo = new Repository<AttendanceDoc>("attendance");
export const caseTypesRepo = new Repository<CaseTypeDoc>("caseTypes");
export const eventTypesRepo = new Repository<EventTypeDoc>("eventTypes");

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
    webUrl: doc.webUrl ?? null,
  };
}

function toFeePayment(doc: FeePaymentDoc): FeePayment {
  return { amount: doc.amount, date: doc.date.toISOString(), note: doc.note };
}

function toFee(doc: FeeDoc | null | undefined): Fee | null {
  if (!doc) return null;
  return {
    ...(doc.installments?.length ? { installments: doc.installments } : {}),
    baseAmount: doc.baseAmount,
    finalAmount: doc.finalAmount ?? 0,
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
    arbitratorRequestDate: day(doc.arbitratorRequestDate),
    counterAppraisalDate: day(doc.counterAppraisalDate),
    bettermentStage: doc.bettermentStage ?? null,
    partnerId: doc.partnerId || null,
    employeeId: doc.employeeId || null,
    // Derived, so cases saved before progress followed the status show it too.
    progress: caseProgress(doc),
    oneDriveFolderUrl: doc.oneDriveFolderUrl ?? null,
    oneDriveFolderName: doc.oneDriveFolderName ?? null,
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
    // Quotes saved before the VAT/installments fields: the old amount was the fee before VAT,
    // paid half at the start and half at the end.
    amountInclVat: doc.amountInclVat ?? addVat(doc.amount),
    installments: doc.installments?.length ? doc.installments : [50, 50],
    feePercent: doc.feePercent ?? null,
    wordFileUrl: doc.wordFileUrl ?? null,
    status: doc.status,
    signedFile: doc.signedFile ? toAttachment(doc.signedFile) : null,
    linkedCaseId: doc.linkedCaseId ?? null,
  };
}

export function toEvent(doc: WithId<EventDoc>): CalendarEvent {
  return {
    id: doc._id.toString(),
    title: doc.title,
    start: doc.start.toISOString(),
    location: doc.location,
    type: doc.type,
    caseId: doc.caseId ?? null,
    allDay: doc.allDay ?? false,
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
