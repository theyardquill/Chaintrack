import type { Package } from "./types";
import { chainGetCheckpoints, chainGetTransaction, chainGetUserById } from "./web3";
import { buildReceiptPayload, receiptPayloadHash, type ReceiptPayload } from "./receipt";

export interface OnChainReceipt {
  payload: ReceiptPayload;
  hash: string;
}

/**
 * Builds the canonical receipt from ON-CHAIN facts (package, users, escrow
 * txn, checkpoints) and hashes it. Recomputed the same way anywhere, so
 * comparing against the contract's stored hash verifies authenticity.
 */
export async function onChainReceipt(pkg: Package): Promise<OnChainReceipt> {
  const [sender, receiver, txn, checkpoints] = await Promise.all([
    chainGetUserById(pkg.senderId).catch(() => null),
    chainGetUserById(pkg.receiverId).catch(() => null),
    chainGetTransaction(pkg.id).catch(() => null),
    chainGetCheckpoints(pkg.id),
  ]);
  const payload = buildReceiptPayload({ pkg, sender, receiver, txn, checkpoints });
  return { payload, hash: receiptPayloadHash(payload) };
}