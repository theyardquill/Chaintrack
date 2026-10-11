import { getCollections } from "./collections";
import type { CheckpointDoc, PackageDoc, Role, TransactionDoc, UserDoc } from "./schemas";

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

async function nextAppUserId(): Promise<number> {
  const { counters } = await getCollections();
  const res = await counters.findOneAndUpdate(
    { _id: "appUserId" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" },
  );
  return res?.seq ?? 1;
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
