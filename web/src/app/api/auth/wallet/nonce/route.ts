import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { getCollections } from "@/lib/db/collections";
import { createSiweMessage } from "@/lib/db/siwe";
import { hasMongoConfig } from "@/lib/db/mongo";

export const runtime = "nodejs";

const NONCE_TTL_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  if (!process.env.CLERK_SECRET_KEY) {
    return NextResponse.json({ error: "auth provider is not clerk" }, { status: 501 });
  }
  if (!hasMongoConfig()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { address?: string; chainId?: string }
    | null;
  const address = body?.address?.toLowerCase();
  if (!address || !/^0x[a-f0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const { host } = new URL(request.url);
  const chainId = String(body?.chainId ?? "1337");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + NONCE_TTL_MS);
  const nonce = randomBytes(16).toString("hex");

  const message = createSiweMessage({
    domain: host,
    address,
    uri: `https://${host}`,
    chainId,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expirationTime: expiresAt.toISOString(),
    statement: "Sign in to ChainTrack and link this wallet to your account.",
  });

  const { siweNonces } = await getCollections();
  await siweNonces.insertOne({
    _id: nonce,
    clerkId: userId,
    address,
    domain: host,
    chainId,
    issuedAt: issuedAt.getTime(),
    expiresAt,
  });

  return NextResponse.json({ message, nonce, expiresAt: expiresAt.toISOString() });
}
