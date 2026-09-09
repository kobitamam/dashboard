import { ObjectId, type Document, type Filter, type Sort } from "mongodb";
import { getDb } from "@/lib/mongodb";

export type Owned = {
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

// A malformed id from a URL or form must read as "not found", never as a crash.
function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

/**
 * Every read and write goes through here so an ownerId filter can never be
 * omitted by accident, which would leak one account's records into another's.
 */
export class Repository<T extends Document & Owned> {
  private readonly collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  private async collection() {
    const db = await getDb();
    return db.collection<T>(this.collectionName);
  }

  async list(ownerId: string, sort: Sort = { createdAt: -1 }) {
    const collection = await this.collection();
    return collection
      .find({ ownerId } as Filter<T>)
      .sort(sort)
      .toArray();
  }

  async get(ownerId: string, id: string) {
    const _id = toObjectId(id);
    if (!_id) return null;
    const collection = await this.collection();
    return collection.findOne({ _id, ownerId } as unknown as Filter<T>);
  }

  async insert(ownerId: string, data: Omit<T, "_id" | keyof Owned>) {
    const collection = await this.collection();
    const now = new Date();
    const result = await collection.insertOne({
      ...data,
      ownerId,
      createdAt: now,
      updatedAt: now,
    } as never);
    return result.insertedId.toString();
  }

  async insertMany(ownerId: string, items: Omit<T, "_id" | keyof Owned>[]) {
    if (items.length === 0) return 0;
    const collection = await this.collection();
    const now = new Date();
    const result = await collection.insertMany(
      items.map((item) => ({
        ...item,
        ownerId,
        createdAt: now,
        updatedAt: now,
      })) as never[],
    );
    return result.insertedCount;
  }

  async update(ownerId: string, id: string, patch: Partial<Omit<T, "_id" | keyof Owned>>) {
    const _id = toObjectId(id);
    if (!_id) return false;
    const collection = await this.collection();
    const result = await collection.updateOne(
      { _id, ownerId } as unknown as Filter<T>,
      { $set: { ...patch, updatedAt: new Date() } as never },
    );
    return result.matchedCount > 0;
  }

  async remove(ownerId: string, id: string) {
    const _id = toObjectId(id);
    if (!_id) return false;
    const collection = await this.collection();
    const result = await collection.deleteOne({ _id, ownerId } as unknown as Filter<T>);
    return result.deletedCount > 0;
  }

  async count(ownerId: string) {
    const collection = await this.collection();
    return collection.countDocuments({ ownerId } as Filter<T>);
  }
}
