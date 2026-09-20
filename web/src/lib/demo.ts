import type {
  ChainTrackState,
  Checkpoint,
  Package,
  PackageStatus,
  Role,
  Transaction,
  User,
} from "./types";

const STORAGE_KEY = "chaintrack-demo-v1";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function seed(): ChainTrackState {
  const now = Date.now();
  const users: User[] = [
    { id: 1, name: "Alice Sender", phone: "+254711000001", role: "SENDER" },
    { id: 2, name: "Bob Receiver", phone: "+254711000002", role: "RECEIVER" },
    { id: 3, name: "Courier Corp", phone: "+254711000003", role: "AGENT" },
  ];
  const packages: Package[] = [
    {
      id: 1,
      qrHash: "CTK-0001",
      contentHash: "confidential goods",
      weight: 2,
      size: "M",
      senderId: 1,
      receiverId: 2,
      activeAgentId: 3,
      status: "InTransit",
      createdAt: now - 2 * DAY,
      deliveredAt: null,
      deliveryCode: "CT-2024-0912",
    },
    {
      id: 2,
      qrHash: "CTK-7777",
      contentHash: "electronics",
      weight: 5,
      size: "L",
      senderId: 1,
      receiverId: 2,
      activeAgentId: 3,
      status: "Delivered",
      createdAt: now - 10 * DAY,
      deliveredAt: now - 3 * DAY,
      deliveryCode: "CT-2024-0912",
    },
  ];
  const transactions: Transaction[] = [
    {
      id: 1,
      packageId: 1,
      senderId: 1,
      receiverId: 2,
      amount: 0.1,
      currency: "ETH",
      status: "InEscrow",
      createdAt: now - 2 * DAY,
      settledAt: null,
    },
    {
      id: 2,
      packageId: 2,
      senderId: 1,
      receiverId: 2,
      amount: 0.25,
      currency: "ETH",
      status: "Paid",
      createdAt: now - 10 * DAY,
      settledAt: now - 3 * DAY,
    },
  ];
  const checkpoints: Checkpoint[] = [
    {
      id: 1,
      packageId: 1,
      agentId: 3,
      location: "Nairobi Sender Hub",
      timestamp: now - 2 * DAY,
      status: "InTransit",
    },
    {
      id: 2,
      packageId: 1,
      agentId: 3,
      location: "JKIA Cargo Terminal",
      timestamp: now - 1 * DAY,
      status: "InTransit",
    },
    {
      id: 3,
      packageId: 2,
      agentId: 3,
      location: "Nairobi Sender Hub",
      timestamp: now - 9 * DAY,
      status: "InTransit",
    },
    {
      id: 4,
      packageId: 2,
      agentId: 3,
      location: "Destination Branch",
      timestamp: now - 8 * DAY,
      status: "OutForDelivery",
    },
    {
      id: 5,
      packageId: 2,
      agentId: 3,
      location: "Recipient door",
      timestamp: now - 3 * DAY,
      status: "Delivered",
    },
  ];
  return { users, packages, transactions, checkpoints };
}

export function loadDemo(): ChainTrackState {
  if (typeof window === "undefined") return seed();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ChainTrackState;
  } catch {
    // corrupt store — fall through to seed
  }
  const seeded = seed();
  saveDemo(seeded);
  return seeded;
}

export function saveDemo(state: ChainTrackState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetDemo(): ChainTrackState {
  const seeded = seed();
  saveDemo(seeded);
  return seeded;
}

export function findPackage(state: ChainTrackState, code: string): Package | undefined {
  return state.packages.find(
    (p) => p.qrHash.toLowerCase() === code.trim().toLowerCase()
  );
}

export function userById(state: ChainTrackState, id: number): User | undefined {
  return state.users.find((u) => u.id === id);
}

export function txnForPackage(state: ChainTrackState, packageId: number): Transaction | undefined {
  return state.transactions.find((t) => t.packageId === packageId);
}

export function checkpointsForPackage(state: ChainTrackState, packageId: number): Checkpoint[] {
  return state.checkpoints
    .filter((c) => c.packageId === packageId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

let nextId = 100;

export function bookShipment(
  state: ChainTrackState,
  input: {
    qrHash: string;
    content: string;
    weight: number;
    size: string;
    senderId: number;
    receiverId: number;
    amount: number;
    currency: string;
    deliveryCode: string;
  }
): { state: ChainTrackState; packageId: number } {
  const id = ++nextId;
  const now = Date.now();
  const packages: Package[] = [
    ...state.packages,
    {
      id,
      qrHash: input.qrHash,
      contentHash: input.content,
      weight: input.weight,
      size: input.size,
      senderId: input.senderId,
      receiverId: input.receiverId,
      activeAgentId: null,
      status: "Registered",
      createdAt: now,
      deliveredAt: null,
      deliveryCode: input.deliveryCode,
    },
  ];
  const transactions: Transaction[] = [
    ...state.transactions,
    {
      id,
      packageId: id,
      senderId: input.senderId,
      receiverId: input.receiverId,
      amount: input.amount,
      currency: input.currency,
      status: "InEscrow",
      createdAt: now,
      settledAt: null,
    },
  ];
  return {
    state: { ...state, packages, transactions },
    packageId: id,
  };
}

export function logCheckpoint(
  state: ChainTrackState,
  input: { packageId: number; location: string; status: PackageStatus }
): ChainTrackState {
  const now = Date.now();
  const id = ++nextId;
  const packages = state.packages.map((p) =>
    p.id === input.packageId
      ? { ...p, status: input.status, activeAgentId: 3 }
      : p
  );
  const checkpoints: Checkpoint[] = [
    ...state.checkpoints,
    {
      id,
      packageId: input.packageId,
      agentId: 3,
      location: input.location,
      timestamp: now,
      status: input.status,
    },
  ];
  return { ...state, packages, checkpoints };
}

export function confirmDelivery(
  state: ChainTrackState,
  input: { packageId: number; deliveryCode: string }
): ChainTrackState {
  const now = Date.now();
  const packages = state.packages.map((p) =>
    p.id === input.packageId
      ? { ...p, status: "Delivered" as PackageStatus, deliveredAt: now }
      : p
  );
  const transactions = state.transactions.map((t) =>
    t.packageId === input.packageId
      ? { ...t, status: "Paid" as const, settledAt: now }
      : t
  );
  void input;
  return { ...state, packages, transactions };
}

export function cancelShipment(state: ChainTrackState, packageId: number): ChainTrackState {
  const now = Date.now();
  const packages = state.packages.map((p) =>
    p.id === packageId ? { ...p, status: "Cancelled" as PackageStatus } : p
  );
  const transactions = state.transactions.map((t) =>
    t.packageId === packageId
      ? { ...t, status: "Refunded" as const, settledAt: now }
      : t
  );
  return { ...state, packages, transactions };
}

export function registerUser(
  state: ChainTrackState,
  input: { name: string; phone: string; role: Role }
): { state: ChainTrackState; userId: number } {
  const id = ++nextId;
  return {
    state: {
      ...state,
      users: [...state.users, { id, name: input.name, phone: input.phone, role: input.role }],
    },
    userId: id,
  };
}