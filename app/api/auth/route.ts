import { NextResponse } from "next/server";
import { findUser } from "../../../lib/users";
import bcrypt from "bcrypt";
import { signToken } from "../../../lib/jwt";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return new NextResponse(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    const user = findUser(email);
    if (!user) {
      return new NextResponse(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    const match = await bcrypt.compare(password, (user as any).passwordHash);
    if (!match) {
      return new NextResponse(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    // issue a signed JWT and set it in a HttpOnly cookie
    const token = signToken({ email });
    const res = NextResponse.json({ user: { email } });
    res.cookies.set("mv_token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
}
