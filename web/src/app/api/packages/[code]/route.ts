import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCollections } from "@/lib/db/collections";
import { hasMongoConfig } from "@/lib/db/mongo";
import { getPackageByCode, redactPackage, type PackageDetail } from "@/lib/db/repo";

export const runtime = "nodejs";

// Contact phone numbers are personal data: this lookup is public (anyone with
// the tracking code can read it), so phones are only returned to a signed-in
// party to the shipment (sender, receiver, assigned agent) or an agent account.
async function viewerCanSeeContacts(detail: PackageDetail): Promise<boolean> {
  if (!process.env.CLERK_SECRET_KEY) return false;
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const { users } = await getCollections();
    const viewer = await users.findOne({ _id: userId });
    if (!viewer) return false;
    if (viewer.role === "AGENT") return true;
    const id = viewer.appUserId ?? null;
    if (id == null) return false;
    return (
      id === detail.pkg.senderId ||
      id === detail.pkg.receiverId ||
      id === detail.pkg.activeAgentId
    );
  } catch {
    return false;
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!hasMongoConfig()) {
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }

  const { code } = await ctx.params;
  const detail = await getPackageByCode(decodeURIComponent(code));
  if (!detail) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const canSeeContacts = await viewerCanSeeContacts(detail);
  const people = canSeeContacts
    ? detail.people
    : detail.people.map((p) => ({ ...p, phone: "" }));

  return NextResponse.json({
    package: redactPackage(detail.pkg),
    transaction: detail.txn,
    checkpoints: detail.checkpoints,
    people,
  });
}
