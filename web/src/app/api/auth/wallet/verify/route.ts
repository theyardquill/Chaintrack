import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getCollections } from "@/lib/db/collections";
import { hashSiweMessage, parseSiweMessage, recoverSiweAddress } from "@/lib/db/siwe";
import { hasMongoConfig } from "@/lib/db/mongo";

export const runtime = "nodejs";

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
    | { message?: string; signature?: string }
    | null;
  const { message, signature } = body ?? {};
  if (typeof message !== "string" || typeof signature !== "string") {
    return NextResponse.json({ error: "message and signature are required" }, { status: 400 });
  }

  let fields;
  try {
    fields = parseSiweMessage(message);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invalid SIWE message" },
      { status: 400 },
    );
  }

  const { host } = new URL(request.url);
  if (fields.domain !== host) {
    return NextResponse.json({ error: "domain mismatch" }, { status: 400 });
  }

  const address = fields.address.toLowerCase();
  const { siweNonces, users } = await getCollections();

  const record = await siweNonces.findOne({ _id: fields.nonce });
  if (!record) {
    return NextResponse.json({ error: "unknown or already-used nonce" }, { status: 400 });
  }
  if (record.clerkId !== userId) {
    return NextResponse.json({ error: "nonce belongs to another session" }, { status: 403 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "nonce expired" }, { status: 400 });
  }
  if (record.address !== address) {
    return NextResponse.json({ error: "address does not match the requested nonce" }, { status: 400 });
  }

  let recovered: string;
  try {
    recovered = recoverSiweAddress(message, signature).toLowerCase();
  } catch {
    return NextResponse.json({ error: "could not recover signer" }, { status: 400 });
  }
  if (recovered !== address) {
    return NextResponse.json({ error: "signature does not match address" }, { status: 400 });
  }

  await siweNonces.deleteOne({ _id: fields.nonce });

  const now = Date.now();
  await users.updateOne(
    { _id: userId },
    {
      $setOnInsert: {
        clerkId: userId,
        name: "",
        phone: "",
        role: "NONE",
        wallets: [],
        createdAt: now,
      },
      $set: { updatedAt: now },
    },
    { upsert: true },
  );

  // A wallet belongs to exactly one account.
  await users.updateMany({ clerkId: { $ne: userId } }, { $pull: { wallets: { address } } });

  const existing = await users.findOne({ _id: userId });
  const alreadyLinked = existing?.wallets?.some((w) => w.address === address) ?? false;
  if (!alreadyLinked) {
    const isPrimary = !existing?.wallets?.length;
    await users.updateOne(
      { _id: userId },
      {
        $push: {
          wallets: {
            address,
            chainId: fields.chainId,
            isPrimary,
            verifiedAt: now,
            messageHash: hashSiweMessage(message),
          },
        },
        $set: { updatedAt: now },
      },
    );
  }

  // Best-effort sync of the sign-up/sign-in details held by Clerk.
  try {
    const u = await currentUser();
    if (u) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "";
      const email =
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
        u.emailAddresses[0]?.emailAddress;
      const phone =
        u.phoneNumbers.find((p) => p.id === u.primaryPhoneNumberId)?.phoneNumber ??
        u.phoneNumbers[0]?.phoneNumber;
      const set: Record<string, unknown> = { updatedAt: Date.now() };
      if (name) set.name = name;
      if (email) set.email = email;
      if (phone) set.phone = phone;
      await users.updateOne({ _id: userId }, { $set: set });
    }
  } catch {
    // profile sync is best-effort; linking already succeeded
  }

  const user = await users.findOne({ _id: userId });
  return NextResponse.json({ ok: true, user });
}
