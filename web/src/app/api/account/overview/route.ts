import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { hasMongoConfig } from "@/lib/db/mongo";
import { applyProfile, getAccountOverview } from "@/lib/db/repo";

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

  const overview = await getAccountOverview(userId);

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
      await applyProfile(userId, { name, email, phone });
      if (name) overview.user.name = name;
      if (email) overview.user.email = email;
      if (phone) overview.user.phone = phone;
    }
  } catch {
    // profile sync is best-effort
  }

  return NextResponse.json(overview);
}
