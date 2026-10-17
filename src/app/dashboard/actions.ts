"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { nextNumber } from "@/lib/case-number";
import {
  casesRepo,
  caseTypesRepo,
  clientsRepo,
  eventsRepo,
  invoicesRepo,
  quotesRepo,
} from "@/lib/db/entities";
import { disconnect as disconnectOneDriveConnection, getValidAccessToken } from "@/lib/db/onedrive-connection";
import { currentRole, loadCaseTypes, requirePartnerId, requireOwnerId } from "@/lib/db/queries";
import { seedDemoData } from "@/lib/db/seed";
import { formatParcel } from "@/lib/format";
import { createCaseFolder, sanitizeFolderName, uploadAppFolderFile } from "@/lib/onedrive";
import { buildQuoteDocx, formatQuoteDates } from "@/lib/quote-document";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  getObjectSize,
  MAX_ATTACHMENT_BYTES,
} from "@/lib/r2";
import {
  caseStatuses,
  clientStatuses,
  eventTypes,
  invoiceStatuses,
  NEW_CASE_TYPE,
  type CaseStatus,
  type ClientStatus,
  type EventType,
  type InvoiceStatus,
} from "@/lib/types";

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function date(form: FormData, key: string) {
  const value = text(form, key);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function number(form: FormData, key: string, fallback = 0) {
  const parsed = Number(text(form, key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function oneOf<T extends string>(form: FormData, key: string, allowed: T[], fallback: T): T {
  const value = text(form, key) as T;
  return allowed.includes(value) ? value : fallback;
}

// Shared by quotes and cases - matches the columns of the office's existing
// quotes spreadsheet (גוש/חלקה/תת חלקה/עיר/תיאור/...).
function propertyDetails(form: FormData) {
  return {
    block: text(form, "block"),
    parcel: text(form, "parcel"),
    subParcel: text(form, "subParcel"),
    city: text(form, "city"),
    description: text(form, "description"),
    clientEmail: text(form, "clientEmail"),
    clientPhone: text(form, "clientPhone"),
    notes: text(form, "notes"),
    feeNote: text(form, "feeNote"),
  };
}

function refresh() {
  revalidatePath("/dashboard", "layout");
}

/**
 * Validates the chosen appraisal type against the office's list. A partner may
 * pick "new type" and type a name, which is saved so it joins the list for
 * everyone; anyone else posting that value just gets "אחר".
 */
async function resolveCaseType(ownerId: string, form: FormData, canAdd: boolean): Promise<string> {
  const available = await loadCaseTypes(ownerId);
  const chosen = text(form, "type");

  if (chosen === NEW_CASE_TYPE) {
    const name = text(form, "newType").slice(0, 60);
    if (!canAdd || !name) return "אחר";
    if (!available.includes(name)) await caseTypesRepo.insert(ownerId, { name });
    return name;
  }
  return available.includes(chosen) ? chosen : "אחר";
}

// Today's calendar date in Israel, as midnight UTC, so the stored date (which
// is shown by its UTC date) doesn't slip a day for entries made after midnight.
function todayInIsrael() {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  return new Date(iso);
}

export async function createClient(form: FormData) {
  const ownerId = await requireOwnerId();
  const name = text(form, "name");
  if (!name) return;

  await clientsRepo.insert(ownerId, {
    name,
    phone: text(form, "phone"),
    email: text(form, "email"),
    propertyType: text(form, "propertyType"),
    status: oneOf<ClientStatus>(form, "status", clientStatuses, "ליד חדש"),
    notes: text(form, "notes"),
  });
  refresh();
}

export async function deleteClient(id: string) {
  const ownerId = await requireOwnerId();
  await clientsRepo.remove(ownerId, id);
  refresh();
}

/**
 * Creates the case's OneDrive folder and stores the link back on it. Kept
 * best-effort: a case is fully usable without OneDrive, so a failure here is
 * logged, never thrown back at the caller.
 */
async function attachOneDriveFolder(ownerId: string, caseId: string, caseNumber: string, address: string) {
  try {
    const accessToken = await getValidAccessToken(ownerId);
    if (!accessToken) return;
    const folder = await createCaseFolder(accessToken, [caseNumber, address].filter(Boolean).join(" - "));
    await casesRepo.update(ownerId, caseId, {
      oneDriveFolderId: folder.id,
      oneDriveFolderUrl: folder.webUrl,
    });
  } catch (err) {
    console.error("Failed to create OneDrive folder for case:", err);
  }
}

async function createCaseInternal(
  form: FormData,
  options?: { linkedQuoteId?: string },
): Promise<string | undefined> {
  const ownerId = await requireOwnerId();
  const clientName = text(form, "clientName");
  if (!clientName) return undefined;

  const address = text(form, "address");
  const caseNumber = await nextNumber(ownerId, "TA", new Date());
  // Fee data is partners-only, so an employee can't set it even by posting
  // the field directly.
  const isPartner = (await currentRole()) === "partner";

  const caseId = await casesRepo.insert(ownerId, {
    caseNumber,
    clientName,
    address,
    type: await resolveCaseType(ownerId, form, isPartner),
    status: oneOf<CaseStatus>(form, "status", caseStatuses, "בתהליך"),
    dueDate: date(form, "dueDate"),
    progress: Math.min(100, Math.max(0, number(form, "progress"))),
    ...propertyDetails(form),
    ...(isPartner ? {} : { feeNote: "" }),
    ...(options?.linkedQuoteId ? { fromQuoteId: options.linkedQuoteId } : {}),
  });

  await attachOneDriveFolder(ownerId, caseId, caseNumber, address);
  refresh();
  return caseId;
}

export async function createCase(form: FormData): Promise<void> {
  await createCaseInternal(form);
}

export async function updateCaseProgress(id: string, form: FormData) {
  const ownerId = await requireOwnerId();
  await casesRepo.update(ownerId, id, {
    status: oneOf<CaseStatus>(form, "status", caseStatuses, "בתהליך"),
    progress: Math.min(100, Math.max(0, number(form, "progress"))),
  });
  refresh();
}

export async function deleteCase(id: string) {
  const ownerId = await requireOwnerId();
  await casesRepo.remove(ownerId, id);
  refresh();
}

// Invoices (גבייה) are partners-only, like quotes and fee data.
export async function createInvoice(form: FormData) {
  const ownerId = await requirePartnerId();
  const invoiceNumber = text(form, "invoiceNumber");
  const clientName = text(form, "clientName");
  if (!invoiceNumber || !clientName) return;

  await invoicesRepo.insert(ownerId, {
    invoiceNumber,
    clientName,
    amount: Math.max(0, number(form, "amount")),
    issueDate: date(form, "issueDate"),
    dueDate: date(form, "dueDate"),
    status: oneOf<InvoiceStatus>(form, "status", invoiceStatuses, "ממתין לתשלום"),
  });
  refresh();
}

export async function markInvoicePaid(id: string) {
  const ownerId = await requirePartnerId();
  await invoicesRepo.update(ownerId, id, { status: "שולם" });
  refresh();
}

export async function deleteInvoice(id: string) {
  const ownerId = await requirePartnerId();
  await invoicesRepo.remove(ownerId, id);
  refresh();
}

export async function createEvent(form: FormData) {
  const ownerId = await requireOwnerId();
  const title = text(form, "title");
  const start = date(form, "start");
  if (!title || !start) return;

  await eventsRepo.insert(ownerId, {
    title,
    start,
    location: text(form, "location"),
    type: oneOf<EventType>(form, "type", eventTypes, "פגישת לקוח"),
  });
  refresh();
}

export async function deleteEvent(id: string) {
  const ownerId = await requireOwnerId();
  await eventsRepo.remove(ownerId, id);
  refresh();
}

export async function disconnectOneDrive() {
  const ownerId = await requireOwnerId();
  await disconnectOneDriveConnection(ownerId);
  refresh();
}

function sanitizeFileName(name: string) {
  const trimmed = name.trim().slice(-120);
  // Keep only characters that are safe both as an S3 key segment and on
  // every downstream OS filesystem when the file is eventually downloaded.
  return trimmed.replace(/[^\p{L}\p{N}\s.\-_()]/gu, "_") || "קובץ";
}

export async function requestCaseUploadUrl(
  caseId: string,
  fileName: string,
  contentType: string,
  size: number,
) {
  const ownerId = await requireOwnerId();
  const caseDoc = await casesRepo.get(ownerId, caseId);
  if (!caseDoc) throw new Error("התיק לא נמצא");

  if (size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`הקובץ חורג מהגודל המותר (${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB)`);
  }

  const key = `owners/${ownerId}/cases/${caseId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  const url = await createUploadUrl(key, contentType || "application/octet-stream");
  return { url, key };
}

export async function confirmCaseUpload(
  caseId: string,
  attachment: { key: string; fileName: string; contentType: string },
) {
  const ownerId = await requireOwnerId();
  const caseDoc = await casesRepo.get(ownerId, caseId);
  if (!caseDoc) throw new Error("התיק לא נמצא");

  // Trust R2's own record of what was actually written, not what the
  // browser claimed before upload - a bypass of the client-side check
  // would otherwise let an oversized file slip through unnoticed.
  const actualSize = await getObjectSize(attachment.key);
  if (actualSize === null) throw new Error("הקובץ לא נמצא באחסון");
  if (actualSize > MAX_ATTACHMENT_BYTES) {
    await deleteObject(attachment.key);
    throw new Error("הקובץ חורג מהגודל המותר");
  }

  await casesRepo.push(ownerId, caseId, "attachments", {
    key: attachment.key,
    fileName: sanitizeFileName(attachment.fileName),
    size: actualSize,
    contentType: attachment.contentType || "application/octet-stream",
    uploadedAt: new Date(),
  });
  refresh();
}

export async function requestCaseDownloadUrl(caseId: string, key: string) {
  const ownerId = await requireOwnerId();
  const caseDoc = await casesRepo.get(ownerId, caseId);
  const attachment = caseDoc?.attachments?.find((a) => a.key === key);
  if (!attachment) throw new Error("הקובץ לא נמצא");

  return createDownloadUrl(key, attachment.fileName);
}

export async function deleteCaseAttachment(caseId: string, key: string) {
  const ownerId = await requireOwnerId();
  const caseDoc = await casesRepo.get(ownerId, caseId);
  if (!caseDoc?.attachments?.some((a) => a.key === key)) return;

  await deleteObject(key);
  await casesRepo.pull(ownerId, caseId, "attachments", { key });
  refresh();
}

// Every quote action is partners-only: requirePartnerId rejects an employee
// session even if it calls the action directly, bypassing the hidden page.
export async function createQuote(form: FormData) {
  const ownerId = await requirePartnerId();
  const clientName = text(form, "clientName");
  if (!clientName) return;

  const quoteNumber = await nextNumber(ownerId, "Q", new Date());
  await quotesRepo.insert(ownerId, {
    quoteNumber,
    date: todayInIsrael(),
    clientName,
    address: text(form, "address"),
    type: await resolveCaseType(ownerId, form, true),
    amount: Math.max(0, number(form, "amount")),
    feePercent: text(form, "feePercent") ? Math.min(100, Math.max(0, number(form, "feePercent"))) : null,
    status: "ממתין לאישור",
    ...propertyDetails(form),
  });
  refresh();
}

export async function deleteQuote(id: string) {
  const ownerId = await requirePartnerId();
  const quote = await quotesRepo.get(ownerId, id);
  if (quote?.draftFile) await deleteObject(quote.draftFile.key).catch(() => {});
  if (quote?.signedFile) await deleteObject(quote.signedFile.key).catch(() => {});
  await quotesRepo.remove(ownerId, id);
  refresh();
}

export async function rejectQuote(id: string) {
  const ownerId = await requirePartnerId();
  await quotesRepo.update(ownerId, id, { status: "נדחתה" });
  refresh();
}

const QUOTES_FOLDER = "הצעות מחיר";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Fills the office's Word template with the quote's details, saves it into the
 * "הצעות מחיר" folder in OneDrive and remembers the link. Returns the error
 * as data: production masks a thrown server-action error, which would leave
 * the user with no explanation.
 */
export async function createQuoteDocument(
  quoteId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ownerId = await requirePartnerId();
  const quote = await quotesRepo.get(ownerId, quoteId);
  if (!quote) return { ok: false, error: "ההצעה לא נמצאה" };
  if (quote.wordFileUrl) return { ok: true, url: quote.wordFileUrl };

  try {
    const accessToken = await getValidAccessToken(ownerId);
    if (!accessToken) return { ok: false, error: "OneDrive לא מחובר - חבר אותו ביומן" };

    const dates = formatQuoteDates(quote.date ?? todayInIsrael());
    const bytes = await buildQuoteDocx({
      ...dates,
      reference: quote.quoteNumber,
      client: quote.clientName,
      subject: quote.description || quote.type,
      parcel: formatParcel(quote.block ?? "", quote.parcel ?? "", quote.subParcel ?? ""),
      address: [quote.address, quote.city].filter(Boolean).join(", "),
      work: quote.description || quote.type,
      fee:
        quote.feeNote ||
        (quote.amount > 0 ? `${quote.amount.toLocaleString("he-IL")} ₪ + מע״מ` : ""),
    });

    const file = await uploadAppFolderFile(
      accessToken,
      QUOTES_FOLDER,
      `${sanitizeFolderName(`${quote.quoteNumber} - ${quote.clientName}`)}.docx`,
      bytes,
      DOCX_TYPE,
    );
    await quotesRepo.update(ownerId, quoteId, { wordFileUrl: file.webUrl });
    refresh();
    return { ok: true, url: file.webUrl };
  } catch (err) {
    console.error("Failed to create quote document:", err);
    return { ok: false, error: "יצירת הקובץ ב-OneDrive נכשלה, נסה שוב" };
  }
}

type QuoteFileSlot = "draftFile" | "signedFile";

export async function requestQuoteUploadUrl(
  quoteId: string,
  slot: QuoteFileSlot,
  fileName: string,
  contentType: string,
  size: number,
) {
  const ownerId = await requirePartnerId();
  const quote = await quotesRepo.get(ownerId, quoteId);
  if (!quote) throw new Error("ההצעה לא נמצאה");
  if (size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`הקובץ חורג מהגודל המותר (${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB)`);
  }

  const key = `owners/${ownerId}/quotes/${quoteId}/${slot}/${randomUUID()}-${sanitizeFileName(fileName)}`;
  const url = await createUploadUrl(key, contentType || "application/octet-stream");
  return { url, key };
}

export async function confirmQuoteUpload(
  quoteId: string,
  slot: QuoteFileSlot,
  file: { key: string; fileName: string; contentType: string },
) {
  const ownerId = await requirePartnerId();
  const quote = await quotesRepo.get(ownerId, quoteId);
  if (!quote) throw new Error("ההצעה לא נמצאה");

  const actualSize = await getObjectSize(file.key);
  if (actualSize === null) throw new Error("הקובץ לא נמצא באחסון");
  if (actualSize > MAX_ATTACHMENT_BYTES) {
    await deleteObject(file.key);
    throw new Error("הקובץ חורג מהגודל המותר");
  }

  const previous = quote[slot];
  const stored = {
    key: file.key,
    fileName: sanitizeFileName(file.fileName),
    size: actualSize,
    contentType: file.contentType || "application/octet-stream",
    uploadedAt: new Date(),
  };
  await quotesRepo.update(
    ownerId,
    quoteId,
    slot === "draftFile" ? { draftFile: stored } : { signedFile: stored },
  );
  if (previous) await deleteObject(previous.key).catch(() => {});
  refresh();
}

export async function requestQuoteDownloadUrl(quoteId: string, slot: QuoteFileSlot) {
  const ownerId = await requirePartnerId();
  const quote = await quotesRepo.get(ownerId, quoteId);
  const file = quote?.[slot];
  if (!file) throw new Error("הקובץ לא נמצא");
  return createDownloadUrl(file.key, file.fileName);
}

/**
 * Approval is the pipeline's hinge: the quote is marked approved and, in the
 * same step, a job (case) is created for it with its own auto-numbered
 * folder - this is what "quotes -> jobs" means end to end.
 */
export async function approveQuote(quoteId: string) {
  const ownerId = await requirePartnerId();
  const quote = await quotesRepo.get(ownerId, quoteId);
  if (!quote) throw new Error("ההצעה לא נמצאה");
  if (!quote.signedFile) {
    throw new Error("יש להעלות את ההצעה החתומה לפני האישור");
  }
  if (quote.linkedCaseId) return;

  const caseForm = new FormData();
  caseForm.set("clientName", quote.clientName);
  caseForm.set("address", quote.address);
  caseForm.set("type", quote.type);
  caseForm.set("block", quote.block ?? "");
  caseForm.set("parcel", quote.parcel ?? "");
  caseForm.set("subParcel", quote.subParcel ?? "");
  caseForm.set("city", quote.city ?? "");
  caseForm.set("description", quote.description ?? "");
  caseForm.set("clientEmail", quote.clientEmail ?? "");
  caseForm.set("clientPhone", quote.clientPhone ?? "");
  caseForm.set("notes", quote.notes ?? "");
  caseForm.set("feeNote", quote.feeNote ?? "");
  const caseId = await createCaseInternal(caseForm, { linkedQuoteId: quoteId });

  await quotesRepo.update(ownerId, quoteId, {
    status: "אושרה",
    ...(caseId ? { linkedCaseId: caseId } : {}),
  });
  refresh();
}

// Fee data (שכר טרחה) is partners-only - requirePartnerId rejects an
// employee account even if it somehow reaches this action directly.
export async function setCaseFee(caseId: string, form: FormData) {
  const ownerId = await requirePartnerId();
  const existing = (await casesRepo.get(ownerId, caseId))?.fee;
  await casesRepo.update(ownerId, caseId, {
    fee: {
      baseAmount: Math.max(0, number(form, "baseAmount")),
      successPercentage: Math.max(0, number(form, "successPercentage")),
      successAmount: Math.max(0, number(form, "successAmount")),
      payments: existing?.payments ?? [],
    },
  });
  refresh();
}

export async function addFeePayment(caseId: string, form: FormData) {
  const ownerId = await requirePartnerId();
  const amount = number(form, "amount");
  if (amount <= 0) return;

  const caseDoc = await casesRepo.get(ownerId, caseId);
  if (!caseDoc?.fee) return;

  const payments = [
    ...caseDoc.fee.payments,
    { amount, date: date(form, "date") ?? new Date(), note: text(form, "note") },
  ];
  await casesRepo.update(ownerId, caseId, { fee: { ...caseDoc.fee, payments } });
  refresh();
}

export async function removeFeePayment(caseId: string, paymentIndex: number) {
  const ownerId = await requirePartnerId();
  const caseDoc = await casesRepo.get(ownerId, caseId);
  if (!caseDoc?.fee) return;

  const payments = caseDoc.fee.payments.filter((_, i) => i !== paymentIndex);
  await casesRepo.update(ownerId, caseId, { fee: { ...caseDoc.fee, payments } });
  refresh();
}

// Seeds invoices too, so it's partners-only.
export async function loadDemoData() {
  const ownerId = await requirePartnerId();
  // Guard against a double click turning into two copies of everything.
  const existing = await clientsRepo.count(ownerId);
  if (existing > 0) return;

  await seedDemoData(ownerId);
  refresh();
}
