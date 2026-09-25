"use client";

import { useCallback, useState } from "react";
import type { ChainTrackState, Checkpoint, Package, Role, Transaction, User } from "./types";
import {
  bindWallet as bindWalletInDemo,
  bookShipment as bookInDemo,
  cancelShipment as cancelInDemo,
  confirmDelivery as confirmInDemo,
  loadDemo,
  logCheckpoint as logInDemo,
  registerUser as registerInDemo,
  resetDemo,
  saveDemo,
} from "./demo";

export interface BookShipmentInput {
  qrHash: string;
  content: string;
  weight: number;
  size: string;
  senderId: number;
  receiverId: number;
  amount: number;
  currency: string;
  deliveryCode: string;
}

export function useChainTrack() {
  const [state, setState] = useState<ChainTrackState>(() => loadDemo());
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);

  const update = useCallback((next: ChainTrackState) => {
    setState(next);
    saveDemo(next);
  }, []);

  const book = useCallback(
    (input: BookShipmentInput): Package | null => {
      const { state: next } = bookInDemo(state, input);
      update(next);
      return next.packages.find((p) => p.qrHash === input.qrHash) ?? null;
    },
    [state, update]
  );

  const track = useCallback(
    (location: string, status: Checkpoint["status"], packageId: number, agentId?: number) => {
      // checkpoints can only advance status
      const next = logInDemo(state, { packageId, location, status, agentId });
      update(next);
    },
    [state, update]
  );

  const confirm = useCallback(
    (packageId: number, deliveryCode: string) => {
      const next = confirmInDemo(state, { packageId, deliveryCode });
      update(next);
    },
    [state, update]
  );

  const cancel = useCallback(
    (packageId: number) => {
      update(cancelInDemo(state, packageId));
    },
    [state, update]
  );

  const register = useCallback(
    (name: string, phone: string, role: Role): number => {
      const { state: next, userId } = registerInDemo(state, { name, phone, role });
      update(next);
      return userId;
    },
    [state, update]
  );

  const reset = useCallback(() => {
    setState(resetDemo());
  }, []);

  const bindWallet = useCallback(
    (userId: number, wallet: string) => {
      update(bindWalletInDemo(state, userId, wallet));
    },
    [state, update]
  );

  const connectWallet = useCallback(async () => {
    try {
      const { getActiveAccount } = await import("./web3");
      const account = await getActiveAccount();
      setWallet(account);
      setWalletError(null);
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return {
    state,
    wallet,
    walletError,
    connectWallet,
    book,
    track,
    confirm,
    cancel,
    register,
    reset,
    bindWallet,
  };
}

export function useStoreState(state: ChainTrackState) {
  return {
    userById: (id: number): User | undefined => state.users.find((u) => u.id === id),
    txnForPackage: (packageId: number): Transaction | undefined =>
      state.transactions.find((t) => t.packageId === packageId),
    checkpointsForPackage: (packageId: number): Checkpoint[] =>
      state.checkpoints
        .filter((c) => c.packageId === packageId)
        .sort((a, b) => b.timestamp - a.timestamp),
    packageByCode: (code: string): Package | undefined =>
      state.packages.find((p) => p.qrHash.toLowerCase() === code.trim().toLowerCase()),
  };
}