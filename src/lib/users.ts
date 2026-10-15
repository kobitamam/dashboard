import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export type Role = "partner" | "employee";

export type UserDoc = {
  _id?: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  // The account that registers is always the tenant's partner; employee
  // accounts (restricted from fee data) are created by a partner later.
  role: Role;
  // The tenant every record is scoped by. A partner is the root of their own
  // organization (organizationId === their own _id); an employee's points at
  // the partner who created them, so both see the same business data.
  // Accounts created before this field existed have none stored - every
  // caller falls back to the user's own _id, which is exactly what their
  // data was already scoped by.
  organizationId?: string;
  createdAt: Date;
};

export class DuplicateEmailError extends Error {
  constructor() {
    super("כתובת האימייל הזו כבר רשומה במערכת");
    this.name = "DuplicateEmailError";
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function organizationIdOf(user: Pick<UserDoc, "_id" | "organizationId">): string {
  return user.organizationId ?? String(user._id);
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  return db.collection<UserDoc>("users").findOne({ email: normalizeEmail(email) });
}

export async function createUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const normalizedEmail = normalizeEmail(email);

  const existing = await users.findOne({ email: normalizedEmail });
  if (existing) {
    throw new DuplicateEmailError();
  }

  // Generated up front so it can double as the organization's own id - a
  // partner is always the root of their own tenant.
  const _id = new ObjectId();
  const passwordHash = await bcrypt.hash(password, 10);
  const doc: UserDoc = {
    _id,
    name,
    email: normalizedEmail,
    passwordHash,
    role: "partner",
    organizationId: _id.toString(),
    createdAt: new Date(),
  };
  await users.insertOne(doc);
  return doc;
}

/** Creates a restricted employee account under an existing partner's organization. */
export async function createEmployee({
  organizationId,
  name,
  email,
  password,
}: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
}) {
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const normalizedEmail = normalizeEmail(email);

  const existing = await users.findOne({ email: normalizedEmail });
  if (existing) {
    throw new DuplicateEmailError();
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const doc: UserDoc = {
    name,
    email: normalizedEmail,
    passwordHash,
    role: "employee",
    organizationId,
    createdAt: new Date(),
  };
  const result = await users.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export type EmployeeSummary = { id: string; name: string; email: string; createdAt: Date };

export async function listEmployees(organizationId: string): Promise<EmployeeSummary[]> {
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const docs = await users
    .find({ organizationId, role: "employee" })
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    email: d.email,
    createdAt: d.createdAt,
  }));
}

/** Scoped to the organization and to role "employee", so a partner can never
 * accidentally remove another organization's account or demote themselves. */
export async function removeEmployee(organizationId: string, userId: string) {
  if (!ObjectId.isValid(userId)) return false;
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const result = await users.deleteOne({
    _id: new ObjectId(userId),
    organizationId,
    role: "employee",
  });
  return result.deletedCount > 0;
}

export async function verifyPassword(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user;
}
