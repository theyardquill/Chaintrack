import type { Role } from "./types";

// On-chain identities seeded by contracts/scripts/seed.ts on the local Hardhat
// network (chainId 1337). These are the standard public Hardhat test accounts
// (mnemonic "test test test test test test test test test test test junk"),
// registered in this order so their on-chain user ids are 1/2/3. Kept in code
// (not read from the git-ignored demo-wallets.json) so production builds work.
export interface DemoIdentity {
  address: string;
  name: string;
  onChainUserId: number;
}

const SENDER: DemoIdentity = {
  address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  name: "Alice Sender",
  onChainUserId: 1,
};
const RECEIVER: DemoIdentity = {
  address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  name: "Bob Receiver",
  onChainUserId: 2,
};
const AGENT: DemoIdentity = {
  address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  name: "Courier Corp",
  onChainUserId: 3,
};

export const DEMO_IDENTITIES = { SENDER, RECEIVER, AGENT } as const;

// Returns the demo on-chain identity that matches a role, or null for a role
// that has no on-chain counterpart (NONE).
export function demoIdentityForRole(role: Role): DemoIdentity | null {
  if (role === "SENDER" || role === "RECEIVER" || role === "AGENT") {
    return DEMO_IDENTITIES[role];
  }
  return null;
}
