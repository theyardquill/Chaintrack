import { NextResponse } from "next/server";
import type { Transaction } from "@/lib/types";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();
    const transactions = await db.collection("transactions").find({}).toArray();
    return NextResponse.json(transactions);
  } catch {
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      packageId,
      senderId,
      receiverId,
      amount,
      currency,
      status,
      createdAt,
      settledAt,
    } = body as Omit<Transaction, "id">;
    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection("transactions").insertOne({
      packageId,
      senderId,
      receiverId,
      amount,
      currency,
      status,
      createdAt: createdAt ?? Date.now(),
      settledAt: settledAt ?? null,
    });
    const newTxn = { ...body, id: result.insertedId as unknown as number };
    return NextResponse.json(newTxn, { status: 201 });
  } catch {
  }
}
