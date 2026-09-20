"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RadioTower, Scan } from "lucide-react";
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
import { StatusBadge } from "@/components/status-badge";
import { useChainTrack, useStoreState } from "@/lib/chain";
import { loadSession } from "@/lib/auth";
import { STATUS_LABEL, type PackageStatus } from "@/lib/types";
import { fmtDate } from "@/lib/format";

const NEXT_STATUS: Record<PackageStatus, PackageStatus[]> = {
  Registered: ["InTransit"],
  InTransit: ["OutForDelivery"],
  OutForDelivery: [],
  Delivered: [],
  Failed: [],
  Cancelled: [],
};

export default function CheckpointPage() {
  const router = useRouter();
  const [allowed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const s = loadSession();
      return s?.type === "admin" || (s?.type === "user" && s.user.role === "AGENT");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!allowed) router.replace("/agent/login");
  }, [allowed, router]);

  const { state, track } = useChainTrack();
  const { checkpointsForPackage } = useStoreState(state);

  const activePackages = state.packages.filter((p) => NEXT_STATUS[p.status].length > 0);
  const [packageId, setPackageId] = useState<string>("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<PackageStatus>("InTransit");
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = state.packages.find((p) => p.id === Number(packageId));
  const nextOptions = current ? NEXT_STATUS[current.status] : [];
  const selectedCheckpoints = packageId
    ? checkpointsForPackage(Number(packageId))
    : [];

  if (!allowed) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Agents only — signing you into the console…
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!packageId || !location.trim()) {
      setError("Pick a package and enter the checkpoint location.");
      return;
    }
    const s = loadSession();
    const agentId = s?.type === "user" ? s.user.id : undefined;
    track(location.trim(), status, Number(packageId), agentId);
    setLastEvent(`${current?.qrHash} → ${STATUS_LABEL[status]} at ${location.trim()}`);
    setLocation("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Agent checkpoint console</h1>
        <p className="text-sm text-muted-foreground">
          Scan a package QR and log its location and status. Each event is appended to the
          immutable ledger.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Not your console?{" "}
          <Link href="/agent" className="font-medium text-primary hover:underline">
            Go to agent dashboard
          </Link>
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Package</Label>
          <Select
                value={packageId}
                onValueChange={(v) => {
                  setPackageId(v ?? "");
                  setStatus(nextOptions[0] ?? "InTransit");
                }}
              >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an in-transit package" />
            </SelectTrigger>
            <SelectContent>
              {activePackages.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
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
        </div>
        <div className="space-y-2">
          <Label>Next status</Label>
          <Select
            value={status}
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

        <Button type="submit" size="lg" className="w-full">
          <Scan /> Log checkpoint event
        </Button>
      </form>

      {selectedCheckpoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {current?.qrHash} · checkpoint history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedCheckpoints.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <StatusBadge status={c.status} />
                <span className="text-sm">{c.location}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {fmtDate(c.timestamp)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}