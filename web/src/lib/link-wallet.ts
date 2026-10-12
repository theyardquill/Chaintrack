"use client";

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export function utf8ToHex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export interface LinkedWallet {
  address: string;
  chainId: string;
  isPrimary: boolean;
  verifiedAt: number;
  label?: string;
}

export interface LinkResult {
  address: string;
  wallets: LinkedWallet[];
}

// Shared by the header "Connect wallet" button and the account page card:
// prove wallet ownership with SIWE and persist the link to the signed-in account.
export async function linkWalletAddress(): Promise<LinkResult> {
  const ethereum = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
  if (!ethereum) {
    throw new Error("No Ethereum wallet detected. Install MetaMask to link a wallet.");
  }

  const { getActiveAccount } = await import("./web3");
  const address = await getActiveAccount();
  const hexChain = (await ethereum.request({ method: "eth_chainId" })) as string;
  const chainId = String(parseInt(hexChain, 16));

  const nonceRes = await fetch("/api/auth/wallet/nonce", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address, chainId }),
  });
  const nonceBody = (await nonceRes.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  if (!nonceRes.ok || !nonceBody.message) {
    throw new Error(nonceBody.error ?? "could not start wallet linking");
  }

  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [utf8ToHex(nonceBody.message), address],
  })) as string;

  const verifyRes = await fetch("/api/auth/wallet/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: nonceBody.message, signature }),
  });
  const verifyBody = (await verifyRes.json().catch(() => ({}))) as {
    user?: { wallets: LinkedWallet[] };
    error?: string;
  };
  if (!verifyRes.ok) {
    throw new Error(verifyBody.error ?? "wallet verification failed");
  }

  return { address: address.toLowerCase(), wallets: verifyBody.user?.wallets ?? [] };
}
