import { NextResponse } from "next/server";
import type { Checkpoint } from "@/lib/types";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();
    const checkpoints = await db.collection("checkpoints").find({}).toArray();
    return NextResponse.json(checkpoints);
  } catch {
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      packageId,
      agentId,
      location,
      timestamp,
      status,
    } = body as Omit<Checkpoint, "id">;
    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection("checkpoints").insertOne({
      packageId,
      agentId,
      location,
      timestamp: timestamp ?? Date.now(),
      status,
    });
    const newCheckpoint = { ...body, id: result.insertedId as unknown as number };
    return NextResponse.json(newCheckpoint, { status: 201 });
  } catch {
  }
}
