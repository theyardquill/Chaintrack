import { NextResponse } from "next/server";
import { hasMongoConfig } from "@/lib/db/mongo";
import { getPackageByCode, redactPackage } from "@/lib/db/repo";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!hasMongoConfig()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const { code } = await ctx.params;
  const detail = await getPackageByCode(decodeURIComponent(code));
  if (!detail) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    package: redactPackage(detail.pkg),
    transaction: detail.txn,
    checkpoints: detail.checkpoints,
    people: detail.people,
  });
}
