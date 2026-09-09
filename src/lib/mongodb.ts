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

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(databaseName());
}
