import bcrypt from "bcryptjs";
import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export type UserDoc = {
  _id?: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
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

  const passwordHash = await bcrypt.hash(password, 10);
  const doc: UserDoc = {
    name,
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date(),
  };
  await users.insertOne(doc);
  return doc;
}

export async function verifyPassword(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;
  return user;
}
