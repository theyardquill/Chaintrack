"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WalletLinkCard } from "@/components/wallet-link";

const clerkEnabled = (process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? "demo") === "clerk";

// Only mounted under Clerk, so ClerkProvider / useUser are guaranteed present.
function AccountInner() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">Loading account…</div>
    );
  }
  if (!isSignedIn) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">Please sign in.</div>
    );
  }

  const name = user.fullName || user.username || "—";
  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  const phone = user.primaryPhoneNumber?.phoneNumber ?? user.phoneNumbers[0]?.phoneNumber;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Account</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Sign-up / sign-in details held by your account provider (Clerk).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="User id" value={<span className="font-mono text-xs">{user.id}</span>} />
          <Row label="Name" value={name} />
          <Row label="Email" value={email ?? "—"} />
          <Row label="Phone" value={phone ?? "—"} />
        </CardContent>
      </Card>

      <WalletLinkCard />
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}

export default function AccountPage() {
  if (!clerkEnabled) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center text-sm text-muted-foreground">
        Wallet linking is available when Clerk auth is enabled.{" "}
        <Link href="/login" className="text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }
  return <AccountInner />;
}
