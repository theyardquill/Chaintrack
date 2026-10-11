"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Role } from "@/lib/types";

const OPTIONS: { role: Role; label: string; description: string }[] = [
  { role: "SENDER", label: "Sender", description: "Book shipments and fund escrows." },
  { role: "RECEIVER", label: "Receiver", description: "Receive packages and confirm delivery." },
  { role: "AGENT", label: "Agent", description: "Carry packages and log checkpoints." },
];

export function AccountRoleCard() {
  const { isSignedIn } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { user?: { role?: Role } };
        if (active && res.ok) setRole(body.user?.role ?? "NONE");
      } catch {
        if (active) setError("could not load your role");
      }
    })();
    return () => {
      active = false;
    };
  }, [isSignedIn]);

  async function choose(next: Role) {
    setSaving(next);
    setError(null);
    try {
      const res = await fetch("/api/account/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const body = (await res.json().catch(() => ({}))) as { user?: { role?: Role }; error?: string };
      if (!res.ok) throw new Error(body.error ?? "could not save role");
      setRole(body.user?.role ?? next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not save role");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Role</CardTitle>
        <CardDescription>
          Choose how you use ChainTrack. This sets which dashboard and actions you see.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const active = role === o.role;
            return (
              <button
                key={o.role}
                type="button"
                onClick={() => choose(o.role)}
                disabled={saving !== null}
                className={`rounded-md border px-3 py-2 text-left transition-colors ${
                  active ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  {saving === o.role && <Loader2 className="h-3 w-3 animate-spin" />}
                  {o.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{o.description}</p>
              </button>
            );
          })}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {role === "NONE" && !error && (
          <p className="text-sm text-muted-foreground">No role selected yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
