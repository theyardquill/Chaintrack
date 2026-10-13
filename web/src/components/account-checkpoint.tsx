"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RadioTower, Scan } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChainStatus } from "@/components/chain-status";
import { LocationPicker } from "@/components/location-picker";
import { useChainContract } from "@/lib/use-chain-contract";
import { getWalletChainId, isDeployedChain } from "@/lib/web3";
import { STATUS_LABEL, type PackageStatus, type Role } from "@/lib/types";

const NEXT_STATUS: Record<PackageStatus, PackageStatus[]> = {
  Registered: ["InTransit"],
  InTransit: ["OutForDelivery"],
  OutForDelivery: ["Delivered"],
  Delivered: [],
  Failed: [],
  Cancelled: [],
};

interface ActivePackage {
  _id: number;
  qrHash: string;
  status: PackageStatus;
  chain?: { chainId: string; contract: string; onChainId: number; txHash?: string };
}

export function AccountCheckpoint() {
  const { isLoaded, isSignedIn } = useAuth();
  const chain = useChainContract();

  const [role, setRole] = useState<Role | null>(null);
  const [myWallet, setMyWallet] = useState<string | null>(null);
  const [packages, setPackages] = useState<ActivePackage[]>([]);
  const [packageId, setPackageId] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<PackageStatus>("InTransit");
  const [busy, setBusy] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writeOnChain, setWriteOnChain] = useState(false);
  const [walletOnDeployedChain, setWalletOnDeployedChain] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    void (async () => {
      try {
        const [meRes, pkgRes] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/packages?scope=active", { cache: "no-store" }),
        ]);
        const meBody = (await meRes.json().catch(() => ({}))) as {
          user?: { role: Role; wallets: { address: string; isPrimary: boolean }[] };
        };
        const pkgBody = (await pkgRes.json().catch(() => ({}))) as { packages?: ActivePackage[] };
        if (!active) return;
        setRole(meBody.user?.role ?? null);
        setMyWallet(
          meBody.user?.wallets.find((w) => w.isPrimary)?.address ??
            meBody.user?.wallets[0]?.address ??
            null,
        );
        const loaded = pkgBody.packages ?? [];
        setPackages(loaded);
        // Default on-chain only when the package was booked on-chain and the
        // wallet is on a deployed network; otherwise log the checkpoint
        // off-chain so the demo needs no network switch or wallet.
        const walletChainId = await getWalletChainId();
        const onDeployed = walletChainId != null && isDeployedChain(walletChainId);
        setWalletOnDeployedChain(onDeployed);
        setWriteOnChain(Boolean(loaded[0]?.chain?.onChainId) && onDeployed);
        if (loaded[0]) {
          setPackageId(String(loaded[0]._id));
          setStatus(NEXT_STATUS[loaded[0].status][0] ?? "InTransit");
        }
      } catch {
        if (active) setError("could not load packages");
      }
    })();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  const activePackages = packages.filter((p) => NEXT_STATUS[p.status].length > 0);
  const current = activePackages.find((p) => p._id === Number(packageId));
  const nextOptions = current ? NEXT_STATUS[current.status] : [];
  const selectableStatus = nextOptions.includes(status) ? status : (nextOptions[0] ?? "");

  if (!isLoaded) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isSignedIn) {
    return <div className="py-20 text-center text-sm text-muted-foreground">Please sign in.</div>;
  }
  if (role && role !== "AGENT") {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-20 text-center text-sm text-muted-foreground">
        <p>Only agents can log checkpoints. Set your role on the account page.</p>
        <Link href="/account" className="text-primary hover:underline">
          Go to account
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!current) throw new Error("pick a package");
      if (!location.trim()) throw new Error("enter the checkpoint location");
      if (nextOptions.length === 0) throw new Error("this package has no further status to log");
      const nextStatus = selectableStatus as PackageStatus;

      let chainMeta: ActivePackage["chain"];
      if (writeOnChain && current.chain?.onChainId) {
        if (!myWallet) throw new Error("link a wallet on your account page first");
        const { wallet: account } = await chain.ensureConnection();
        if (account.toLowerCase() !== myWallet.toLowerCase()) {
          throw new Error("connect the wallet linked to your account");
        }
        const txHash = await chain.logCheckpoint({
          packageId: current.chain.onChainId,
          location: location.trim(),
          status: nextStatus,
        });
        chainMeta = { ...current.chain, txHash };
      }

      const res = await fetch(
        `/api/packages/${encodeURIComponent(current.qrHash)}/checkpoints`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            location: location.trim(),
            status: nextStatus,
            chain: chainMeta,
            lat: coords?.lat,
            lng: coords?.lng,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "checkpoint failed");

      setLastEvent(`${current.qrHash} → ${STATUS_LABEL[nextStatus]} at ${location.trim()}`);
      setLocation("");
      setCoords(null);
      setPackages((prev) =>
        prev
          .map((p) => (p._id === current._id ? { ...p, status: nextStatus } : p))
          .filter((p) => NEXT_STATUS[p.status].length > 0),
      );
      const following = NEXT_STATUS[nextStatus][0];
      if (following) {
        setStatus(following);
      } else {
        setPackageId("");
        setStatus("InTransit");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agent checkpoint console</h1>
        <p className="text-sm text-muted-foreground">
          Log a package&apos;s location and status. Each event is recorded in your account, and
          written on-chain too when the package is tracked on-chain.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Package</Label>
          <Select
            value={packageId}
            items={activePackages.map((p) => ({
              value: String(p._id),
              label: `${p.qrHash} · ${STATUS_LABEL[p.status]}`,
            }))}
            onValueChange={(v) => {
              setPackageId(v ?? "");
              const next = activePackages.find((p) => p._id === Number(v));
              const opts = next ? NEXT_STATUS[next.status] : [];
              setStatus(opts[0] ?? "InTransit");
              setWriteOnChain(Boolean(next?.chain?.onChainId) && walletOnDeployedChain);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an in-transit package" />
            </SelectTrigger>
            <SelectContent>
              {activePackages.map((p) => (
                <SelectItem key={p._id} value={String(p._id)}>
                  {p.qrHash} · {STATUS_LABEL[p.status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Location</Label>
          <Input
            placeholder="e.g. JKIA Cargo Terminal"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <LocationPicker coords={coords} onCoords={setCoords} onName={setLocation} />
        </div>

        <div className="space-y-2">
          <Label>Next status</Label>
          <Select
            value={selectableStatus}
            items={nextOptions.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            onValueChange={(v) => setStatus(v as PackageStatus)}
            disabled={nextOptions.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {nextOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <Alert variant="default">
            <AlertTitle>Cannot log</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {lastEvent && (
          <Alert>
            <RadioTower className="h-4 w-4" />
            <AlertTitle>Checkpoint logged</AlertTitle>
            <AlertDescription>{lastEvent}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wallet &amp; contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChainStatus chain={chain} />
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Input
                type="checkbox"
                checked={writeOnChain}
                onChange={(e) => setWriteOnChain(e.target.checked)}
                className="mt-0.5 h-4 w-4"
                disabled={!current?.chain?.onChainId}
              />
              <span>
                Write this checkpoint on-chain (requires a connected wallet).
                <span className="block text-xs text-muted-foreground">
                  {!current?.chain?.onChainId
                    ? "This package is tracked off-chain, so no wallet is needed."
                    : walletOnDeployedChain
                      ? "Uncheck to log the checkpoint off-chain in your account only."
                      : "Your wallet is on another network — switch it to the deployed network, or leave this off to log off-chain."}
                </span>
              </span>
            </label>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <Scan /> {busy ? "Logging…" : "Log checkpoint event"}
        </Button>
      </form>

      {packages.length === 0 && (
        <p className="text-sm text-muted-foreground">No in-transit packages to log right now.</p>
      )}
    </div>
  );
}
