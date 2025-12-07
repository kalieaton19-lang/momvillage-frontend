import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return new NextResponse(JSON.stringify({ error: "Email required" }), { status: 400 });
    }

    // demo-only: pretend we emailed a reset link
    return new NextResponse(
      JSON.stringify({ message: "Password reset email sent (demo)" }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
}
