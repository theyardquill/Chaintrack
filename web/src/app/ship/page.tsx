"use client";

import { useMemo, useState } from "react";
import { Copy, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChainStatus } from "@/components/chain-status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PackageCard } from "@/components/package-card";
import { useChainTrack, useStoreState } from "@/lib/chain";
import { useChainContract } from "@/lib/use-chain-contract";
import { chainGetUserByAddress } from "@/lib/web3";
import type { Package } from "@/lib/types";

const SIZES = ["S", "M", "L", "XL"];
const CURRENCIES = ["ETH", "BTC", "USDT", "KES"];

export default function ShipPage() {
  const { state, book } = useChainTrack();
  const chain = useChainContract();
  const { userById } = useStoreState(state);

  const senders = state.users.filter((u) => u.role === "SENDER");
  const receivers = state.users.filter((u) => u.role === "RECEIVER");

  const [senderId, setSenderId] = useState<string>(senders[0]?.id.toString() ?? "");
  const [receiverId, setReceiverId] = useState<string>(receivers[0]?.id.toString() ?? "");
  const [content, setContent] = useState("");
  const [weight, setWeight] = useState("1");
  const [size, setSize] = useState("M");
  const [amount, setAmount] = useState("0.1");
  const [currency, setCurrency] = useState("ETH");
  const [deliveryCode, setDeliveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Package | null>(null);
  const [copied, setCopied] = useState(false);
  const [recordOnChain, setRecordOnChain] = useState(false);
  const [chainMsg, setChainMsg] = useState<string | null>(null);
  const [chainErr, setChainErr] = useState<string | null>(null);

  const qrHash = useMemo(
    () => `CTK-${String(state.packages.length + 1).padStart(4, "0")}`,
    [state.packages.length]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const sender = Number(senderId);
    const receiver = Number(receiverId);
    if (!sender || !receiver || sender === receiver) {
      setError("Pick a sender and a different receiver from the registry.");
      return;
    }
    if (!content.trim()) {
      setError("Describe the package contents.");
      return;
    }
    if (Number(amount) <= 0) {
      setError("Escrow amount must be greater than zero.");
      return;
    }
    if (deliveryCode.trim().length < 4) {
      setError("The recipient delivery code must be at least 4 characters.");
      return;
    }

    const created = book({
      qrHash,
      content,
      weight: Number(weight),
      size,
      senderId: sender,
      receiverId: receiver,
      amount: Number(amount),
      currency,
      deliveryCode,
    });

    setBooked(created);
    setContent("");
    setDeliveryCode("");

    setChainMsg(null);
    setChainErr(null);
    if (recordOnChain) {
      void (async () => {
        try {
          if (currency !== "ETH") {
            throw new Error("On-chain escrow currently records in ETH only.");
          }
          const snd = userById(sender);
          if (!snd?.wallet) {
            throw new Error(
              "The sender has no on-chain wallet yet — register them in the admin console."
            );
          }
          if (snd.wallet.toLowerCase() !== (chain.wallet ?? "").toLowerCase()) {
            throw new Error("Connect the sender's wallet to record on-chain.");
          }
          const recv = userById(receiver);
          if (!recv?.wallet) {
            throw new Error(
              "The receiver has no on-chain wallet yet — register them in the admin console."
            );
          }
          const onChainReceiver = await chainGetUserByAddress(recv.wallet);
          const hash = await chain.bookShipment(
            {
              qrHash,
              contentHash: content,
              weight: Number(weight),
              size,
              receiverId: onChainReceiver.id,
              deliveryCode,
              currency: "ETH",
            },
            String(amount)
          );
          setChainMsg(
            `Booked on-chain · package #${hash.packageId} · tx ${hash.txHash}`
          );
        } catch (err) {
          setChainErr(err instanceof Error ? err.message : String(err));
        }
      })();
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/track?code=${booked?.qrHash}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Book a shipment</h1>
        <p className="text-sm text-muted-foreground">
          The escrow amount is locked on the ledger and released when the recipient confirms
          delivery.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Sender</Label>
            <Select value={senderId} onValueChange={(v) => setSenderId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select sender" />
              </SelectTrigger>
              <SelectContent>
                {senders.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.name} · {u.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Receiver</Label>
            <Select value={receiverId} onValueChange={(v) => setReceiverId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select receiver" />
              </SelectTrigger>
              <SelectContent>
                {receivers.map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.name} · {u.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Package contents (confidential)</Label>
          <Input
            placeholder="e.g. electronics, documents…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Weight (kg)</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Size</Label>
            <Select value={size} onValueChange={(v) => setSize(v ?? "M")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tracking code</Label>
            <Input value={qrHash} readOnly className="font-mono" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Escrow amount</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v ?? "ETH")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Recipient delivery code</Label>
            <Input
              placeholder="MFA code for confirmation"
              value={deliveryCode}
              onChange={(e) => setDeliveryCode(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        {error && (
          <Alert variant="default">
            <AlertTitle>Cannot book</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record on-chain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChainStatus chain={chain} />
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Input
                type="checkbox"
                checked={recordOnChain}
                onChange={(e) => setRecordOnChain(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                Also book this shipment on the ChainTrack contract as ETH escrow.
                <span className="block text-xs text-muted-foreground">
                  The sender&apos;s wallet must be connected and both parties must be registered
                  on-chain (register them in the admin console).
                </span>
              </span>
            </label>
            {recordOnChain && currency !== "ETH" && (
              <p className="text-xs text-amber-600">
                Switch the escrow currency to ETH to record on-chain.
              </p>
            )}
            {chainMsg && (
              <Alert>
                <AlertTitle className="text-xs">On-chain booking confirmed</AlertTitle>
                <AlertDescription className="font-mono break-all text-xs">
                  {chainMsg}
                </AlertDescription>
              </Alert>
            )}
            {chainErr && (
              <Alert variant="default" className="py-3">
                <AlertTitle className="text-xs">On-chain booking failed</AlertTitle>
                <AlertDescription className="text-xs">{chainErr}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full">
          <Send /> Book shipment & lock escrow
        </Button>
      </form>

      {booked && (
        <div className="space-y-4">
          <Alert>
            <AlertTitle>Shipment booked</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                {booked.qrHash} registered. Funds are now in escrow with the chain —
                send this link to your recipient:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-muted px-2 py-1 text-xs">
                  {`${window.location.origin}/track?code=${booked.qrHash}`}
                </code>
                <Button type="button" size="sm" variant="outline" onClick={copyLink}>
                  <Copy /> {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shipment QR</CardTitle>
            </CardHeader>
            <CardContent>
              <PackageCard state={state} pkg={booked} showQr />
            </CardContent>
          </Card>
        </div>
      )}

      {senders.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No senders in the registry yet. Register one from the admin console.
        </p>
      )}
      {senders.length > 0 && !booked && (
        <p className="text-sm text-muted-foreground">
          Sender: {userById(Number(senderId))?.name ?? "-"} · Receiver:{" "}
          {userById(Number(receiverId))?.name ?? "-"}
        </p>
      )}
    </div>
  );
}