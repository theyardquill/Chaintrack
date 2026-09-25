"use client";

import { useCallback, useEffect, useState } from "react";
import { useChainTrack } from "./chain";
import type { Checkpoint, Package, PackageStatus, Role, Transaction } from "./types";
import type { ChainUser } from "./web3";
import {
  chainBookShipment,
  chainCancelShipment,
  chainConfirmDelivery,
  chainGetCheckpoints,
  chainGetPackageByCode,
  chainGetTransaction,
  chainGetUserByAddress,
  chainLogCheckpoint,
  chainRegisterUser,
  getChainTrack,
  type ChainTrackConnection,
} from "./web3";

export type ChainStatus = "idle" | "checking" | "ready" | "unavailable";

export interface ChainContractApi {
  connect: () => Promise<void>;
  connectWallet: () => Promise<void>;
  wallet: string | null;
  status: ChainStatus;
  connection: ChainTrackConnection | null;
  error: string | null;
  owner: string | null;
  isOwner: boolean;
  identity: ChainUser | null;
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
  const { wallet, connectWallet } = useChainTrack();
  const [status, setStatus] = useState<ChainStatus>("idle");
  const [connection, setConnection] = useState<ChainTrackConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [identity, setIdentity] = useState<ChainUser | null>(null);

  const syncProfile = useCallback(async (connection: ChainTrackConnection | null) => {
    await Promise.resolve();
    if (!connection || !wallet) {
      setOwner(null);
      setIdentity(null);
      return;
    }
    try {
      const theOwner = String(await connection.contract.methods.owner().call());
      setOwner(theOwner);
    } catch {
      setOwner(null);
    }
    try {
      setIdentity(await chainGetUserByAddress(wallet));
    } catch {
      setIdentity(null);
    }
  }, [wallet]);

  const connect = useCallback(async () => {
    await Promise.resolve();
    try {
      setError(null);
      setStatus("checking");
      const connection = await getChainTrack();
      setConnection(connection);
      setStatus("ready");
      void syncProfile(connection);
    } catch (err) {
      setConnection(null);
      setStatus("unavailable");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [syncProfile]);

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
        void syncProfile(connection);
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
  }, [wallet, syncProfile]);

  const ready = wallet !== null && status === "ready";
  const isOwner =
    ready && owner !== null && wallet !== null
      ? owner.toLowerCase() === wallet.toLowerCase()
      : false;

  return {
    connect,
    connectWallet,
    wallet,
    status: ready ? status : "idle",
    connection: ready ? connection : null,
    error: ready ? error : null,
    owner: ready ? owner : null,
    isOwner: ready && isOwner,
    identity: ready ? identity : null,
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