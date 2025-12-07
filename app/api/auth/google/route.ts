import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse(
    JSON.stringify({ message: "OAuth stub: redirect to provider (not implemented)" }),
    { status: 501, headers: { "content-type": "application/json" } }
  );
}
