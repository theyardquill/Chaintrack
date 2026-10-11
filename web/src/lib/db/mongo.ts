import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "";
const dbName = process.env.MONGODB_DB ?? "chaintrack";

declare global {
  var __chaintrackMongo: Promise<MongoClient> | undefined;
}

let cached: Promise<MongoClient> | null = null;

export function hasMongoConfig(): boolean {
  return uri.length > 0;
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (process.env.NODE_ENV === "development") {
    if (!global.__chaintrackMongo) {
      global.__chaintrackMongo = new MongoClient(uri).connect();
    }
    return global.__chaintrackMongo;
  }
  if (!cached) {
    cached = new MongoClient(uri).connect();
  }
  return cached;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db(dbName);
}
