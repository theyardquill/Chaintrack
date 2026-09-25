import Web3, { type Contract, type ContractAbi } from "web3";
import { CHAIN_TRACK_ABI } from "./chain-track-abi";
import deployments from "../contracts/deployments.json";
import type { Checkpoint, Package, PackageStatus, Role, Transaction, TxnStatus } from "./types";

interface EthereumRequest {
  method: string;
  params?: unknown[];
}

interface EthereumProvider {
  request: (args: EthereumRequest) => Promise<unknown>;
  currentProvider?: EthereumProvider;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    web3?: Web3;
  }
}

export const loadWeb3 = async (): Promise<boolean> => {
  if (window.ethereum) {
    window.web3 = new Web3(window.ethereum as never);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      return true;
    } catch {
      return false;
    }
  }
  if (window.web3) {
    window.web3 = new Web3(window.web3.currentProvider as never);
    return true;
  }
  return false;
};

export const getActiveAccount = async (): Promise<string> => {
  if (!window.ethereum) throw new Error("MetaMask is not installed");
  const existing = (await window.ethereum.request({
    method: "eth_accounts",
  })) as string[];
  if (existing.length > 0) return existing[0];
  const requested = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (requested.length > 0) return requested[0];
  throw new Error("No active account found. Please connect MetaMask.");
};

// ---------------------------------------------------------------------------
// ChainTrack contract bridge. The ABI is embedded in source (chain-track-abi)
// and deployment addresses come from the tracked deployments.json, so a fresh
// Vercel checkout always builds. Contracts are resolved lazily in the browser
// only — never during build or server render.
// ---------------------------------------------------------------------------

export type AuthRole = Role;
export type ChainPackageStatus = PackageStatus;
export type ChainTxnStatus = TxnStatus;

// Chain enum values, mirroring ChainTrack.sol.
export const ROLE_NUM: Record<Role, number> = {
  NONE: 0,
  SENDER: 1,
  RECEIVER: 2,
  AGENT: 3,
};

export const PACKAGE_STATUS_NUM: Record<PackageStatus, number> = {
  Registered: 0,
  InTransit: 1,
  OutForDelivery: 2,
  Delivered: 3,
  Failed: 4,
  Cancelled: 5,
};

export const TXN_STATUS_NUM: Record<TxnStatus, number> = {
  Pending: 0,
  InEscrow: 1,
  Paid: 2,
  Refunded: 3,
  Cancelled: 4,
};

const packageStatusFromNum = (n: unknown): PackageStatus => {
  const num = Number(n);
  const name = (Object.keys(PACKAGE_STATUS_NUM) as PackageStatus[]).find(
    (k) => PACKAGE_STATUS_NUM[k] === num
  );
  return (name ?? "Registered") as PackageStatus;
};

const txnStatusFromNum = (n: unknown): TxnStatus => {
  const num = Number(n);
  const name = (Object.keys(TXN_STATUS_NUM) as TxnStatus[]).find(
    (k) => TXN_STATUS_NUM[k] === num
  );
  return (name ?? "Pending") as TxnStatus;
};

export interface ChainTrackConnection {
  contract: Contract<ContractAbi>;
  web3: Web3;
  address: string;
  chainId: string;
}

export const getChainTrack = async (): Promise<ChainTrackConnection> => {
  if (!window.web3) await loadWeb3();

  const web3 = window.web3!;
  const chainId = (await web3.eth.getChainId()).toString();
  const networkData = deployments.networks[chainId as keyof typeof deployments.networks];

  if (networkData && networkData.ChainTrack && networkData.ChainTrack.address) {
    const contract = new web3.eth.Contract(
      CHAIN_TRACK_ABI as ContractAbi,
      networkData.ChainTrack.address
    );
    return { contract, web3, address: networkData.ChainTrack.address, chainId };
  }

  const available = Object.keys(deployments.networks).join(", ");
  throw new Error(
    `ChainTrack not deployed on chainId ${chainId}. Available networks: ${available}. ` +
      `Run: pnpm --filter contracts deploy`
  );
};

export { getChainTrack as getContract };

// --- reads ---------------------------------------------------------------

export interface ChainUser {
  id: number;
  name: string;
  phone: string;
  role: Role;
}

export const chainGetUserByAddress = async (address: string): Promise<ChainUser> => {
  const { contract } = await getChainTrack();
  const id = Number(await contract.methods.userIdByAddress(address).call());
  if (id === 0) throw new Error("Address not registered on-chain");
  const user: [string, string, string, string, number, boolean] = await contract.methods
    .users(id)
    .call();
  const role = (Object.keys(ROLE_NUM) as Role[]).find((k) => ROLE_NUM[k] === user[4]);
  return { id, name: user[2], phone: user[3], role: role ?? "NONE" };
};

