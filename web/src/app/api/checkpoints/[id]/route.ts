import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db();
    const checkpoint = await db.collection("checkpoints").findOne({
      _id: new ObjectId(id),
    });
    if (!checkpoint) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }
    return NextResponse.json(checkpoint);
  } catch {
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db();
    await db.collection("checkpoints").updateOne(
      { _id: new ObjectId(id) },
      { $set: body }
    );
    const updatedCheckpoint = await db.collection("checkpoints").findOne({
      _id: new ObjectId(id),
    });
    if (!updatedCheckpoint) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }
    return NextResponse.json(updatedCheckpoint);
  } catch {
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection("checkpoints").deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Checkpoint not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
  }
}
