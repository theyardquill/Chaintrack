"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useChainTrack } from "@/lib/chain";
import { useAuth } from "@/lib/use-auth";
import type { Role, User } from "@/lib/types";

const ROLE_OPTIONS: { value: Role; hint: string }[] = [
  { value: "SENDER", hint: "Ship packages" },
  { value: "RECEIVER", hint: "Receive packages" },
  { value: "AGENT", hint: "Logistics / courier" },
];

const ROLE_STYLE: Record<Role, string> = {
  NONE: "bg-muted text-muted-foreground",
  SENDER: "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200",
  RECEIVER: "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200",
  AGENT: "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-200",
};

export default function LoginPage() {
  const { state, register } = useChainTrack();
  const { session, signInAs } = useAuth();

  const [form, setForm] = useState({ name: "", phone: "", role: "SENDER" as Role });
  const [formError, setFormError] = useState<string | null>(null);

  const signIn = (id: number) => {
    const user = state.users.find((u) => u.id === id);
    if (!user) return;
    signInAs(user);
  };

  const createAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (name.length < 2) {
      setFormError("Enter your full name.");
      return;
    }
    if (phone.length < 8 || !/^\+?[\d\s-]+$/.test(phone)) {
      setFormError("Enter a valid phone number, e.g. +2547…");
      return;
    }
    const dup = state.users.some(
      (u) => u.phone.replace(/\D/g, "") === phone.replace(/\D/g, "")
    );
    if (dup) {
      setFormError("A profile with this phone number already exists — sign in as them above.");
      return;
    }
    const userId = register(name, phone, form.role);
    const created: User = state.users.find((u) => u.id === userId) ?? {
      id: userId,
      name,
      phone,
      role: form.role,
    };
    signInAs(created);
    setForm({ name: "", phone: "", role: "SENDER" });
    setFormError(null);
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Pick your registered profile, or create a new account. Senders, receivers and logistics
          agents sign in here.
        </p>
      </div>

      {session?.type === "user" && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Signed in as {session.user.name}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Role: {session.user.role}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/dashboard">
                <Button size="sm">Open my dashboard</Button>
              </Link>
              <Link href="/track">
                <Button size="sm" variant="outline">
                  Track a package
                </Button>
              </Link>
              <Link href="/ship">
                <Button size="sm" variant="outline">
                  Book a shipment
                </Button>
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {session?.type !== "user" && (
        <Tabs defaultValue="existing">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Choose a profile</TabsTrigger>
            <TabsTrigger value="new">
              <UserPlus className="mr-1 h-4 w-4" /> New user
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Registered profiles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {state.users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.phone}</p>
                    </div>
                    <Badge className={ROLE_STYLE[u.role]}>{u.role}</Badge>
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
                <CardTitle className="text-base">Create your account</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createAccount} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Jina Uko"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="+254711000000"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>You are a…</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) => setForm({ ...form, role: (v as Role) ?? "SENDER" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(({ value, hint }) => (
                          <SelectItem key={value} value={value}>
                            {value} — {hint}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formError && (
                    <Alert variant="default">
                      <AlertTitle>Cannot create account</AlertTitle>
                      <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="w-full">
                    <UserPlus /> Create account
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <div className="space-y-2 text-center text-sm text-muted-foreground">
        <p>
          Are you a courier?{" "}
          <Link href="/agent/login" className="font-medium text-primary hover:underline">
            Agent sign in
          </Link>
        </p>
        <p>
          Running the logistics operation?{" "}
          <Link
            href="/admin/login"
            className="inline-flex items-center justify-center gap-1 font-medium text-primary hover:underline"
          >
            <ShieldCheck className="h-4 w-4" /> Admin sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}