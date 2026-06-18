import { NextResponse } from "next/server";
import { getUserByAccessToken, supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cookieHeader = request.headers.get("cookie") || "";
    const cookieTokenPair = cookieHeader
      .split("; ")
      .find((cookie) => cookie.startsWith("sb_access_token="));
    const cookieToken = cookieTokenPair ? decodeURIComponent(cookieTokenPair.split("=")[1] || "") : null;
    const token = bearerToken || cookieToken;
    const user = await getUserByAccessToken(token);

    if (!user?.id) {
      return new NextResponse(JSON.stringify({ error: "Not authenticated" }), { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";

    if (!conversationId) {
      return new NextResponse(JSON.stringify({ error: "Missing conversationId" }), { status: 400 });
    }

    const { data: conversationMessages, error: fetchMessagesError } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("receiver_id", user.id)
      .order("created_at", { ascending: true });

    if (fetchMessagesError) {
      return new NextResponse(JSON.stringify({ error: fetchMessagesError.message }), { status: 500 });
    }

    const nowIso = new Date().toISOString();
    let updatedCount = 0;

    for (const row of conversationMessages || []) {
      const metadata = (row as any)?.metadata && typeof (row as any).metadata === "object" ? (row as any).metadata : {};
      const metadataReadAt = metadata?.read_by_receiver_at || metadata?.read_at || null;
      const columnReadAt = (row as any)?.read_at ?? null;
      if (metadataReadAt || columnReadAt) continue;

      const updatePayload: Record<string, any> = {
        metadata: {
          ...metadata,
          read_by_receiver_at: nowIso,
        },
      };

      if (Object.prototype.hasOwnProperty.call(row, "read_at")) {
        updatePayload.read_at = nowIso;
      }

      const { error: updateError } = await supabaseAdmin
        .from("messages")
        .update(updatePayload)
        .eq("id", (row as any).id);

      if (updateError) {
        return new NextResponse(JSON.stringify({ error: updateError.message }), { status: 500 });
      }

      updatedCount += 1;
    }

    const { error: clearNotificationsError } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("type", "message_received")
      .eq("read", false)
      .filter("data->>conversation_id", "eq", conversationId);

    if (clearNotificationsError) {
      return new NextResponse(JSON.stringify({ error: clearNotificationsError.message }), { status: 500 });
    }

    return NextResponse.json({ updatedCount });
  } catch {
    return new NextResponse(JSON.stringify({ error: "Bad request" }), { status: 400 });
  }
}