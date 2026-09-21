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
    const packageObj = await db.collection("packages").findOne({
      _id: new ObjectId(id),
    });
    if (!packageObj) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    return NextResponse.json(packageObj);
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
    await db.collection("packages").updateOne(
      { _id: new ObjectId(id) },
      { $set: body }
    );
    const updatedPackage = await db.collection("packages").findOne({
      _id: new ObjectId(id),
    });
    if (!updatedPackage) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    return NextResponse.json(updatedPackage);
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
    const result = await db.collection("packages").deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
  }
}
