// Seeds the MongoDB `chaintrack` database with demo users, packages, escrow
// transactions and checkpoints so the Clerk-mode app has realistic data to
// show in the dashboard, tracking/report pages, checkpoint console and the
// ship-recipient directory.
//
// Idempotent: rows are keyed by fixed _ids in a reserved 8000-range, so
// re-running refreshes the demo rows without touching real accounts/packages.
// Sequence counters are only ever raised, never lowered.
//
// Usage (from web/):
//   node --env-file=/home/strucker/Downloads/atlas-credentials.env \
//        --env-file=.env.local scripts/seed-mongo.mjs
import { MongoClient } from "mongodb";
import { Web3 } from "web3";

const web3 = new Web3();
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "chaintrack";

if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

// Reserved id base so seeded rows never collide with counter-driven real ids.
const U = 8000;
const uid = (n) => U + n;

const users = [
  { id: uid(1), name: "Alice Sender", phone: "+254711000001", role: "SENDER" },
  { id: uid(2), name: "Bob Receiver", phone: "+254711000002", role: "RECEIVER" },
  { id: uid(3), name: "Courier Corp", phone: "+254711000003", role: "AGENT" },
  { id: uid(4), name: "Grace Wanjiku", phone: "+254711000004", role: "SENDER" },
  { id: uid(5), name: "David Otieno", phone: "+254711000005", role: "RECEIVER" },
  { id: uid(6), name: "Swift Logistics", phone: "+254711000006", role: "AGENT" },
  { id: uid(7), name: "Amina Yusuf", phone: "+254711000007", role: "SENDER" },
  { id: uid(8), name: "Peter Kamau", phone: "+254711000008", role: "RECEIVER" },
];

const packages = [
  { id: uid(1), qr: "CTK-5001", content: "confidential goods", weight: 2, size: "M", sender: 1, receiver: 2, agent: 3, status: "InTransit", created: now - 2 * DAY, delivered: null, code: "CT-2024-0912", amount: 0.1, txn: "InEscrow" },
  { id: uid(2), qr: "CTK-5002", content: "electronics", weight: 5, size: "L", sender: 1, receiver: 2, agent: 3, status: "Delivered", created: now - 10 * DAY, delivered: now - 3 * DAY, code: "CT-2024-0913", amount: 0.25, txn: "Paid" },
  { id: uid(3), qr: "CTK-5003", content: "pharmaceutical samples", weight: 3, size: "M", sender: 4, receiver: 5, agent: null, status: "Registered", created: now - 6 * 60 * 60 * 1000, delivered: null, code: "CT-2024-2031", amount: 0.5, txn: "Pending" },
  { id: uid(4), qr: "CTK-5004", content: "machine spare parts", weight: 12, size: "XL", sender: 4, receiver: 2, agent: 6, status: "OutForDelivery", created: now - 3 * DAY, delivered: null, code: "CT-2024-2210", amount: 0.3, txn: "InEscrow" },
  { id: uid(5), qr: "CTK-5005", content: "legal documents", weight: 1, size: "S", sender: 1, receiver: 5, agent: 6, status: "InTransit", created: now - 3 * DAY, delivered: null, code: "CT-2024-1180", amount: 0.08, txn: "InEscrow" },
  { id: uid(6), qr: "CTK-5006", content: "framed artwork", weight: 4, size: "L", sender: 4, receiver: 5, agent: 3, status: "Delivered", created: now - 8 * DAY, delivered: now - 1 * DAY, code: "CT-2024-1999", amount: 0.42, txn: "Paid" },
  { id: uid(7), qr: "CTK-5007", content: "packaged foodstuffs", weight: 20, size: "XL", sender: 7, receiver: 8, agent: 6, status: "InTransit", created: now - 1 * DAY, delivered: null, code: "CT-2024-3001", amount: 0.6, txn: "InEscrow" },
  { id: uid(8), qr: "CTK-5008", content: "medical equipment", weight: 9, size: "L", sender: 7, receiver: 2, agent: 3, status: "OutForDelivery", created: now - 2 * DAY, delivered: null, code: "CT-2024-3002", amount: 0.9, txn: "InEscrow" },
];

const checkpointPlan = {
  1: [["Nairobi Sender Hub", "InTransit", now - 2 * DAY, 3]],
  2: [["Nairobi Sender Hub", "InTransit", now - 9 * DAY, 3], ["Destination Branch", "OutForDelivery", now - 8 * DAY, 3], ["Recipient door", "Delivered", now - 3 * DAY, 3]],
  4: [["Mombasa Port", "InTransit", now - 3 * DAY, 6], ["Nakuru Transit Yard", "InTransit", now - 1 * DAY, 6], ["Destination Branch", "OutForDelivery", now - 12 * 60 * 60 * 1000, 6]],
  5: [["Eldoret Branch", "InTransit", now - 2 * DAY, 6]],
  6: [["Eldoret Branch", "InTransit", now - 7 * DAY, 3], ["Kisumu Hub", "OutForDelivery", now - 2 * DAY, 3], ["Recipient door", "Delivered", now - 1 * DAY, 3]],
  7: [["Mombasa Port", "InTransit", now - 20 * 60 * 60 * 1000, 6]],
  8: [["JKIA Cargo Terminal", "InTransit", now - 2 * DAY, 3], ["Nairobi Sender Hub", "InTransit", now - 1 * DAY, 3], ["Destination Branch", "OutForDelivery", now - 6 * 60 * 60 * 1000, 3]],
};

