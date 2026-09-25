"use client";

import { Link2, Radio, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ChainContractApi } from "@/lib/use-chain-contract";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function ChainStatus({ chain }: { chain: ChainContractApi }) {

  if (chain.status === "idle") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void chain.connectWallet()}
      >
        <Wallet className="h-4 w-4" /> Connect wallet to unlock on-chain escrow
      </Button>
    );
  }

  if (chain.status === "checking") {
    return <p className="text-xs text-muted-foreground">Checking chain connection…</p>;
  }

  if (chain.status === "unavailable") {
    return (
      <Alert variant="default" className="py-3">
        <AlertDescription className="text-xs">{chain.error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <Link2 className="h-3.5 w-3.5" />
        {short(chain.connection?.address ?? "")}
      </span>
      <span className="inline-flex items-center gap-1">
        <Radio className="h-3 w-3" /> chain {chain.connection?.chainId}
      </span>
      <span className="inline-flex items-center gap-1">
        <Wallet className="h-3 w-3" /> {short(chain.wallet ?? "")}
      </span>
      {chain.owner && (
        <span className={chain.isOwner ? "text-emerald-600" : ""}>
          {chain.isOwner ? "registry owner" : `owner: ${short(chain.owner)}`}
        </span>
      )}
      {chain.identity && (
        <span className="text-foreground">
          · on-chain: {chain.identity.name} #{chain.identity.id} · {chain.identity.role}
        </span>
      )}
    </div>
  );
}