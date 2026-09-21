import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const globalForMongo = global as unknown as { _mongoClientPromise?: Promise<MongoClient> };

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    return Promise.reject(new Error("Please add your MongoDB URI to .env.local"));
  }
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = new MongoClient(uri).connect();
  }
  return globalForMongo._mongoClientPromise;
}

export default getClientPromise();