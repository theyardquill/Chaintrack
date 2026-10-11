import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { hasMongoConfig } from "@/lib/db/mongo";
import { logCheckpoint } from "@/lib/db/repo";
import { ChainMetaSchema, PackageStatusSchema } from "@/lib/db/schemas";

export const runtime = "nodejs";

const BodySchema = z.object({
  location: z.string().min(1).max(120),
  status: PackageStatusSchema,
  chain: ChainMetaSchema.optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ code: string }> }) {
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

  const { code } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid checkpoint" }, { status: 400 });
  }

  try {
    const checkpoint = await logCheckpoint(userId, decodeURIComponent(code), parsed.data);
    return NextResponse.json({ checkpoint }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "checkpoint failed" },
      { status: 400 },
    );
  }
}
