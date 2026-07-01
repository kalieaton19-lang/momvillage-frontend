import { NextResponse } from "next/server";
import { getUserByAccessToken, supabaseAdmin } from "../../../../lib/supabaseAdmin";

function isMissingColumnError(error: any, columnName: string) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42703" || message.includes(columnName.toLowerCase()) || message.includes("column");
}

async function ensureConversationForUsers(currentUserId: string, offererUserId: string) {
  let existingConversations: any[] | null = null;
  let queryError: any = null;

  const primary = await supabaseAdmin
    .from("conversations")
    .select("id")
    .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${offererUserId}),and(user1_id.eq.${offererUserId},user2_id.eq.${currentUserId})`)
    .order("updated_at", { ascending: false })
    .order("last_message_time", { ascending: false })
    .limit(1);

  existingConversations = primary.data;
  queryError = primary.error;

  if (queryError && isMissingColumnError(queryError, "last_message_time")) {
    const fallback = await supabaseAdmin
      .from("conversations")
      .select("id")
      .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${offererUserId}),and(user1_id.eq.${offererUserId},user2_id.eq.${currentUserId})`)
      .order("updated_at", { ascending: false })
      .limit(1);

    existingConversations = fallback.data;
    queryError = fallback.error;
  }

  if (queryError) throw queryError;
  if (existingConversations && existingConversations.length > 0) {
    return String(existingConversations[0].id);
  }

  const profileIds = [currentUserId, offererUserId];
  const { data: profiles } = await supabaseAdmin
    .from("user_public_profiles")
    .select("id, full_name, profile_photo_url")
    .in("id", profileIds);

  const profileById = Object.fromEntries((profiles || []).map((profile: any) => [profile.id, profile]));

  const { data: created, error: createError } = await supabaseAdmin
    .from("conversations")
    .insert({
      user1_id: currentUserId,
      user2_id: offererUserId,
      user1_name: profileById[currentUserId]?.full_name || "Mom",
      user2_name: profileById[offererUserId]?.full_name || "Mom",
      user1_photo: profileById[currentUserId]?.profile_photo_url || "",
      user2_photo: profileById[offererUserId]?.profile_photo_url || "",
    })
    .select("id")
    .single();

  if (createError || !created?.id) {
    throw createError || new Error("Could not create conversation");
  }

  return String(created.id);
}

async function updateConversationActivity(conversationId: string, messageText: string, createdAtIso: string) {
  const updateWithTime = await supabaseAdmin
    .from("conversations")
    .update({
      last_message: messageText,
      last_message_time: createdAtIso,
      updated_at: createdAtIso,
    })
    .eq("id", conversationId);

  if (!updateWithTime.error) return;

  if (!isMissingColumnError(updateWithTime.error, "last_message_time") && !isMissingColumnError(updateWithTime.error, "last_message")) {
    throw updateWithTime.error;
  }

  const updateWithMessageOnly = await supabaseAdmin
    .from("conversations")
    .update({
      last_message: messageText,
      updated_at: createdAtIso,
    })
    .eq("id", conversationId);

  if (!updateWithMessageOnly.error) return;

  if (!isMissingColumnError(updateWithMessageOnly.error, "last_message")) {
    throw updateWithMessageOnly.error;
  }

  const updateTimestampOnly = await supabaseAdmin
    .from("conversations")
    .update({ updated_at: createdAtIso })
    .eq("id", conversationId);

  if (updateTimestampOnly.error) {
    throw updateTimestampOnly.error;
  }
}

