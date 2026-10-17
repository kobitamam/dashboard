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

/**
 * Creates an account under an existing partner's organization: an employee (restricted
 * from fee data) or another partner (full access, like the founder).
 */
export async function createMember({
  organizationId,
  name,
  email,
  password,
  role = "employee",
}: {
  organizationId: string;
  name: string;
  email: string;
  password: string;
  role?: Role;
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
    role,
    organizationId,
    createdAt: new Date(),
  };
  const result = await users.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
  /** The founding partner: the account the organization is built around, who can't be removed. */
  isFounder: boolean;
};

/** Everyone with access to the organization's data, partners first. */
export async function listTeam(organizationId: string): Promise<TeamMember[]> {
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  // Accounts created before organizationId existed are their own organization's root.
  const rootFilter = ObjectId.isValid(organizationId) ? [{ _id: new ObjectId(organizationId) }] : [];
  const docs = await users
    .find({ $or: [{ organizationId }, ...rootFilter] })
    .sort({ createdAt: 1 })
    .toArray();
  const members = docs.map((d) => ({
    id: String(d._id),
    name: d.name,
    email: d.email,
    role: d.role,
    createdAt: d.createdAt,
    isFounder: String(d._id) === organizationId,
  }));
  return [...members.filter((m) => m.role === "partner"), ...members.filter((m) => m.role !== "partner")];
}

export type OrganizationMember = { id: string; name: string; role: Role };

/** Everyone who works in the organization (the partner(s) and the employees), for pickers. */
export async function listOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  // Accounts created before organizationId existed are their own organization's root.
  const rootFilter = ObjectId.isValid(organizationId) ? [{ _id: new ObjectId(organizationId) }] : [];
  const docs = await users
    .find({ $or: [{ organizationId }, ...rootFilter] })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map((d) => ({ id: String(d._id), name: d.name, role: d.role }));
}

/**
 * Removes an employee or an added partner. Scoped to the organization, and the founding
 * partner (whose id is the organization id) can never be removed.
 */
export async function removeMember(organizationId: string, userId: string) {
  if (!ObjectId.isValid(userId) || userId === organizationId) return false;
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const result = await users.deleteOne({ _id: new ObjectId(userId), organizationId });
  return result.deletedCount > 0;
}

export async function verifyPassword(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user;
}
