"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export interface WalletContextValue {
  wallet: string | null;
  walletError: string | null;
  connecting: boolean;
  connectWallet: () => Promise<string | null>;
  setWallet: (address: string | null) => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

function ethereum(): Eip1193Provider | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
}

// Single source of truth for the connected wallet across the whole app: the
// header, checkpoint logging, and escrow booking all read the same state.
export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connectWallet = useCallback(async (): Promise<string | null> => {
    setConnecting(true);
    setWalletError(null);
    try {
      const { getActiveAccount } = await import("./web3");
      const account = await getActiveAccount();
      setWallet(account);
      return account;
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setWallet(null), []);

  useEffect(() => {
    const eth = ethereum();
    if (!eth?.on) return;
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[]) ?? [];
      setWallet(accounts.length > 0 ? accounts[0] : null);
    };
    eth.on("accountsChanged", onAccountsChanged);
    return () => eth.removeListener?.("accountsChanged", onAccountsChanged);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({ wallet, walletError, connecting, connectWallet, setWallet, disconnect }),
    [wallet, walletError, connecting, connectWallet, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
