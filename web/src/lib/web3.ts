import Web3, { type Contract, type ContractAbi } from "web3";
import ChainTrackArtifact from "../contracts/artifacts/contracts/ChainTrack.sol/ChainTrack.json";
import deployments from "../contracts/deployments.json";

interface EthereumRequest {
  method: string;
  params?: unknown[];
}

interface EthereumProvider {
  request: (args: EthereumRequest) => Promise<unknown>;
  currentProvider?: EthereumProvider;
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
    window.web3 = new Web3(window.web3.currentProvider);
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

export interface ChainTrackConnection {
  contract: Contract<ContractAbi>;
  web3: Web3;
  address: string;
}

export const getContract = async (): Promise<ChainTrackConnection> => {
  if (!window.web3) await loadWeb3();

  const web3 = window.web3!;
  const chainId = (await web3.eth.getChainId()).toString();
  const networkData = deployments.networks[chainId as keyof typeof deployments.networks];

  if (networkData && networkData.ChainTrack && networkData.ChainTrack.address) {
    const contract = new web3.eth.Contract(ChainTrackArtifact.abi as ContractAbi, networkData.ChainTrack.address);
    return { contract, web3, address: networkData.ChainTrack.address };
  }

  const available = Object.keys(deployments.networks).join(", ");
  throw new Error(
    `ChainTrack not deployed on chainId ${chainId}. Available networks: ${available}. ` +
      `Run: pnpm contracts:deploy`
  );
};

export { getContract as getChainTrack };