import { NextResponse } from "next/server";

// Update this to your deployed Supabase Edge Function URL
const EDGE_FUNCTION_URL = process.env.SUPABASE_EDGE_FUNCTION_URL || "https://YOUR_PROJECT.functions.supabase.co/send_message";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const body = await req.json();
    // Debug log incoming request and body type
    console.log("Proxy received:", { authHeader, body, bodyType: typeof body, isArray: Array.isArray(body) });
    console.log("Calling:", EDGE_FUNCTION_URL);
    if (!authHeader) {
      return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
    }
    const edgeRes = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(body),
    });
    const text = await edgeRes.text();
    // Always return the raw text as plain text for debugging
    return new Response(text, {
      status: edgeRes.status,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err: any) {
    console.error("Proxy error:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}
