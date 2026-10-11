import { Web3 } from "web3";
import { getCollections } from "./collections";
import type {
  CheckpointDoc,
  PackageDoc,
  PackageStatus,
  Role,
  TransactionDoc,
  UserDoc,
} from "./schemas";

const web3 = new Web3();

export interface ChainMeta {
  chainId: string;
  contract: string;
  onChainId: number;
  txHash?: string;
}

export interface AccountOverview {
  user: UserDoc;
  packages: PackageDoc[];
  transactions: TransactionDoc[];
  checkpoints: CheckpointDoc[];
  people: { id: number; name: string; role: Role }[];
}

export interface ClerkProfile {
  name?: string;
  email?: string;
  phone?: string;
}

async function nextSeq(key: string): Promise<number> {
  const { counters } = await getCollections();
  const res = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return res?.seq ?? 1;
}

function nextAppUserId(): Promise<number> {
  return nextSeq("appUserId");
}

// Upserts the account row and guarantees it has a numeric appUserId, which the
// packages/transactions/checkpoints rows reference.
export async function ensureAccount(clerkId: string): Promise<UserDoc> {
  const { users } = await getCollections();
  const now = Date.now();
  let user = await users.findOne({ _id: clerkId });

  if (!user) {
    const appUserId = await nextAppUserId();
    await users.updateOne(
      { _id: clerkId },
      {
        $setOnInsert: {
          clerkId,
          appUserId,
          name: "",
          phone: "",
          role: "NONE",
          wallets: [],
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );
    user = await users.findOne({ _id: clerkId });
  } else if (user.appUserId == null) {
    const appUserId = await nextAppUserId();
    await users.updateOne({ _id: clerkId }, { $set: { appUserId, updatedAt: now } });
    user = await users.findOne({ _id: clerkId });
  }

  if (!user) throw new Error("failed to ensure account");
  return user;
}

export async function applyProfile(clerkId: string, profile: ClerkProfile): Promise<void> {
  const set: Record<string, unknown> = {};
  if (profile.name) set.name = profile.name;
  if (profile.email) set.email = profile.email;
  if (profile.phone) set.phone = profile.phone;
  if (Object.keys(set).length === 0) return;
  const { users } = await getCollections();
  await users.updateOne({ _id: clerkId }, { $set: { ...set, updatedAt: Date.now() } });
}

export async function setAccountRole(clerkId: string, role: Role): Promise<UserDoc> {
  await ensureAccount(clerkId);
  const { users } = await getCollections();
  await users.updateOne({ _id: clerkId }, { $set: { role, updatedAt: Date.now() } });
  const user = await users.findOne({ _id: clerkId });
  if (!user) throw new Error("account not found");
  return user;
}

export async function getAccountOverview(clerkId: string): Promise<AccountOverview> {
  const user = await ensureAccount(clerkId);
  const appUserId = user.appUserId;
  const { packages, transactions, checkpoints, users } = await getCollections();

  if (appUserId === null) {
    return { user, packages: [], transactions: [], checkpoints: [], people: [] };
  }

  const mine = await packages
    .find({
      $or: [{ senderId: appUserId }, { receiverId: appUserId }, { activeAgentId: appUserId }],
    })
    .sort({ createdAt: -1 })
    .toArray();

  const ids = mine.map((p) => p._id);
  const txns = ids.length
    ? await transactions.find({ packageId: { $in: ids } }).toArray()
    : [];
  const cps = ids.length
    ? await checkpoints.find({ packageId: { $in: ids } }).sort({ timestamp: 1 }).toArray()
    : [];

  const userIds = new Set<number>();
  for (const p of mine) {
    userIds.add(p.senderId);
    userIds.add(p.receiverId);
    if (p.activeAgentId != null) userIds.add(p.activeAgentId);
  }
  const people = userIds.size
    ? await users.find({ appUserId: { $in: [...userIds] } }).toArray()
    : [];

  return {
    user,
    packages: mine,
    transactions: txns,
    checkpoints: cps,
    people: people.map((u) => ({ id: u.appUserId ?? -1, name: u.name, role: u.role })),
  };
}

export interface DirectoryEntry {
  id: number;
  name: string;
  role: Role;
  wallet?: string;
  onChainUserId: number | null;
}

export async function listDirectory(role?: Role): Promise<DirectoryEntry[]> {
  const { users } = await getCollections();
  const filter: Record<string, unknown> = { appUserId: { $ne: null } };
  if (role) filter.role = role;
  const rows = await users.find(filter).sort({ name: 1 }).limit(500).toArray();
  return rows.map((u) => ({
    id: u.appUserId ?? -1,
    name: u.name,
    role: u.role,
    wallet: u.wallets.find((w) => w.isPrimary)?.address ?? u.wallets[0]?.address,
    onChainUserId: u.onChainUserId ?? null,
  }));
}

export interface BookShipmentInput {
  qrHash: string;
  contentHash: string;
  weight: number;
  size: string;
  receiverId: number;
  amount: number;
  currency: string;
  deliveryCode: string;
  chain?: ChainMeta;
  lat?: number;
  lng?: number;
}

// Creates the off-chain package + escrow rows. The chain write (if any) happens
// client-side first; the resulting ids/tx hash are mirrored into `chain`.
export async function bookShipment(
  clerkId: string,
  input: BookShipmentInput,
): Promise<{ pkg: PackageDoc; txn: TransactionDoc }> {
  const sender = await ensureAccount(clerkId);
  if (sender.appUserId == null) throw new Error("account is not ready");
  if (sender.role !== "SENDER") throw new Error("only senders can book shipments");
  if (input.receiverId === sender.appUserId) throw new Error("sender and receiver must differ");

  const { packages, transactions, users } = await getCollections();
  const receiver = await users.findOne({ appUserId: input.receiverId });
  if (!receiver) throw new Error("receiver account not found");

  const clash = await packages.findOne({ qrHash: input.qrHash });
  if (clash) throw new Error("tracking code already exists");

  const now = Date.now();
  const packageId = await nextSeq("packageId");
  const txnId = await nextSeq("txnId");

  const pkg: PackageDoc = {
    _id: packageId,
    qrHash: input.qrHash,
    contentHash: input.contentHash,
    weight: input.weight,
    size: input.size,
    senderId: sender.appUserId,
    receiverId: input.receiverId,
    activeAgentId: null,
    status: "Registered",
    createdAt: now,
    deliveredAt: null,
    deliveryCode: web3.utils.keccak256(input.deliveryCode),
    lat: input.lat,
    lng: input.lng,
    chain: input.chain,
    createdAtChain: input.chain ? now : null,
    updatedAt: now,
  };
  const txn: TransactionDoc = {
    _id: txnId,
    packageId,
    senderId: sender.appUserId,
    receiverId: input.receiverId,
    amount: input.amount,
    currency: input.currency,
    status: input.chain ? "InEscrow" : "Pending",
    createdAt: now,
    settledAt: null,
    chain: input.chain,
    updatedAt: now,
  };

  await packages.insertOne(pkg);
  await transactions.insertOne(txn);
  return { pkg, txn };
}

export interface LogCheckpointInput {
  location: string;
  status: PackageStatus;
  chain?: ChainMeta;
  lat?: number;
  lng?: number;
}

export async function logCheckpoint(
  clerkId: string,
  code: string,
  input: LogCheckpointInput,
): Promise<CheckpointDoc> {
  const agent = await ensureAccount(clerkId);
  if (agent.appUserId == null) throw new Error("account is not ready");

  const { packages, checkpoints } = await getCollections();
  const pkg = await packages.findOne({ qrHash: code });
  if (!pkg) throw new Error("package not found");
  if (pkg.status === "Delivered" || pkg.status === "Cancelled") {
    throw new Error("package is closed");
  }

  const now = Date.now();
  const checkpoint: CheckpointDoc = {
    _id: await nextSeq("checkpointId"),
    packageId: pkg._id,
    agentId: agent.appUserId,
    location: input.location,
    timestamp: now,
    status: input.status,
    lat: input.lat,
    lng: input.lng,
    chain: input.chain,
    updatedAt: now,
  };

  await checkpoints.insertOne(checkpoint);
  await packages.updateOne(
    { _id: pkg._id },
    { $set: { status: input.status, activeAgentId: agent.appUserId, updatedAt: now } },
  );
  return checkpoint;
}

export interface ConfirmDeliveryInput {
  deliveryCode: string;
  receiptHash?: string;
  chain?: ChainMeta;
}

export async function confirmDelivery(
  clerkId: string,
  code: string,
  input: ConfirmDeliveryInput,
): Promise<{ pkg: PackageDoc; txn: TransactionDoc | null }> {
  const account = await ensureAccount(clerkId);
  if (account.appUserId == null) throw new Error("account is not ready");

  const { packages, transactions } = await getCollections();
  const pkg = await packages.findOne({ qrHash: code });
  if (!pkg) throw new Error("package not found");
  if (pkg.receiverId !== account.appUserId) {
    throw new Error("only the receiver can confirm delivery");
  }
  if (pkg.status === "Delivered") throw new Error("already delivered");
  if (pkg.deliveryCode && web3.utils.keccak256(input.deliveryCode) !== pkg.deliveryCode) {
    throw new Error("incorrect delivery code");
  }

  const now = Date.now();
  await packages.updateOne(
    { _id: pkg._id },
    {
      $set: {
        status: "Delivered",
        deliveredAt: now,
        updatedAt: now,
        ...(input.chain ? { chain: input.chain } : {}),
      },
    },
  );
  await transactions.updateOne(
    { packageId: pkg._id },
    { $set: { status: "Paid", settledAt: now, updatedAt: now } },
  );

  const updated = await packages.findOne({ _id: pkg._id });
  const txn = await transactions.findOne({ packageId: pkg._id });
  return { pkg: updated ?? pkg, txn };
}

