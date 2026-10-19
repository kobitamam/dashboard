import { MongoClient, type Db } from "mongodb";

const DEFAULT_DB_NAME = "ta-estate";

export class MissingMongoUriError extends Error {
  constructor() {
    super("משתנה הסביבה MONGODB_URI אינו מוגדר");
    this.name = "MissingMongoUriError";
  }
}

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let cached = globalThis._mongoClientPromise;

// A rejected connection must never stay cached, otherwise one transient failure
// keeps every later request failing until the whole instance is recycled.
function forget() {
  cached = undefined;
  globalThis._mongoClientPromise = undefined;
}

export async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new MissingMongoUriError();

  if (!cached) {
    cached = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    })
      .connect()
      .catch((err) => {
        forget();
        throw err;
      });
    globalThis._mongoClientPromise = cached;
  }

  return cached;
}

export function databaseName(uri = process.env.MONGODB_URI ?? ""): string {
  const path = uri.split("?")[0].split("/").slice(3).join("/");
  return path ? decodeURIComponent(path) : DEFAULT_DB_NAME;
}

// Every list is read by ownerId (the organization), and users by email / organization.
// Created once per server instance, in the background; creating an existing index is a no-op.
const INDEXES: [collection: string, keys: Record<string, 1>][] = [
  ["clients", { ownerId: 1 }],
  ["cases", { ownerId: 1 }],
  ["events", { ownerId: 1 }],
  ["quotes", { ownerId: 1 }],
  ["attendance", { ownerId: 1 }],
  ["caseTypes", { ownerId: 1 }],
  ["eventTypes", { ownerId: 1 }],
  ["users", { email: 1 }],
  ["users", { organizationId: 1 }],
];

let indexesRequested = false;

function ensureIndexes(db: Db) {
  if (indexesRequested) return;
  indexesRequested = true;
  Promise.all(INDEXES.map(([name, keys]) => db.collection(name).createIndex(keys))).catch((err) => {
    indexesRequested = false;
    console.error("Failed to create database indexes:", err);
  });
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  const db = client.db(databaseName());
  ensureIndexes(db);
  return db;
}
