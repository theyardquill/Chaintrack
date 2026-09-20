"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, RefreshCcw, UserPlus, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { useChainTrack, useStoreState } from "@/lib/chain";
import { loadSession } from "@/lib/auth";
import { TXN_LABEL, type Role } from "@/lib/types";
import { fmtAmount, fmtDate } from "@/lib/format";

const ROLE_BADGE: Record<Role, string> = {
  NONE: "bg-muted text-muted-foreground",
  SENDER: "bg-sky-100 text-sky-700",
  RECEIVER: "bg-violet-100 text-violet-700",
  AGENT: "bg-orange-100 text-orange-700",
};

export default function AdminPage() {
  const router = useRouter();
  const [authed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return loadSession()?.type === "admin";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!authed) router.replace("/admin/login");
  }, [authed, router]);

  if (!authed) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Checking admin session…
      </div>
    );
  }

  return <AdminShell />;
}

function AdminShell() {
  const { state, register, reset } = useChainTrack();
  const { userById } = useStoreState(state);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("SENDER");

  const totalEscrow = state.transactions
    .filter((t) => t.status === "InEscrow")
    .reduce((acc, t) => acc + t.amount, 0);

  const overseers = state.users.filter((u) => u.role === "AGENT").length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = register(name.trim(), phone.trim(), role);
    void id;
    setName("");
    setPhone("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admin console</h1>
          <p className="text-sm text-muted-foreground">
            Registered users, escrow overview and the live ledger.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCcw /> Reset demo data
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserPlus className="h-4 w-4" /> Members
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{state.users.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4" /> Escrow locked
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {totalEscrow.toFixed(3)} <span className="text-sm text-muted-foreground">ETH eq.</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" /> Active agents
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{overseers}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Register a participant</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>Name</Label>
              <Input placeholder="Full name or company" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="w-44 space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+2547…" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="w-40 space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole((v as Role) ?? "SENDER")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SENDER">Sender</SelectItem>
                  <SelectItem value="RECEIVER">Receiver</SelectItem>
                  <SelectItem value="AGENT">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">
              <UserPlus /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.id}</TableCell>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge className={ROLE_BADGE[u.role]}>{u.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Packages & escrow</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Escrow</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.packages.map((p) => {
                const txn = state.transactions.find((t) => t.packageId === p.id);
                const sender = userById(p.senderId);
                const receiver = userById(p.receiverId);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.qrHash}</TableCell>
                    <TableCell className="text-sm">
                      {sender?.name ?? "—"} → {receiver?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                        {txn ? `${TXN_LABEL[txn.status]} · ${fmtAmount(txn.amount, txn.currency)}` : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fmtDate(p.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}