export const chainGetPackageByCode = async (code: string): Promise<Package | null> => {
  const { contract } = await getChainTrack();
  const packageId = Number(await contract.methods.packageIdByCode(code).call());
  if (packageId === 0) return null;
  const p: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    number,
    string,
    string,
    string
  ] = await contract.methods.packages(packageId).call();
  return {
    id: Number(p[0]),
    qrHash: p[1],
    contentHash: p[2],
    weight: Number(p[3]),
    size: p[4],
    senderId: Number(p[5]),
    receiverId: Number(p[6]),
    activeAgentId: p[7] ? Number(p[7]) : null,
    status: packageStatusFromNum(p[8]),
    createdAt: Number(p[9]),
    deliveredAt: p[10] ? Number(p[10]) : null,
  };
};

export const chainGetTransaction = async (packageId: number): Promise<Transaction> => {
  const { contract } = await getChainTrack();
  const t: [
    string,
    string,
    string,
    string,
    string,
    string,
    number,
    string,
    string
  ] = await contract.methods.getTransaction(packageId).call();
  return {
    id: Number(t[0]),
    packageId: Number(t[1]),
    senderId: Number(t[2]),
    receiverId: Number(t[3]),
    amount: Number(t[4]),
    currency: t[5],
    status: txnStatusFromNum(t[6]),
    createdAt: Number(t[7]),
    settledAt: t[8] ? Number(t[8]) : null,
  };
};

export const chainGetCheckpoints = async (packageId: number): Promise<Checkpoint[]> => {
  const { contract } = await getChainTrack();
  const raw: unknown = await contract.methods.getCheckpoints(packageId).call();
  const rows = (Array.isArray(raw) ? raw : []) as unknown[][];
  return rows.map((r) => ({
    id: Number(r[0]),
    packageId: Number(r[1]),
    agentId: Number(r[2]),
    location: String(r[3]),
    timestamp: Number(r[4]),
    status: packageStatusFromNum(r[5]),
  }));
};

// --- writes --------------------------------------------------------------

export const chainRegisterUser = async (args: {
  address: string;
  name: string;
  phone: string;
  role: Role;
}): Promise<string> => {
  const { contract } = await getChainTrack();
  const from = await getActiveAccount();
  const tx = await contract.methods
    .registerUser(args.address, args.name, args.phone, ROLE_NUM[args.role])
    .send({ from });
  return tx.transactionHash;
};

export const chainBookShipment = async (
  input: {
    qrHash: string;
    contentHash: string;
    weight: number;
    size: string;
    receiverId: number;
    deliveryCode: string;
    currency: string;
  },
  amountEth: string
): Promise<{ packageId: number; txHash: string; amount: string }> => {
  const { contract, web3 } = await getChainTrack();
  const from = await getActiveAccount();
  const deliveryCodeHash = web3.utils.keccak256(input.deliveryCode);
  const value = web3.utils.toWei(amountEth, "ether");
  const tx = await contract.methods
    .bookShipment(
      input.qrHash,
      input.contentHash,
      input.weight,
      input.size,
      input.receiverId,
      deliveryCodeHash,
      input.currency
    )
    .send({ from, value });
  const events = tx.events?.PackageBooked?.returnValues;
  const packageId = Number(events?.packageId ?? 0);
  return { packageId, txHash: tx.transactionHash, amount: amountEth };
};

export const chainLogCheckpoint = async (args: {
  packageId: number;
  location: string;
  status: PackageStatus;
}): Promise<string> => {
  const { contract } = await getChainTrack();
  const from = await getActiveAccount();
  const tx = await contract.methods
    .logCheckpoint(args.packageId, args.location, PACKAGE_STATUS_NUM[args.status])
    .send({ from });
  return tx.transactionHash;
};

export const chainConfirmDelivery = async (args: {
  packageId: number;
  deliveryCode: string;
}): Promise<string> => {
  const { contract } = await getChainTrack();
  const from = await getActiveAccount();
  const tx = await contract.methods
    .confirmDelivery(args.packageId, args.deliveryCode)
    .send({ from });
  return tx.transactionHash;
};

export const chainCancelShipment = async (packageId: number): Promise<string> => {
  const { contract } = await getChainTrack();
  const from = await getActiveAccount();
  const tx = await contract.methods.cancelShipment(packageId).send({ from });
  return tx.transactionHash;
};