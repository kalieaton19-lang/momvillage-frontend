import { NextResponse } from "next/server";
import { verifyToken } from "../../../../lib/jwt";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const tokenPair = cookieHeader.split("; ").find((c) => c.startsWith("mv_token="));
    const token = tokenPair ? tokenPair.split("=")[1] : null;
    const payload = verifyToken(token);
    if (!payload) {
      return new NextResponse(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }
    return NextResponse.json({ user: { email: payload.email } });
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
}