const GEO = {
  "Nairobi Sender Hub": { lat: -1.2921, lng: 36.8219 },
  "JKIA Cargo Terminal": { lat: -1.3192, lng: 36.9278 },
  "Destination Branch": { lat: -1.2649, lng: 36.8033 },
  "Recipient door": { lat: -1.2676, lng: 36.809 },
  "Mombasa Port": { lat: -4.0435, lng: 39.6682 },
  "Nakuru Transit Yard": { lat: -0.3031, lng: 36.08 },
  "Kisumu Hub": { lat: -0.0917, lng: 34.768 },
  "Eldoret Branch": { lat: 0.5143, lng: 35.2698 },
};

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const usersCol = db.collection("users");
  const packagesCol = db.collection("packages");
  const txnsCol = db.collection("transactions");
  const checkpointsCol = db.collection("checkpoints");
  const countersCol = db.collection("counters");

  await packagesCol.createIndex({ qrHash: 1 }, { unique: true });

  // Users — keyed by a synthetic clerk-like _id, no wallet links required.
  for (const u of users) {
    await usersCol.replaceOne(
      { _id: `seed:${u.id}` },
      {
        _id: `seed:${u.id}`,
        clerkId: null,
        appUserId: u.id,
        name: u.name,
        phone: u.phone,
        role: u.role,
        wallets: [],
        createdAt: now,
        updatedAt: now,
      },
      { upsert: true },
    );
  }

  // Packages + escrow transactions.
  let checkpointId = U + 1;
  for (const p of packages) {
    const senderId = uid(p.sender);
    const receiverId = uid(p.receiver);
    const activeAgentId = p.agent == null ? null : uid(p.agent);

    await packagesCol.replaceOne(
      { _id: p.id },
      {
        _id: p.id,
        qrHash: p.qr,
        contentHash: p.content,
        weight: p.weight,
        size: p.size,
        senderId,
        receiverId,
        activeAgentId,
        status: p.status,
        createdAt: p.created,
        deliveredAt: p.delivered,
        deliveryCode: web3.utils.keccak256(p.code),
        updatedAt: now,
      },
      { upsert: true },
    );

    await txnsCol.replaceOne(
      { _id: p.id },
      {
        _id: p.id,
        packageId: p.id,
        senderId,
        receiverId,
        amount: p.amount,
        currency: "ETH",
        status: p.txn,
        createdAt: p.created,
        settledAt: p.status === "Delivered" ? p.delivered : null,
        updatedAt: now,
      },
      { upsert: true },
    );

    for (const [location, status, ts, agent] of checkpointPlan[p.id - U] ?? []) {
      await checkpointsCol.replaceOne(
        { _id: checkpointId },
        {
          _id: checkpointId,
          packageId: p.id,
          agentId: uid(agent),
          location,
          timestamp: ts,
          status,
          ...(GEO[location] ?? {}),
          updatedAt: now,
        },
        { upsert: true },
      );
      checkpointId += 1;
    }
  }

  // Raise counters so real sign-ups/bookings continue after the seeded range.
  const maxUser = Math.max(...users.map((u) => u.id));
  const maxPkg = Math.max(...packages.map((p) => p.id));
  const maxCkpt = checkpointId - 1;
  const bumps = {
    appUserId: maxUser,
    packageId: maxPkg,
    txnId: maxPkg,
    checkpointId: maxCkpt,
  };
  for (const [key, value] of Object.entries(bumps)) {
    const cur = await countersCol.findOne({ _id: key });
    if (!cur || (cur.seq ?? 0) < value) {
      await countersCol.updateOne(
        { _id: key },
        { $set: { seq: value } },
        { upsert: true },
      );
    }
  }

  const counts = {
    users: await usersCol.countDocuments({ _id: { $regex: "^seed:" } }),
    packages: await packagesCol.countDocuments({ _id: { $gte: U } }),
    transactions: await txnsCol.countDocuments({ _id: { $gte: U } }),
    checkpoints: await checkpointsCol.countDocuments({ _id: { $gte: U } }),
  };

  console.log(`Seeded ${dbName}:`, counts);
  console.log(
    "Tracking codes:",
    packages.map((p) => p.qr).join(", "),
  );

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
