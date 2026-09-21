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
    const txn = await db.collection("transactions").findOne({
      _id: new ObjectId(id),
    });
    if (!txn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json(txn);
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
    await db.collection("transactions").updateOne(
      { _id: new ObjectId(id) },
      { $set: body }
    );
    const updatedTxn = await db.collection("transactions").findOne({
      _id: new ObjectId(id),
    });
    if (!updatedTxn) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json(updatedTxn);
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
    const result = await db.collection("transactions").deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
  }
}
