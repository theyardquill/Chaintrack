import Web3 from "web3";
import type { Checkpoint, Package, Transaction, User } from "./types";

export const RECEIPT_VERSION = "1";

export const RECEIPT_LABEL = "Proof of delivery";

export interface ReceiptPayload {
  version: string;
  packageId: number;
  qrHash: string;
  contentHash: string;
  weight: number;
  size: string;
  senderId: number;
  receiverId: number;
  senderName: string;
  receiverName: string;
  amount: number;
  currency: string;
  checkpoints: {
    location: string;
    status: string;
    timestamp: number;
  }[];
}

/**
 * Canonical receipt document. Only fields that are frozen at dispatch time are
 * included (deliveredAt and post-delivery txn state are NOT), so the hash can
 * be recomputed from on-chain facts by anyone and compared against the value
 * stored on the contract.
 */
export function buildReceiptPayload(args: {
  pkg: Package;
  sender?: User | null;
  receiver?: User | null;
  txn?: Transaction | null;
  checkpoints: Checkpoint[];
}): ReceiptPayload {
  const { pkg, sender, receiver, txn } = args;
  const checkpoints = [...args.checkpoints]
    .sort((a, b) => a.timestamp - b.timestamp || a.location.localeCompare(b.location))
    .map((c) => ({
      location: c.location,
      status: c.status,
      timestamp: c.timestamp,
    }));
  return {
    version: RECEIPT_VERSION,
    packageId: pkg.id,
    qrHash: pkg.qrHash,
    contentHash: pkg.contentHash,
    weight: pkg.weight,
    size: pkg.size,
    senderId: pkg.senderId,
    receiverId: pkg.receiverId,
    senderName: sender?.name ?? "",
    receiverName: receiver?.name ?? "",
    amount: txn?.amount ?? 0,
    currency: txn?.currency ?? "",
    checkpoints,
  };
}

export function receiptPayloadHash(payload: ReceiptPayload): string {
  return Web3.utils.keccak256(JSON.stringify(payload));
}

export const formatReceiptHash = (hash: string): string =>
  `${hash.slice(0, 10)}…${hash.slice(-8)}`;