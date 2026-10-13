import type {
  ChainTrackState,
  Checkpoint,
  Package,
  PackageStatus,
  Role,
  Transaction,
  User,
} from "./types";
import { coordsFor } from "./geo";
import { demoIdentityForRole } from "./demo-identities";

const STORAGE_KEY = "chaintrack-demo-v1";
const HOUR = 3_600_000;

function geo(location: string): Pick<Checkpoint, "lat" | "lng"> {
  const c = coordsFor(location);
  return c ? { lat: c.lat, lng: c.lng } : {};
}
const DAY = 24 * HOUR;

function seed(): ChainTrackState {
  const now = Date.now();
  const seeded: User[] = [
    { id: 1, name: "Alice Sender", phone: "+254711000001", role: "SENDER" },
    { id: 2, name: "Bob Receiver", phone: "+254711000002", role: "RECEIVER" },
    { id: 3, name: "Courier Corp", phone: "+254711000003", role: "AGENT" },
    { id: 4, name: "Grace Wanjiku", phone: "+254711000004", role: "SENDER" },
    { id: 5, name: "David Otieno", phone: "+254711000005", role: "RECEIVER" },
    { id: 6, name: "Swift Logistics", phone: "+254711000006", role: "AGENT" },
  ];
  const users: User[] = seeded.map((u) => {
    // Pre-bind each seeded participant to the demo on-chain identity for its
    // role so booking/checkpoint work without the counterparty connecting a
    // wallet (the addresses are registered on the local Hardhat network).
    const identity = demoIdentityForRole(u.role);
    return identity ? { ...u, wallet: identity.address } : u;
  });
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
    {
      id: 3,
      qrHash: "CTK-0002",
      contentHash: "legal documents",
      weight: 1,
      size: "S",
      senderId: 1,
      receiverId: 2,
      activeAgentId: 3,
      status: "OutForDelivery",
      createdAt: now - 4 * DAY,
      deliveredAt: null,
      deliveryCode: "CT-2024-1180",
    },
    {
      id: 4,
      qrHash: "CTK-0003",
      contentHash: "pharmaceutical samples",
      weight: 3,
      size: "M",
      senderId: 4,
      receiverId: 5,
      activeAgentId: null,
      status: "Registered",
      createdAt: now - 6 * HOUR,
      deliveredAt: null,
      deliveryCode: "CT-2024-2031",
    },
    {
      id: 5,
      qrHash: "CTK-0004",
      contentHash: "machine spare parts",
      weight: 12,
      size: "XL",
      senderId: 4,
      receiverId: 2,
      activeAgentId: 6,
      status: "InTransit",
      createdAt: now - 3 * DAY,
      deliveredAt: null,
      deliveryCode: "CT-2024-2210",
    },
    {
      id: 6,
      qrHash: "CTK-0005",
      contentHash: "framed artwork",
      weight: 4,
      size: "L",
      senderId: 1,
      receiverId: 5,
      activeAgentId: 6,
      status: "Delivered",
      createdAt: now - 8 * DAY,
      deliveredAt: now - 1 * DAY,
      deliveryCode: "CT-2024-1999",
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
    {
      id: 3,
      packageId: 3,
      senderId: 1,
      receiverId: 2,
      amount: 0.08,
      currency: "ETH",
      status: "InEscrow",
      createdAt: now - 4 * DAY,
      settledAt: null,
    },
    {
      id: 4,
      packageId: 4,
      senderId: 4,
      receiverId: 5,
      amount: 0.5,
      currency: "ETH",
      status: "Pending",
      createdAt: now - 6 * HOUR,
      settledAt: null,
    },
    {
      id: 5,
      packageId: 5,
      senderId: 4,
      receiverId: 2,
      amount: 0.3,
      currency: "ETH",
      status: "InEscrow",
      createdAt: now - 3 * DAY,
      settledAt: null,
    },
    {
      id: 6,
      packageId: 6,
      senderId: 1,
      receiverId: 5,
      amount: 0.42,
      currency: "ETH",
      status: "Paid",
      createdAt: now - 8 * DAY,
      settledAt: now - 1 * DAY,
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
      ...geo("Nairobi Sender Hub"),
    },
    {
      id: 2,
      packageId: 1,
      agentId: 3,
      location: "JKIA Cargo Terminal",
      timestamp: now - 1 * DAY,
      status: "InTransit",
      ...geo("JKIA Cargo Terminal"),
    },
    {
      id: 3,
      packageId: 2,
      agentId: 3,
      location: "Nairobi Sender Hub",
      timestamp: now - 9 * DAY,
      status: "InTransit",
      ...geo("Nairobi Sender Hub"),
    },
    {
      id: 4,
      packageId: 2,
      agentId: 3,
      location: "Destination Branch",
      timestamp: now - 8 * DAY,
      status: "OutForDelivery",
      ...geo("Destination Branch"),
    },
    {
      id: 5,
      packageId: 2,
      agentId: 3,
      location: "Recipient door",
      timestamp: now - 3 * DAY,
      status: "Delivered",
      ...geo("Recipient door"),
    },
    {
      id: 6,
      packageId: 3,
      agentId: 3,
      location: "Nairobi Sender Hub",
      timestamp: now - 4 * DAY,
      status: "InTransit",
      ...geo("Nairobi Sender Hub"),
    },
    {
      id: 7,
      packageId: 3,
      agentId: 3,
      location: "JKIA Cargo Terminal",
      timestamp: now - 3 * DAY,
      status: "InTransit",
      ...geo("JKIA Cargo Terminal"),
    },
    {
      id: 8,
      packageId: 3,
      agentId: 3,
      location: "Destination Branch",
      timestamp: now - 1 * DAY,
      status: "OutForDelivery",
      ...geo("Destination Branch"),
    },
    {
      id: 9,
      packageId: 5,
      agentId: 6,
      location: "Mombasa Port",
      timestamp: now - 3 * DAY,
      status: "InTransit",
      ...geo("Mombasa Port"),
    },
    {
      id: 10,
      packageId: 5,
      agentId: 6,
      location: "Nakuru Transit Yard",
      timestamp: now - 1 * DAY,
      status: "InTransit",
      ...geo("Nakuru Transit Yard"),
    },
    {
      id: 11,
      packageId: 6,
      agentId: 6,
      location: "Eldoret Branch",
      timestamp: now - 7 * DAY,
      status: "InTransit",
      ...geo("Eldoret Branch"),
    },
    {
      id: 12,
      packageId: 6,
      agentId: 6,
      location: "Kisumu Hub",
      timestamp: now - 2 * DAY,
      status: "OutForDelivery",
      ...geo("Kisumu Hub"),
    },
    {
      id: 13,
      packageId: 6,
      agentId: 6,
      location: "Recipient door",
      timestamp: now - 1 * DAY,
      status: "Delivered",
      ...geo("Recipient door"),
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
  input: { packageId: number; location: string; status: PackageStatus; agentId?: number; lat?: number; lng?: number }
): ChainTrackState {
  const now = Date.now();
  const id = ++nextId;
  const agentId = input.agentId ?? 3;
  const packages = state.packages.map((p) =>
    p.id === input.packageId
      ? { ...p, status: input.status, activeAgentId: agentId }
      : p
  );
  const checkpoints: Checkpoint[] = [
    ...state.checkpoints,
    {
      id,
      packageId: input.packageId,
      agentId,
      location: input.location,
      timestamp: now,
      status: input.status,
      ...(typeof input.lat === "number" && typeof input.lng === "number"
        ? { lat: input.lat, lng: input.lng }
        : geo(input.location)),
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
  const id = Math.max(0, ...state.users.map((u) => u.id)) + 1;
  return {
    state: {
      ...state,
      users: [...state.users, { id, name: input.name, phone: input.phone, role: input.role }],
    },
    userId: id,
  };
}

export function bindWallet(
  state: ChainTrackState,
  userId: number,
  wallet: string
): ChainTrackState {
  return {
    ...state,
    users: state.users.map((u) => (u.id === userId ? { ...u, wallet } : u)),
  };
}