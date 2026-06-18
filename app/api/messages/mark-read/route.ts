import { NextResponse } from "next/server";
import { getUserByAccessToken, supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const user = await getUserByAccessToken(token);

    if (!user?.id) {
      return new NextResponse(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";

    if (!conversationId) {
      return new NextResponse(JSON.stringify({ error: "Missing conversationId" }), { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("receiver_id", user.id)
      .is("read_at", null)
      .select("id");

    if (error) {
      return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return NextResponse.json({ updatedCount: data?.length || 0 });
  } catch {
    return new NextResponse(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
}