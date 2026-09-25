export type Role = "NONE" | "SENDER" | "RECEIVER" | "AGENT";

export type PackageStatus =
  | "Registered"
  | "InTransit"
  | "OutForDelivery"
  | "Delivered"
  | "Failed"
  | "Cancelled";

export type TxnStatus = "Pending" | "InEscrow" | "Paid" | "Refunded" | "Cancelled";

export interface User {
  id: number;
  name: string;
  phone: string;
  role: Role;
  wallet?: string;
}

export interface Package {
  id: number;
  qrHash: string;
  contentHash: string;
  weight: number;
  size: string;
  senderId: number;
  receiverId: number;
  activeAgentId: number | null;
  status: PackageStatus;
  createdAt: number;
  deliveredAt: number | null;
  deliveryCode?: string;
}

export interface Transaction {
  id: number;
  packageId: number;
  senderId: number;
  receiverId: number;
  amount: number;
  currency: string;
  status: TxnStatus;
  createdAt: number;
  settledAt: number | null;
}

export interface Checkpoint {
  id: number;
  packageId: number;
  agentId: number;
  location: string;
  timestamp: number;
  status: PackageStatus;
}

export interface ChainTrackState {
  users: User[];
  packages: Package[];
  transactions: Transaction[];
  checkpoints: Checkpoint[];
}

export const STATUS_LABEL: Record<PackageStatus, string> = {
  Registered: "Registered",
  InTransit: "In Transit",
  OutForDelivery: "Out for Delivery",
  Delivered: "Delivered",
  Failed: "Failed",
  Cancelled: "Cancelled",
};

export const TXN_LABEL: Record<TxnStatus, string> = {
  Pending: "Pending",
  InEscrow: "In Escrow",
  Paid: "Paid",
  Refunded: "Refunded",
  Cancelled: "Cancelled",
};