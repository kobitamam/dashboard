"use server";

import { revalidatePath } from "next/cache";
import { nextNumber } from "@/lib/case-number";
import {
  casesRepo,
  caseTypesRepo,
  clientsRepo,
  eventsRepo,
  eventTypesRepo,
  quotesRepo,
} from "@/lib/db/entities";
import { disconnect as disconnectOneDriveConnection, getValidAccessToken } from "@/lib/db/onedrive-connection";
import {
  currentRole,
  loadCaseTypes,
  loadEventTypes,
  requirePartnerId,
  requireOwnerId,
} from "@/lib/db/queries";
import { seedDemoData } from "@/lib/db/seed";
import { formatParcel } from "@/lib/format";
import {
  createCaseFolder,
  removeFolderShareLinks,
  createUploadSession,
  getAppFolderFile,
  sanitizeFolderName,
  uploadSmallFile,
  wordDesktopUri,
  type UploadParent,
} from "@/lib/onedrive";
import { buildQuoteDocx, formatQuoteDates } from "@/lib/quote-document";
import { deleteOutlookTwin, syncCalendar } from "@/lib/calendar-sync";
import { removeCalendarConnection } from "@/lib/db/calendar-connection";
import { rotateFeedToken } from "@/lib/db/calendar-feed";
import { buildInstallments, feeFromQuote, normalizePercents, quoteFeeText } from "@/lib/fees";
import { addVat, removeVat } from "@/lib/vat";
import { ensureClients } from "@/lib/db/clients-sync";
import { getDb } from "@/lib/mongodb";
import { listOrganizationMembers } from "@/lib/users";
import { createUploadToken } from "@/lib/upload-token";
import {
  BETTERMENT_LEVY,
  bettermentProgress,
  bettermentStageNames,
  COMPLETED_STAGE,
  caseStatuses,
  caseTypes,
  clientStatuses,
  eventTypes,
  NEW_CASE_TYPE,
  type CaseStatus,
  type ClientStatus,
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

// Who handles a case: one partner and one employee, each chosen from the
// organization's own accounts (an id from anywhere else is ignored).
async function assignees(ownerId: string, form: FormData) {
  const members = await listOrganizationMembers(ownerId);
  const pick = (key: string, role: "partner" | "employee") => {
    const id = text(form, key);
    return members.some((m) => m.id === id && m.role === role) ? id : "";
  };
  return { partnerId: pick("partnerId", "partner"), employeeId: pick("employeeId", "employee") };
}

// The event's type: one of the known ones, or a new one the user typed (added for everybody).
async function resolveEventType(ownerId: string, form: FormData): Promise<string> {
  const fallback = "פגישת לקוח";
  const available = await loadEventTypes(ownerId);
  const chosen = text(form, "type");

  if (chosen === NEW_CASE_TYPE) {
    const name = text(form, "newType").slice(0, 60);
    if (!name) return fallback;
    if (!available.includes(name)) await eventTypesRepo.insert(ownerId, { name });
    return name;
  }
  return available.includes(chosen) ? chosen : fallback;
}

// ---- managing the types a partner added (the built-in ones can't be touched) ----

type TypeResult = { ok: true } | { ok: false; error: string };

async function renameCustomType(
  repo: typeof caseTypesRepo,
  builtIn: readonly string[],
  collections: string[],
  oldName: string,
  rawNewName: string,
): Promise<TypeResult> {
  const ownerId = await requirePartnerId();
  const newName = rawNewName.trim().slice(0, 60);
  if (!newName) return { ok: false, error: "יש להקליד שם" };
  if (newName === oldName) return { ok: true };

  const docs = await repo.list(ownerId);
  const doc = docs.find((d) => d.name === oldName);
  if (!doc) return { ok: false, error: "הסוג לא נמצא" };
  if (builtIn.includes(newName) || docs.some((d) => d.name === newName)) {
    return { ok: false, error: "כבר קיים סוג בשם הזה" };
  }

  await repo.update(ownerId, String(doc._id), { name: newName });
  // Everything that used the old name follows the rename.
  const db = await getDb();
  for (const collection of collections) {
    await db.collection(collection).updateMany({ ownerId, type: oldName }, { $set: { type: newName } });
  }
  refresh();
  return { ok: true };
}

async function deleteCustomType(
  repo: typeof caseTypesRepo,
  collections: string[],
  fallback: string,
  name: string,
): Promise<TypeResult> {
  const ownerId = await requirePartnerId();
  const doc = (await repo.list(ownerId)).find((d) => d.name === name);
  if (!doc) return { ok: false, error: "הסוג לא נמצא" };

  await repo.remove(ownerId, String(doc._id));
  // Records of the deleted type move to the fallback type rather than keeping a type nobody can pick.
  const db = await getDb();
  for (const collection of collections) {
    await db.collection(collection).updateMany({ ownerId, type: name }, { $set: { type: fallback } });
  }
  refresh();
  return { ok: true };
}

export async function renameEventType(oldName: string, newName: string): Promise<TypeResult> {
  return renameCustomType(eventTypesRepo, eventTypes, ["events"], oldName, newName);
}

export async function deleteEventType(name: string): Promise<TypeResult> {
  return deleteCustomType(eventTypesRepo, ["events"], "פגישת לקוח", name);
}

export async function renameCaseType(oldName: string, newName: string): Promise<TypeResult> {
  return renameCustomType(caseTypesRepo, caseTypes, ["cases", "quotes"], oldName, newName);
}

export async function deleteCaseType(name: string): Promise<TypeResult> {
  return deleteCustomType(caseTypesRepo, ["cases", "quotes"], "אחר", name);
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
    if (!accessToken) return { ok: false, error: "OneDrive לא מחובר - חבר אותו בלשונית OneDrive" };
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

/** Cancels the public sharing link of a case folder, so its OneDrive link opens in Finder again. */
export async function removeCaseShareLink(
  caseId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ownerId = await requirePartnerId();
  const caseDoc = await casesRepo.get(ownerId, caseId);
  if (!caseDoc?.oneDriveFolderName) return { ok: false, error: "לתיק הזה אין תיקיית OneDrive" };

  try {
    const accessToken = await getValidAccessToken(ownerId);
    if (!accessToken) return { ok: false, error: "OneDrive לא מחובר - חבר אותו בלשונית OneDrive" };
    await removeFolderShareLinks(accessToken, caseDoc.oneDriveFolderName);
    await casesRepo.update(ownerId, caseId, { oneDriveShareUrl: "" });
    refresh();
    return { ok: true };
  } catch (err) {
    console.error("Failed to remove the share link:", err);
    // The stored marker is only a note of a link created earlier (and was found not to exist
    // in OneDrive's "קישורים" tab in a real case), so it is cleared either way.
    await casesRepo.update(ownerId, caseId, { oneDriveShareUrl: "" }).catch(() => undefined);
    refresh();
    return { ok: false, error: err instanceof Error ? err.message : "ביטול הקישור נכשל" };
  }
}

/** Retries a case's missing OneDrive folder. */
export async function retryCaseOneDriveFolder(
  caseId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ownerId = await requireOwnerId();
  const caseDoc = await casesRepo.get(ownerId, caseId);
  if (!caseDoc) return { ok: false, error: "התיק לא נמצא" };
  if (caseDoc.oneDriveFolderName) return { ok: true };

  const result = await attachOneDriveFolder(ownerId, caseId, caseDoc.caseNumber);
  if (result.ok) refresh();
  return result;
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

  const type = await resolveCaseType(ownerId, form, isPartner);
  const isBettermentLevy = type === BETTERMENT_LEVY;
  const stage = oneOf(form, "bettermentStage", bettermentStageNames, bettermentStageNames[0]);

  const caseId = await casesRepo.insert(ownerId, {
    caseNumber,
    clientName,
    address,
    type,
    status: oneOf<CaseStatus>(form, "status", caseStatuses, "בתהליך"),
    dueDate: date(form, "dueDate"),
    ...(isBettermentLevy
      ? {
          arbitratorRequestDate: date(form, "arbitratorRequestDate"),
          counterAppraisalDate: date(form, "counterAppraisalDate"),
        }
      : {}),
    // A betterment-levy case's progress follows its stage.
    progress: isBettermentLevy
      ? bettermentProgress(stage)
      : Math.min(100, Math.max(0, number(form, "progress"))),
    ...(isBettermentLevy ? { bettermentStage: stage } : {}),
    ...(await assignees(ownerId, form)),
    ...propertyDetails(form),
    ...(isPartner ? {} : { feeNote: "" }),
    ...(options?.linkedQuoteId ? { fromQuoteId: options.linkedQuoteId } : {}),
  });

  // The client joins the clients list (once, however many cases they have).
  await ensureClients(ownerId, [
    { name: clientName, phone: text(form, "clientPhone"), email: text(form, "clientEmail") },
  ]).catch((err) => console.error("Failed to add the client of a new case:", err));

  await attachOneDriveFolder(ownerId, caseId, caseNumber);
  refresh();
  return caseId;
}

export async function createCase(form: FormData): Promise<void> {
  await createCaseInternal(form);
}

export async function updateCaseProgress(id: string, form: FormData) {
  const ownerId = await requireOwnerId();
  const caseDoc = await casesRepo.get(ownerId, id);
  if (!caseDoc) return;

  const isBettermentLevy = caseDoc.type === BETTERMENT_LEVY;
  const storedStage = caseDoc.bettermentStage ?? bettermentStageNames[0];
  let stage = oneOf(form, "bettermentStage", bettermentStageNames, storedStage);
  let status = oneOf<CaseStatus>(form, "status", caseStatuses, "בתהליך");

  // A betterment-levy case is finished when either its stage or its status says
  // so (whichever one the user just changed), and a finished case goes to billing.
  if (isBettermentLevy) {
    const done = COMPLETED_STAGE;
    if (stage === done && storedStage !== done) status = "הושלם";
    else if (status === "הושלם" && caseDoc.status !== "הושלם") stage = done;
  }

  await casesRepo.update(ownerId, id, {
    status,
    ...(await assignees(ownerId, form)),
    dueDate: date(form, "dueDate"),
    ...(isBettermentLevy
      ? {
          bettermentStage: stage,
          progress: bettermentProgress(stage),
          arbitratorRequestDate: date(form, "arbitratorRequestDate"),
          counterAppraisalDate: date(form, "counterAppraisalDate"),
        }
      : { progress: Math.min(100, Math.max(0, number(form, "progress"))) }),
  });
  refresh();
}

export async function deleteCase(id: string) {
  const ownerId = await requireOwnerId();
  await casesRepo.remove(ownerId, id);
  refresh();
}

export async function createEvent(form: FormData) {
  const ownerId = await requireOwnerId();
  const title = text(form, "title");
  const start = date(form, "start");
  if (!title || !start) return;

  // Link to a case only if it really belongs to this organization.
  const linkedCaseId = text(form, "caseId");
  const linkedCase = linkedCaseId ? await casesRepo.get(ownerId, linkedCaseId) : null;

  const allDay = form.get("allDay") === "on";

  await eventsRepo.insert(ownerId, {
    title,
    start,
    ...(allDay ? { allDay: true } : {}),
    location: text(form, "location"),
    type: await resolveEventType(ownerId, form),
    ...(linkedCase ? { caseId: linkedCaseId } : {}),
  });
  // Mirror it to the Outlook calendar right away (a failure is shown on the calendar page).
  await syncCalendar(ownerId, { force: true }).catch(() => undefined);
  refresh();
}

export async function deleteEvent(id: string) {
  const ownerId = await requireOwnerId();
  await deleteOutlookTwin(ownerId, id);
  await eventsRepo.remove(ownerId, id);
  refresh();
}

/**
 * Creates the Apple Calendar subscription link, or replaces it (the old link stops
 * working). The calendar is shared by the whole office, so employees may use it too.
 */
export async function rotateCalendarFeed() {
  const ownerId = await requireOwnerId();
  await rotateFeedToken(ownerId);
  refresh();
}

/** Unlinks the Outlook calendar. Events stay here; the "TA-Estate" calendar in Outlook is left as it is. */
export async function disconnectCalendarSync() {
  const ownerId = await requireOwnerId();
  await removeCalendarConnection(ownerId);
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
 * Opens a OneDrive upload for the signed quote: the browser sends the file in
 * chunks to /api/onedrive/upload and it lands in the partners-only quotes
 * folder. Returns errors as data because production masks a thrown
 * server-action error.
 */
export async function startOneDriveUpload(
  target: UploadTarget,
  fileName: string,
  contentType: string,
  size: number,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  // The signed quote belongs to the partners-only quotes tab.
  const ownerId = await requirePartnerId();
  if (!Number.isInteger(size) || size <= 0) return { ok: false, error: "הקובץ ריק" };

  try {
    const accessToken = await getValidAccessToken(ownerId);
    if (!accessToken) return { ok: false, error: "OneDrive לא מחובר - חבר אותו בלשונית OneDrive" };

    const quote = await quotesRepo.get(ownerId, target.quoteId);
    if (!quote) return { ok: false, error: "ההצעה לא נמצאה" };
    // Quote files stay in the partners-only quotes folder, never in the case folder.
    const parent: UploadParent = { appFolderName: QUOTES_FOLDER };

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

// The fee fields shared by the quote form and the case's fee page (see FeeStructureFields):
// the amount before and after VAT (either one is enough), and the share of each payment.
function parseFeeForm(form: FormData) {
  let exVat = Math.max(0, number(form, "amountExVat"));
  let inclVat = Math.max(0, number(form, "amountInclVat"));
  if (exVat <= 0 && inclVat > 0) exVat = removeVat(inclVat);
  else if (inclVat <= 0 && exVat > 0) inclVat = addVat(exVat);

  const typed = form.getAll("installmentPercent").map((v) => Number(v));
  const percents = normalizePercents(typed, number(form, "installmentCount", typed.length || 1));
  const feePercent = text(form, "feePercent")
    ? Math.min(100, Math.max(0, number(form, "feePercent")))
    : null;
  return { exVat, inclVat, percents, feePercent };
}

export async function createQuote(form: FormData) {
  const ownerId = await requirePartnerId();
  const clientName = text(form, "clientName");
  if (!clientName) return;

  const quoteNumber = await nextNumber(ownerId, "Q", new Date());
  const type = await resolveCaseType(ownerId, form, true);
  const fee = parseFeeForm(form);
  // The reduction percent exists only for a betterment levy.
  const feePercent = type === BETTERMENT_LEVY ? fee.feePercent : null;
  await quotesRepo.insert(ownerId, {
    quoteNumber,
    date: todayInIsrael(),
    clientName,
    address: text(form, "address"),
    type,
    amount: fee.exVat,
    amountInclVat: fee.inclVat,
    installments: fee.percents,
    feePercent,
    status: "ממתין לאישור",
    ...propertyDetails(form),
    // The fee as written in the letter and shown on the case card, built from the fields above.
    feeNote: quoteFeeText({
      amount: fee.exVat,
      amountInclVat: fee.inclVat,
      installments: fee.percents,
      feePercent,
      isBettermentLevy: type === BETTERMENT_LEVY,
    }),
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
    if (!accessToken) return { ok: false, error: "OneDrive לא מחובר - חבר אותו בלשונית OneDrive" };

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
        quoteFeeText({
          amount: quote.amount,
          amountInclVat: quote.amountInclVat ?? addVat(quote.amount),
          installments: quote.installments?.length ? quote.installments : [50, 50],
          feePercent: quote.feePercent ?? null,
          isBettermentLevy: quote.type === BETTERMENT_LEVY,
        }),
    });

    const parent: UploadParent = { appFolderName: QUOTES_FOLDER };
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
    if (!accessToken) return { ok: false, error: "OneDrive לא מחובר - חבר אותו בלשונית OneDrive" };

    // The letter lives in the quotes folder.
    const candidates: string[][] = [[QUOTES_FOLDER]];
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

  // The first fee stage becomes due as soon as the case is opened, so the case
  // starts with its fee structure (editable on the fee page).
  const isBettermentLevy = quote.type === BETTERMENT_LEVY;
  if (caseId && (quote.amount > 0 || (isBettermentLevy && quote.feePercent))) {
    await casesRepo.update(ownerId, caseId, {
      fee: feeFromQuote({
        amountInclVat: quote.amountInclVat ?? addVat(quote.amount),
        installments: quote.installments?.length ? quote.installments : [50, 50],
        feePercent: quote.feePercent ?? null,
        isBettermentLevy,
      }),
    });
  }

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
  const caseDoc = await casesRepo.get(ownerId, caseId);
  if (!caseDoc) return;
  const payments = caseDoc.fee?.payments ?? [];
  const isBettermentLevy = caseDoc.type === BETTERMENT_LEVY;

  const { inclVat, percents, feePercent } = parseFeeForm(form);
  const installments = buildInstallments(inclVat, percents);

  await casesRepo.update(ownerId, caseId, {
    fee: {
      installments,
      baseAmount: installments[0]?.amount ?? 0,
      finalAmount: installments.length > 1 ? (installments[installments.length - 1]?.amount ?? 0) : 0,
      // A share of the reduction exists only for a betterment levy.
      successPercentage: isBettermentLevy ? (feePercent ?? 0) : 0,
      successAmount: isBettermentLevy ? Math.max(0, number(form, "successAmount")) : 0,
      payments,
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

// Demo data is partners-only.
export async function loadDemoData() {
  const ownerId = await requirePartnerId();
  // Guard against a double click turning into two copies of everything.
  const existing = await clientsRepo.count(ownerId);
  if (existing > 0) return;

  await seedDemoData(ownerId);
  refresh();
}
