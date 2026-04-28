import { NextResponse } from "next/server";

// Update this to your deployed Supabase Edge Function URL
const EDGE_FUNCTION_URL = process.env.SUPABASE_EDGE_FUNCTION_URL || "https://tsnnpeddaydwrfhwjicu.functions.supabase.co/send_message_new";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    // TEMP: Log the Authorization header for debugging
    console.log("[proxy-send-message] Authorization header:", authHeader);
    const body = await req.json();
    // Log the incoming body
    console.log("[proxy-send-message] Incoming body:", body);
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
    const contentType = edgeRes.headers.get("content-type") || "";
    const text = await edgeRes.text();
    // Try to parse as JSON if possible
    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text);
        return NextResponse.json(json, { status: edgeRes.status });
      } catch (e) {
        // Fall through to plain text
      }
    }
    // Fallback: return as plain text
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
