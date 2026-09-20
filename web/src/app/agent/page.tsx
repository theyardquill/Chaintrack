"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  LaptopMinimalCheck,
  MapPin,
  RadioTower,
  ScanLine,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { useChainTrack, useStoreState } from "@/lib/chain";
import { loadSession } from "@/lib/auth";
import { fmtDate } from "@/lib/format";

export default function AgentDashboardPage() {
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
  const [sessionId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const s = loadSession();
      return s?.type === "user" ? s.user.id : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!allowed) router.replace("/agent/login");
  }, [allowed, router]);

  const { state } = useChainTrack();
  const { userById, checkpointsForPackage } = useStoreState(state);

  if (!allowed) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Checking agent session…
      </div>
    );
  }

  const agent = sessionId ? userById(sessionId) : undefined;
  const myPackages = sessionId
    ? state.packages.filter((p) => p.activeAgentId === sessionId)
    : state.packages;
  const inProgress = state.packages.filter((p) =>
    ["Registered", "InTransit", "OutForDelivery"].includes(p.status)
  ).length;
  const delivered = state.packages.filter((p) => p.status === "Delivered").length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventsToday = state.checkpoints.filter((c) => c.timestamp >= today.getTime()).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Agent console</h1>
          <p className="text-sm text-muted-foreground">
            {agent ? `${agent.name} · ${agent.phone}` : "System view (admin)"} — packages you&apos;re
            carrying plus the shared checkpoint ledger.
          </p>
        </div>
        <Link href="/checkpoint">
          <Button>
            <RadioTower /> Log a checkpoint
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your packages</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{myPackages.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">In transit (network)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{inProgress}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivered / events today</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {delivered} <span className="text-sm font-normal text-muted-foreground">/ {eventsToday}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Packages assigned to you</CardTitle>
        </CardHeader>
        <CardContent>
          {myPackages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No packages assigned yet. When a sender books a shipment and you log its first
              checkpoint, it lands here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Contents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {myPackages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.qrHash}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{p.contentHash}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {fmtDate(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/track?code=${p.qrHash}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        <ScanLine className="h-4 w-4" /> Track
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent checkpoint events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.checkpoints.length === 0 && (
            <p className="text-sm text-muted-foreground">No events logged yet.</p>
          )}
          {[...state.checkpoints]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 6)
            .map((c) => {
              const pkg = state.packages.find((p) => p.id === c.packageId);
              const checkpoints = checkpointsForPackage(c.packageId);
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {pkg?.qrHash ?? `#${c.packageId}`} — {c.location}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <StatusBadge status={c.status} />
                      {fmtDate(c.timestamp)} · hop #{checkpoints.length}
                    </p>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Card className="bg-primary text-primary-foreground">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">
                {agent ? `${agent.name}, ready to run?` : "Admin — run the console?"}
              </p>
              <p className="text-sm text-primary-foreground/80">
                Opening the checkpoint console keeps this ledger immutable.
              </p>
            </div>
          </div>
          <Link href="/checkpoint">
            <Button
              variant="secondary"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              Open console <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Link
          href="/admin/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <LaptopMinimalCheck className="h-4 w-4" /> Admin sign in instead
        </Link>
      </div>
    </div>
  );
}