async function insertMessageCompat(params: {
  conversationId: string;
  senderId: string;
  receiverId: string;
  messageText: string;
  createdAt: string;
}) {
  const basePayload = {
    conversation_id: params.conversationId,
    sender_id: params.senderId,
    receiver_id: params.receiverId,
    message_text: params.messageText,
    created_at: params.createdAt,
  };

  const attempts = [
    { ...basePayload, match_id: params.conversationId, match_uuid: params.conversationId },
    { ...basePayload, match_id: params.conversationId },
    { ...basePayload, match_uuid: params.conversationId },
    basePayload,
  ];

  let lastError: any = null;

  for (const payload of attempts) {
    const { error } = await supabaseAdmin.from("messages").insert(payload as any);
    if (!error) return;

    lastError = error;
    const isShapeIssue =
      error?.code === "42703" ||
      String(error?.message || "").toLowerCase().includes("column") ||
      String(error?.message || "").toLowerCase().includes("schema cache");

    if (!isShapeIssue) {
      throw error;
    }
  }

  throw lastError || new Error("Unable to insert support offer message");
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cookieHeader = request.headers.get("cookie") || "";
    const cookieTokenPair = cookieHeader
      .split("; ")
      .find((cookie) => cookie.startsWith("sb_access_token="));
    const cookieToken = cookieTokenPair ? decodeURIComponent(cookieTokenPair.split("=")[1] || "") : null;

    const user = await getUserByAccessToken(bearerToken || cookieToken);
    if (!user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const offerId = String(body?.offerId || "").trim();
    const postIdFromBody = String(body?.postId || "").trim();
    const conversationIdFromBody = String(body?.conversationId || "").trim();

    let offer: any = null;

    if (offerId) {
      const { data: offerById, error: offerByIdError } = await supabaseAdmin
        .from("post_support_offers")
        .select("id, post_id, offered_by_user_id, created_at, posts!inner(id,title,author_user_id)")
        .eq("id", offerId)
        .single();

      if (offerByIdError || !offerById) {
        return NextResponse.json({ error: "Support offer not found" }, { status: 404 });
      }

      offer = offerById;
    } else {
      if (!postIdFromBody || !conversationIdFromBody) {
        return NextResponse.json({ error: "Missing offerId or (postId + conversationId)" }, { status: 400 });
      }

      const { data: conversation, error: conversationError } = await supabaseAdmin
        .from("conversations")
        .select("id,user1_id,user2_id")
        .eq("id", conversationIdFromBody)
        .single();

      if (conversationError || !conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      const participantA = String((conversation as any).user1_id || "");
      const participantB = String((conversation as any).user2_id || "");

      if (user.id !== participantA && user.id !== participantB) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }

      const { data: offersForPost, error: offersForPostError } = await supabaseAdmin
        .from("post_support_offers")
        .select("id, post_id, offered_by_user_id, created_at, posts!inner(id,title,author_user_id)")
        .eq("post_id", postIdFromBody)
        .in("offered_by_user_id", [participantA, participantB])
        .order("created_at", { ascending: false });

      if (offersForPostError) {
        return NextResponse.json({ error: offersForPostError.message || "Could not query support offer" }, { status: 500 });
      }

      offer = (offersForPost || []).find((row: any) => {
        const postAuthorId = String(row?.posts?.author_user_id || "");
        const offeredById = String(row?.offered_by_user_id || "");
        return (
          (postAuthorId === participantA || postAuthorId === participantB) &&
          (offeredById === participantA || offeredById === participantB) &&
          postAuthorId !== offeredById
        );
      });

      if (!offer) {
        return NextResponse.json({ error: "Support offer not found for this conversation" }, { status: 404 });
      }
    }

    const postAuthorUserId = String((offer as any)?.posts?.author_user_id || "");
    const offeredByUserId = String((offer as any)?.offered_by_user_id || "");
    const postId = String((offer as any)?.post_id || "");

    if (!postAuthorUserId || !offeredByUserId || !postId) {
      return NextResponse.json({ error: "Offer data is incomplete" }, { status: 400 });
    }

    const isAllowedUser = user.id === postAuthorUserId || user.id === offeredByUserId;
    if (!isAllowedUser) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const conversationId = conversationIdFromBody || (await ensureConversationForUsers(postAuthorUserId, offeredByUserId));

    const { data: existingMessages } = await supabaseAdmin
      .from("messages")
      .select("id,message_text")
      .eq("conversation_id", conversationId)
      .eq("sender_id", offeredByUserId)
      .order("created_at", { ascending: false })
      .limit(80);

    const encodedPostToken = `post=${encodeURIComponent(postId)}`;
    const rawPostToken = `post=${postId}`;
    const alreadyExists = (existingMessages || []).some((row: any) => {
      const text = String(row?.message_text || "");
      return (
        text.includes(encodedPostToken) ||
        text.includes(rawPostToken) ||
        text.toLowerCase().includes("offered support with this")
      );
    });

    if (!alreadyExists) {
      const requestOrigin = new URL(request.url).origin;
      const postUrl = `${requestOrigin}/home?post=${encodeURIComponent(postId)}`;
      const supportMessageText = `I offered support with this! Message here to coordinate support: ${postUrl}`;
      const createdAtIso = new Date().toISOString();

      await insertMessageCompat({
        conversationId,
        senderId: offeredByUserId,
        receiverId: postAuthorUserId,
        messageText: supportMessageText,
        createdAt: createdAtIso,
      });

      await updateConversationActivity(conversationId, supportMessageText, createdAtIso);

      return NextResponse.json({ conversationId, inserted: true });
    }

    return NextResponse.json({ conversationId, inserted: false });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to backfill support message" }, { status: 500 });
  }
}
