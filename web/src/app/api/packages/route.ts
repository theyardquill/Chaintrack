import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { hasMongoConfig } from "@/lib/db/mongo";
import { bookShipment, getAccountOverview, listActivePackages, redactPackage } from "@/lib/db/repo";
import { ChainMetaSchema } from "@/lib/db/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

  const scope = new URL(request.url).searchParams.get("scope");
  if (scope === "active") {
    const packages = await listActivePackages();
    return NextResponse.json({ packages: packages.map(redactPackage) });
  }

  const overview = await getAccountOverview(userId);
  return NextResponse.json({ packages: overview.packages.map(redactPackage) });
}

const BodySchema = z.object({
  qrHash: z.string().min(1).max(64),
  contentHash: z.string().min(1).max(256),
  weight: z.number().nonnegative(),
  size: z.string().min(1).max(16),
  receiverId: z.number().int(),
  amount: z.number().nonnegative(),
  currency: z.string().min(1).max(8),
  deliveryCode: z.string().min(4).max(128),
  chain: ChainMetaSchema.optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

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

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid shipment" }, { status: 400 });
  }

  try {
    const { pkg, txn } = await bookShipment(userId, parsed.data);
    return NextResponse.json({ package: pkg, transaction: txn }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "booking failed" },
      { status: 400 },
    );
  }
}
