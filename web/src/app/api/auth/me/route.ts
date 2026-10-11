import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getCollections } from "@/lib/db/collections";
import { hasMongoConfig } from "@/lib/db/mongo";

export const runtime = "nodejs";

export async function GET() {
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

  const { users } = await getCollections();
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

  // Keep non-address profile fields fresh from Clerk on each load.
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
      const set: Record<string, unknown> = {};
      if (name) set.name = name;
      if (email) set.email = email;
      if (phone) set.phone = phone;
      if (Object.keys(set).length > 0) {
        await users.updateOne({ _id: userId }, { $set: set });
      }
    }
  } catch {
    // profile sync is best-effort
  }

  const user = await users.findOne({ _id: userId });
  return NextResponse.json({ user });
}
