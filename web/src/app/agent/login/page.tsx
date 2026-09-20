"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, PackageCheck, UserRound, UserRoundPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useChainTrack } from "@/lib/chain";
import { useAuth } from "@/lib/use-auth";

export default function AgentLoginPage() {
  const router = useRouter();
  const { state, register } = useChainTrack();
  const { isAgent, isAdmin, signInAs } = useAuth();

  const [tab, setTab] = useState("existing");
  const [form, setForm] = useState({ name: "", phone: "" });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isAgent || isAdmin) router.replace("/agent");
  }, [isAgent, isAdmin, router]);

  const agents = state.users.filter((u) => u.role === "AGENT");

  const signIn = (id: number) => {
    const user = state.users.find((u) => u.id === id);
    if (!user) return;
    signInAs(user);
  };

  const createAgent = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (name.length < 2) {
      setFormError("Enter the agent's full name.");
      return;
    }
    if (phone.length < 8 || !/^\+?[\d\s-]+$/.test(phone)) {
      setFormError("Enter a valid phone number, e.g. +2547…");
      return;
    }
    const dup = state.users.some((u) => u.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""));
    if (dup) {
      setFormError("A profile with this phone number already exists.");
      return;
    }
    const userId = register(name, phone, "AGENT");
    const created = state.users.find((u) => u.id === userId) ?? {
      id: userId,
      name,
      phone,
      role: "AGENT" as const,
    };
    signInAs(created);
    setForm({ name: "", phone: "" });
  };

  if (isAgent || isAdmin) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Redirecting to the agent console…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Agent sign in</h1>
        <p className="text-sm text-muted-foreground">
          Logistics agents and couriers sign in here to run the checkpoint console.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v ?? "existing")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="existing">Agent profile</TabsTrigger>
          <TabsTrigger value="new">
            <PackageCheck className="mr-1 h-4 w-4" /> New agent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="existing">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registered agents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No agents registered yet — create one on the &quot;New agent&quot; tab.
                </p>
              )}
              {agents.map((u) => (
                <div key={u.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.phone}</p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-200">
                    AGENT
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => signIn(u.id)}>
                    <LogIn /> Sign in
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Register an agent</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createAgent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agent-name">Full name</Label>
                  <Input
                    id="agent-name"
                    placeholder="e.g. Courier Corp"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agent-phone">Phone</Label>
                  <Input
                    id="agent-phone"
                    placeholder="+254711000003"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                {formError && (
                  <Alert variant="default">
                    <AlertTitle>Cannot create agent</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full">
                  <UserRoundPlus /> Create agent &amp; sign in
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <UserRound className="h-4 w-4" /> User sign in instead
        </Link>
      </p>
    </div>
  );
}