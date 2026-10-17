"use server";

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
import {
  CASE_DOCUMENTS_FOLDER,
  createCaseFolder,
  createUploadSession,
  getAppFolderFile,
  moveFileBetweenFolders,
  sanitizeFolderName,
  uploadSmallFile,
  wordDesktopUri,
  type UploadParent,
} from "@/lib/onedrive";
import { buildQuoteDocx, formatQuoteDates } from "@/lib/quote-document";
import { createUploadToken } from "@/lib/upload-token";
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
  type UploadTarget,
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
 * Creates the case's OneDrive folder and stores its name and link on the case.
 * Best-effort during case creation (a case is fully usable without OneDrive),
 * so the reason for a failure is returned for callers that want to show it.
 */
async function attachOneDriveFolder(
  ownerId: string,
  caseId: string,
  caseNumber: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const accessToken = await getValidAccessToken(ownerId);
    if (!accessToken) return { ok: false, error: "OneDrive לא מחובר - חבר אותו ביומן" };
    // Named by the case number alone: short, unique and always a valid name.
    const folder = await createCaseFolder(accessToken, caseNumber);
    await casesRepo.update(ownerId, caseId, {
      oneDriveFolderId: folder.id,
      oneDriveFolderName: folder.name,
      oneDriveFolderUrl: folder.webUrl,
    });
    return { ok: true };
  } catch (err) {
    console.error("Failed to create OneDrive folder for case:", err);
    // The message carries only an HTTP status / Graph error code, never a token.
    return { ok: false, error: err instanceof Error ? err.message : "יצירת התיקייה נכשלה" };
  }
}

/** Retries a case's missing OneDrive folder (and files waiting from its quote). */
export async function retryCaseOneDriveFolder(
  caseId: string,
): Promise<{ ok: true; warning?: string } | { ok: false; error: string }> {
  const ownerId = await requireOwnerId();
  const caseDoc = await casesRepo.get(ownerId, caseId);
  if (!caseDoc) return { ok: false, error: "התיק לא נמצא" };

  if (!caseDoc.oneDriveFolderName) {
    const result = await attachOneDriveFolder(ownerId, caseId, caseDoc.caseNumber);
    if (!result.ok) return result;
  }

  let warning: string | undefined;
  if (caseDoc.fromQuoteId) {
    const moveError = await moveQuoteFilesIntoCase(ownerId, caseDoc.fromQuoteId, caseId);
    if (moveError) warning = `התיקייה נוצרה, אך העברת קבצי ההצעה נכשלה (${moveError})`;
  }
  refresh();
  return { ok: true, warning };
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

  await attachOneDriveFolder(ownerId, caseId, caseNumber);
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

const QUOTES_FOLDER = "הצעות מחיר";
const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Opens a OneDrive upload for a file the browser is about to send in chunks to
 * /api/onedrive/upload. Case files land in the case's own folder; a signed
 * quote goes to the quotes folder (or straight to the case folder once the
 * quote has become a job). Returns errors as data because production masks a
 * thrown server-action error.
 */
export async function startOneDriveUpload(
  target: UploadTarget,
  fileName: string,
  contentType: string,
  size: number,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  // The signed quote belongs to the partners-only quotes tab.
  const ownerId = target.kind === "quote" ? await requirePartnerId() : await requireOwnerId();
  if (!Number.isInteger(size) || size <= 0) return { ok: false, error: "הקובץ ריק" };

  try {
    const accessToken = await getValidAccessToken(ownerId);
    if (!accessToken) return { ok: false, error: "OneDrive לא מחובר - חבר אותו ביומן" };

    let parent: UploadParent;
    if (target.kind === "case") {
      const caseDoc = await casesRepo.get(ownerId, target.caseId);
      if (!caseDoc) return { ok: false, error: "התיק לא נמצא" };
      if (!caseDoc.oneDriveFolderName) return { ok: false, error: "לתיק הזה אין תיקיית OneDrive" };
      parent = { appFolderName: caseDoc.oneDriveFolderName, subFolder: CASE_DOCUMENTS_FOLDER };
    } else {
      const quote = await quotesRepo.get(ownerId, target.quoteId);
      if (!quote) return { ok: false, error: "ההצעה לא נמצאה" };
      const linked = quote.linkedCaseId ? await casesRepo.get(ownerId, quote.linkedCaseId) : null;
      parent = linked?.oneDriveFolderName
        ? { appFolderName: linked.oneDriveFolderName, subFolder: CASE_DOCUMENTS_FOLDER }
        : { appFolderName: QUOTES_FOLDER };
    }

    const uploadUrl = await createUploadSession(accessToken, parent, fileName);
    return {
      ok: true,
      token: createUploadToken({
        uploadUrl,
        ownerId,
        target,
        size,
        contentType: contentType || "application/octet-stream",
      }),
    };
  } catch (err) {
    console.error("Failed to start OneDrive upload:", err);
    return { ok: false, error: "פתיחת ההעלאה ל-OneDrive נכשלה, נסה שוב" };
  }
}

/** Drops the file from the case's list. The file itself stays in its OneDrive folder. */
export async function removeCaseAttachment(caseId: string, key: string) {
  const ownerId = await requireOwnerId();
  await casesRepo.pull(ownerId, caseId, "attachments", { key });
  refresh();
}

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
  // Files already saved to OneDrive stay there - only the quote record goes.
  await quotesRepo.remove(ownerId, id);
  refresh();
}

