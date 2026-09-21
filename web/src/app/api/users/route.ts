import { NextResponse } from "next/server";
import type { User } from "@/lib/types";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();
    const users = await db.collection("users").find({}).toArray();
    return NextResponse.json(users);
  } catch {
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, role } = body as Omit<User, "id">;
    const client = await clientPromise;
    const db = client.db();
    const result = await db.collection("users").insertOne({
      name,
      phone,
      role,
    });
    const newUser = { ...body, id: result.insertedId as unknown as number };
    return NextResponse.json(newUser, { status: 201 });
  } catch {
  }
}
