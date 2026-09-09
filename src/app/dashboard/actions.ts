"use server";

import { revalidatePath } from "next/cache";
import {
  casesRepo,
  clientsRepo,
  eventsRepo,
  invoicesRepo,
} from "@/lib/db/entities";
import { requireOwnerId } from "@/lib/db/queries";
import { seedDemoData } from "@/lib/db/seed";
import {
  caseStatuses,
  clientStatuses,
  eventTypes,
  invoiceStatuses,
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

function refresh() {
  revalidatePath("/dashboard", "layout");
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

export async function createCase(form: FormData) {
  const ownerId = await requireOwnerId();
  const caseNumber = text(form, "caseNumber");
  const clientName = text(form, "clientName");
  if (!caseNumber || !clientName) return;

  await casesRepo.insert(ownerId, {
    caseNumber,
    clientName,
    address: text(form, "address"),
    type: text(form, "type"),
    status: oneOf<CaseStatus>(form, "status", caseStatuses, "בתהליך"),
    dueDate: date(form, "dueDate"),
    progress: Math.min(100, Math.max(0, number(form, "progress"))),
  });
  refresh();
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

export async function createInvoice(form: FormData) {
  const ownerId = await requireOwnerId();
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
  const ownerId = await requireOwnerId();
  await invoicesRepo.update(ownerId, id, { status: "שולם" });
  refresh();
}

export async function deleteInvoice(id: string) {
  const ownerId = await requireOwnerId();
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

export async function loadDemoData() {
  const ownerId = await requireOwnerId();
  // Guard against a double click turning into two copies of everything.
  const existing = await clientsRepo.count(ownerId);
  if (existing > 0) return;

  await seedDemoData(ownerId);
  refresh();
}
