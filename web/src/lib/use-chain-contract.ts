"use client";

import { useCallback, useEffect, useState } from "react";
import { useChainTrack } from "./chain";
import type { Checkpoint, Package, PackageStatus, Role, Transaction } from "./types";
import {
  chainBookShipment,
  chainCancelShipment,
  chainConfirmDelivery,
  chainGetCheckpoints,
  chainGetPackageByCode,
  chainGetTransaction,
  chainLogCheckpoint,
  chainRegisterUser,
  getChainTrack,
  type ChainTrackConnection,
} from "./web3";

export type ChainStatus = "idle" | "checking" | "ready" | "unavailable";

export interface ChainContractApi {
  connect: () => Promise<void>;
  status: ChainStatus;
  connection: ChainTrackConnection | null;
  error: string | null;
  getByCode: (code: string) => Promise<Package | null>;
  getTransaction: (packageId: number) => Promise<Transaction>;
  getCheckpoints: (packageId: number) => Promise<Checkpoint[]>;
  registerUser: (args: {
    address: string;
    name: string;
    phone: string;
    role: Role;
  }) => Promise<string>;
  bookShipment: (
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
  ) => Promise<{ packageId: number; txHash: string; amount: string }>;
  logCheckpoint: (args: {
    packageId: number;
    location: string;
    status: PackageStatus;
  }) => Promise<string>;
  confirmDelivery: (args: {
    packageId: number;
    deliveryCode: string;
  }) => Promise<string>;
  cancelShipment: (packageId: number) => Promise<string>;
}

/**
 * Client-side bridge to the deployed ChainTrack contract. Everything is lazy:
 * no chain calls happen until a wallet is connected AND the contract address is
 * configured for the current network. This keeps the app fully usable in demo
 * mode and guarantees Vercel builds are unaffected.
 */
export function useChainContract(): ChainContractApi {
  const { wallet } = useChainTrack();
  const [status, setStatus] = useState<ChainStatus>("idle");
  const [connection, setConnection] = useState<ChainTrackConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    await Promise.resolve();
    try {
      setError(null);
      setStatus("checking");
      const connection = await getChainTrack();
      setConnection(connection);
      setStatus("ready");
    } catch (err) {
      setConnection(null);
      setStatus("unavailable");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (!wallet) return;
    let active = true;
    const run = async () => {
      await Promise.resolve();
      setError(null);
      setStatus("checking");
      try {
        const connection = await getChainTrack();
        if (!active) return;
        setConnection(connection);
        setStatus("ready");
      } catch (err) {
        if (!active) return;
        setConnection(null);
        setStatus("unavailable");
        setError(err instanceof Error ? err.message : String(err));
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [wallet]);

  const ready = wallet !== null && status === "ready";

  return {
    connect,
    status: ready ? status : "idle",
    connection: ready ? connection : null,
    error: ready ? error : null,
    getByCode: chainGetPackageByCode,
    getTransaction: chainGetTransaction,
    getCheckpoints: chainGetCheckpoints,
    registerUser: chainRegisterUser,
    bookShipment: chainBookShipment,
    logCheckpoint: chainLogCheckpoint,
    confirmDelivery: chainConfirmDelivery,
    cancelShipment: chainCancelShipment,
  };
}