export async function rejectQuote(id: string) {
  const ownerId = await requirePartnerId();
  await quotesRepo.update(ownerId, id, { status: "נדחתה" });
  refresh();
}

function quoteWordFileName(quote: { quoteNumber: string; clientName: string }) {
  return `${sanitizeFolderName(`${quote.quoteNumber} - ${quote.clientName}`)}.docx`;
}

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

    const linked = quote.linkedCaseId ? await casesRepo.get(ownerId, quote.linkedCaseId) : null;
    const parent: UploadParent = linked?.oneDriveFolderName
      ? { appFolderName: linked.oneDriveFolderName, subFolder: CASE_DOCUMENTS_FOLDER }
      : { appFolderName: QUOTES_FOLDER };
    const file = await uploadSmallFile(
      accessToken,
      parent,
      quoteWordFileName(quote),
      bytes,
      DOCX_TYPE,
    );
    await quotesRepo.update(ownerId, quoteId, { wordFileUrl: file.webUrl, wordFileId: file.id });
    refresh();
    return { ok: true, url: file.webUrl };
  } catch (err) {
    console.error("Failed to create quote document:", err);
    return { ok: false, error: "יצירת הקובץ ב-OneDrive נכשלה, נסה שוב" };
  }
}

/** The link that opens the quote's Word file in the Word desktop app. */
export async function getQuoteWordUri(
  quoteId: string,
): Promise<{ ok: true; uri: string } | { ok: false; error: string }> {
  const ownerId = await requirePartnerId();
  const quote = await quotesRepo.get(ownerId, quoteId);
  if (!quote?.wordFileUrl) return { ok: false, error: "הקובץ לא נמצא" };

  try {
    const accessToken = await getValidAccessToken(ownerId);
    if (!accessToken) return { ok: false, error: "OneDrive לא מחובר - חבר אותו ביומן" };

    // The letter sits in the quotes folder until the quote becomes a job, then in
    // the case's documents folder (or, for files moved there earlier, the case folder).
    const linked = quote.linkedCaseId ? await casesRepo.get(ownerId, quote.linkedCaseId) : null;
    const caseFolder = linked?.oneDriveFolderName;
    const candidates: string[][] = [
      ...(caseFolder ? [[caseFolder, CASE_DOCUMENTS_FOLDER], [caseFolder]] : []),
      [QUOTES_FOLDER],
    ];
    let lastError: unknown;
    for (const folders of candidates) {
      try {
        const item = await getAppFolderFile(accessToken, folders, quoteWordFileName(quote));
        return { ok: true, uri: wordDesktopUri(item) };
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  } catch (err) {
    console.error("Failed to build the Word link:", err);
    // The reason carries only an HTTP status / Graph error code, never a token.
    const reason = err instanceof Error ? err.message : "";
    return { ok: false, error: `לא הצלחנו לפתוח ב-Word${reason ? ` (${reason})` : ""}` };
  }
}

/**
 * Once a quote becomes a job, its Word letter and the signed copy move into
 * the job's own OneDrive folder and are listed on the case, so everything for
 * the job sits in one place. Best-effort: the approval itself must not fail
 * because OneDrive did.
 */
async function moveQuoteFilesIntoCase(
  ownerId: string,
  quoteId: string,
  caseId: string,
): Promise<string | null> {
  try {
    const quote = await quotesRepo.get(ownerId, quoteId);
    const caseDoc = await casesRepo.get(ownerId, caseId);
    const toFolder = caseDoc?.oneDriveFolderName;
    if (!quote || !toFolder) return null;
    const accessToken = await getValidAccessToken(ownerId);
    if (!accessToken) return null;

    const patch: { wordFileUrl?: string; signedFile?: NonNullable<typeof quote.signedFile> } = {};

    if (quote.wordFileId) {
      const fileName = quoteWordFileName(quote);
      const moved = await moveFileBetweenFolders(
        accessToken,
        QUOTES_FOLDER,
        fileName,
        toFolder,
        CASE_DOCUMENTS_FOLDER,
      );
      patch.wordFileUrl = moved.webUrl;
      await casesRepo.push(ownerId, caseId, "attachments", {
        key: quote.wordFileId,
        fileName,
        size: 0,
        contentType: DOCX_TYPE,
        uploadedAt: new Date(),
        webUrl: moved.webUrl,
      });
    }
    if (quote.signedFile) {
      const moved = await moveFileBetweenFolders(
        accessToken,
        QUOTES_FOLDER,
        quote.signedFile.fileName,
        toFolder,
        CASE_DOCUMENTS_FOLDER,
      );
      patch.signedFile = { ...quote.signedFile, webUrl: moved.webUrl };
      await casesRepo.push(ownerId, caseId, "attachments", { ...patch.signedFile });
    }
    if (patch.wordFileUrl || patch.signedFile) await quotesRepo.update(ownerId, quoteId, patch);
    return null;
  } catch (err) {
    console.error("Failed to move quote files into the case folder:", err);
    return err instanceof Error ? err.message : "שגיאה";
  }
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
  if (caseId) await moveQuoteFilesIntoCase(ownerId, quoteId, caseId);

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
