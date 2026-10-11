import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { hasMongoConfig } from "@/lib/db/mongo";
import { setAccountRole } from "@/lib/db/repo";
import { RoleSchema } from "@/lib/db/schemas";

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

  const body = (await request.json().catch(() => null)) as { role?: string } | null;
  const parsed = RoleSchema.safeParse(body?.role);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }

  const user = await setAccountRole(userId, parsed.data);
  return NextResponse.json({ ok: true, user });
}
