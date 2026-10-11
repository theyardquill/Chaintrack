import type { Collection } from "mongodb";
import { getDb } from "./mongo";
import type {
  CheckpointDoc,
  Counter,
  PackageDoc,
  SiweNonce,
  TransactionDoc,
  UserDoc,
} from "./schemas";

export interface Collections {
  users: Collection<UserDoc>;
  packages: Collection<PackageDoc>;
  transactions: Collection<TransactionDoc>;
  checkpoints: Collection<CheckpointDoc>;
  siweNonces: Collection<SiweNonce>;
  counters: Collection<Counter>;
}

let indexPromise: Promise<void> | null = null;

async function ensureIndexes(cols: Collections): Promise<void> {
  await Promise.all([
    // A wallet can only ever be linked to one account. Enforced in code (the
    // verify route pulls it from other users) and indexed for lookup speed.
    cols.users.createIndex({ "wallets.address": 1 }),
    cols.packages.createIndex({ qrHash: 1 }, { unique: true }),
    cols.packages.createIndex({ senderId: 1 }),
    cols.packages.createIndex({ receiverId: 1 }),
    cols.transactions.createIndex({ packageId: 1 }),
    cols.checkpoints.createIndex({ packageId: 1, timestamp: 1 }),
    // SIWE nonces self-destruct ~5 min after creation.
    cols.siweNonces.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

export async function getCollections(): Promise<Collections> {
  const db = await getDb();
  const cols: Collections = {
    users: db.collection("users") as Collection<UserDoc>,
    packages: db.collection("packages") as Collection<PackageDoc>,
    transactions: db.collection("transactions") as Collection<TransactionDoc>,
    checkpoints: db.collection("checkpoints") as Collection<CheckpointDoc>,
    siweNonces: db.collection("siwe_nonces") as Collection<SiweNonce>,
    counters: db.collection("counters") as Collection<Counter>,
  };
  if (!indexPromise) indexPromise = ensureIndexes(cols);
  await indexPromise;
  return cols;
}
