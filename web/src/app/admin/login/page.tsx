"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ADMIN_PASSCODE } from "@/lib/auth";
import { useAuth } from "@/lib/use-auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const { isAdmin, signInAdmin } = useAuth();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) router.replace("/admin");
  }, [isAdmin, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === ADMIN_PASSCODE) {
      signInAdmin();
    } else {
      setError("Incorrect passcode. This is a demo build — see the hint below.");
      setPasscode("");
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Admin sign in</h1>
        <p className="text-sm text-muted-foreground">
          Restricted — only administrators can access the console.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Passcode</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passcode">Admin passcode</Label>
              <Input
                id="passcode"
                type="password"
                placeholder="••••••••"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <Alert variant="default">
                <AlertTitle>Access denied</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full">
              <ShieldCheck /> Sign in as admin
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
        Demo passcode: <code className="font-mono">admin123</code>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <UserRound className="h-4 w-4" /> User sign in instead
        </Link>
      </p>
    </div>
  );
}