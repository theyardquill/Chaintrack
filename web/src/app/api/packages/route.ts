import { NextResponse } from "next/server";
import type { Package } from "@/lib/types";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();
    const packages = await db.collection("packages").find({}).toArray();
    return NextResponse.json(packages);
  } catch {
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      qrHash,
      contentHash,
      weight,
      size,
      senderId,
      receiverId,
      activeAgentId,
      status,
      createdAt,
      deliveredAt,
      deliveryCode,
    } = body as Omit<Package, "id">;
    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection("packages").insertOne({
      qrHash,
      contentHash,
      weight,
      size,
      senderId,
      receiverId,
      activeAgentId: activeAgentId ?? null,
      status,
      createdAt: createdAt ?? Date.now(),
      deliveredAt: deliveredAt ?? null,
      deliveryCode,
    });
    const newPackage = { ...body, id: result.insertedId as unknown as number };
    return NextResponse.json(newPackage, { status: 201 });
  } catch {
  }
}
