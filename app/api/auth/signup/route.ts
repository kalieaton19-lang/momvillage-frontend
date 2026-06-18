import { NextResponse } from "next/server";
import { addUser, findUser } from "../../../../lib/users";
import bcrypt from "bcrypt";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return new NextResponse(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    const existing = findUser(email);
    if (existing) {
      return new NextResponse(JSON.stringify({ error: "User already exists" }), { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const created = addUser(email, hash);
    if (!created) {
      return new NextResponse(JSON.stringify({ error: "Could not create user" }), { status: 500 });
    }

    return new NextResponse(JSON.stringify({ message: "User created (demo)", user: { email } }), { status: 201, headers: { "content-type": "application/json" } });
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
}
