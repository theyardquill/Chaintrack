import Web3 from "web3";

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