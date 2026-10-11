import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums — mirror web/src/lib/types.ts and ChainTrack.sol exactly.
// ---------------------------------------------------------------------------

export const RoleSchema = z.enum(["NONE", "SENDER", "RECEIVER", "AGENT"]);
export const PackageStatusSchema = z.enum([
  "Registered",
  "InTransit",
  "OutForDelivery",
  "Delivered",
  "Failed",
  "Cancelled",
]);
export const TxnStatusSchema = z.enum([
  "Pending",
  "InEscrow",
  "Paid",
  "Refunded",
  "Cancelled",
]);

export type Role = z.infer<typeof RoleSchema>;
export type PackageStatus = z.infer<typeof PackageStatusSchema>;
export type TxnStatus = z.infer<typeof TxnStatusSchema>;

const Timestamp = z.number().int().nonnegative();

// EVM address, normalised to lowercase so lookups are case-insensitive.
export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "invalid EVM address")
  .transform((v) => v.toLowerCase());

// ---------------------------------------------------------------------------
// Wallet linkage — the join between an account (Clerk user / Mongo account)
// and one or more on-chain wallets proven via EIP-4361 (SIWE).
// ---------------------------------------------------------------------------

export const WalletLinkSchema = z.object({
  address: AddressSchema,
  chainId: z.string().default("1337"),
  label: z.string().max(64).optional(),
  isPrimary: z.boolean().default(false),
  verifiedAt: Timestamp,
  // keccak256 of the exact SIWE message that was signed, kept for audit.
  messageHash: z.string().optional(),
  // Application user id (maps to UserDoc.onChainUserId when registered on-chain).
  userId: z.number().int().nullable().optional(),
});
export type WalletLink = z.infer<typeof WalletLinkSchema>;

// ---------------------------------------------------------------------------
// Account / profile — keyed by the Clerk user id (or Mongo account id when the
// Clerk fallback is enabled). Holds the sign-up/sign-in details.
// ---------------------------------------------------------------------------

export const UserDocSchema = z.object({
  _id: z.string(),
  clerkId: z.string().nullable().default(null),
  name: z.string().max(64).default(""),
  phone: z.string().max(32).default(""),
  email: z.string().email().optional(),
  role: RoleSchema.default("NONE"),
  wallets: z.array(WalletLinkSchema).default([]),
  onChainUserId: z.number().int().nullable().optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type UserDoc = z.infer<typeof UserDocSchema>;

// ---------------------------------------------------------------------------
// Package — mirrors the demo `Package` type plus optional on-chain + geo
// metadata so a Mongo row can describe both off-chain and chain-backed data.
// ---------------------------------------------------------------------------

export const PackageDocSchema = z.object({
  _id: z.number().int(),
  qrHash: z.string().max(64),
  contentHash: z.string().max(256),
  weight: z.number().nonnegative(),
  size: z.string().max(16),
  senderId: z.number().int(),
  receiverId: z.number().int(),
  activeAgentId: z.number().int().nullable(),
  status: PackageStatusSchema,
  createdAt: Timestamp,
  deliveredAt: Timestamp.nullable(),
  deliveryCode: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  chain: z
    .object({
      chainId: z.string(),
      contract: AddressSchema,
      onChainId: z.number().int(),
      txHash: z.string().optional(),
    })
    .optional(),
  createdAtChain: Timestamp.nullable().optional(),
  updatedAt: Timestamp,
});
export type PackageDoc = z.infer<typeof PackageDocSchema>;

// ---------------------------------------------------------------------------
// Transaction (escrow) — mirrors the demo `Transaction` type + chain metadata.
// ---------------------------------------------------------------------------

export const TransactionDocSchema = z.object({
  _id: z.number().int(),
  packageId: z.number().int(),
  senderId: z.number().int(),
  receiverId: z.number().int(),
  amount: z.number().nonnegative(),
  currency: z.string().max(8),
  status: TxnStatusSchema,
  createdAt: Timestamp,
  settledAt: Timestamp.nullable(),
  chain: z
    .object({
      chainId: z.string(),
      contract: AddressSchema,
      onChainId: z.number().int(),
      txHash: z.string().optional(),
    })
    .optional(),
  updatedAt: Timestamp,
});
export type TransactionDoc = z.infer<typeof TransactionDocSchema>;

// ---------------------------------------------------------------------------
// Checkpoint — mirrors the demo `Checkpoint` type (geo is off-chain only).
// ---------------------------------------------------------------------------

export const CheckpointDocSchema = z.object({
  _id: z.number().int(),
  packageId: z.number().int(),
  agentId: z.number().int(),
  location: z.string().max(120),
  timestamp: Timestamp,
  status: PackageStatusSchema,
  lat: z.number().optional(),
  lng: z.number().optional(),
  chain: z
    .object({
      chainId: z.string(),
      contract: AddressSchema,
      onChainId: z.number().int(),
      txHash: z.string().optional(),
    })
    .optional(),
  updatedAt: Timestamp,
});
export type CheckpointDoc = z.infer<typeof CheckpointDocSchema>;

// ---------------------------------------------------------------------------
// SIWE nonces — short-lived, auto-expire via a TTL index.
// ---------------------------------------------------------------------------

export const SiweNonceSchema = z.object({
  _id: z.string(),
  clerkId: z.string(),
  address: AddressSchema,
  domain: z.string(),
  chainId: z.string(),
  issuedAt: Timestamp,
  expiresAt: z.date(),
});
export type SiweNonce = z.infer<typeof SiweNonceSchema>;
