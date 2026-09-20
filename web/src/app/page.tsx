import Link from "next/link";
import {
  BarChart3,
  Boxes,
  Coins,
  Fingerprint,
  Lock,
  QrCode,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Boxes,
    title: "Immutable tracking ledger",
    body: "Every checkpoint scan is written to the blockchain, keyed to a package QR. The full journey is tamper-proof and auditable by anyone.",
  },
  {
    icon: Coins,
    title: "Smart-contract escrow",
    body: "Payment is locked at shipment and automatically released to the sender only after the recipient confirms delivery — no trust required.",
  },
  {
    icon: Lock,
    title: "Cross-border crypto payments",
    body: "Settle in ETH (and BTC via bridge) across borders without bank delays. Currency, amounts and status live on-chain.",
  },
  {
    icon: Fingerprint,
    title: "Checkpoint MFA",
    body: "Agents authenticate at every checkpoint and recipients confirm high-value deliveries with a one-time code.",
  },
  {
    icon: ScanSearch,
    title: "AI route & risk insights",
    body: "Fraud/anomaly detection, route optimization and demand prediction flag issues before they become delays.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Senders, receivers and logistics agents each have scoped permissions. Package contents stay confidential.",
  },
];

const STEPS = [
  { n: "01", title: "Book a shipment", body: "Sender books the package, deposits escrow, and a unique QR is generated." },
  { n: "02", title: "Scan at checkpoints", body: "Agents scan the QR at each hub; events are appended to the on-chain ledger." },
  { n: "03", title: "Confirm delivery", body: "The recipient confirms receipt with an MFA code." },
  { n: "04", title: "Escrow released", body: "Funds are released to the sender and the receipt is finalized on-chain." },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="mx-auto max-w-3xl space-y-6 pt-10 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <QrCode className="h-3.5 w-3.5" /> Kenya-first · shipping & supply chain
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Ship it. Track it.{" "}
          <span className="text-primary">Pay for it when it arrives.</span>
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          ChainTrack combines a blockchain shipping ledger, smart-contract escrow and AI
          insights so international shipments are transparent and payments only settle on
          confirmed delivery.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/ship" className={buttonVariants({ size: "lg" })}>
            Book a shipment
          </Link>
          <Link
            href="/track?code=CTK-0001"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Track a package
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4 text-primary" /> {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-6">
        <h2 className="text-center text-2xl font-semibold">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <Card key={s.n}>
              <CardHeader>
                <span className="font-mono text-xs text-primary">{s.n}</span>
                <CardTitle className="text-base">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{s.body}</CardContent>
            </Card>
          ))}
        </div>
        <div className="flex justify-center pt-2">
          <Link href="/checkpoint" className={buttonVariants({ variant: "outline" })}>
            <BarChart3 className="h-4 w-4" /> Try the agent checkpoint console
          </Link>
        </div>
      </section>
    </div>
  );
}