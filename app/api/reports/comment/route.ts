import { supabase } from "../../../../lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { commentId, reason, details } = await request.json();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Prevent self-reporting
    const { data: comment } = await supabase
      .from("post_comments")
      .select("author_user_id")
      .eq("id", commentId)
      .single();

    if (comment?.author_user_id === user.id) {
      return NextResponse.json(
        { error: "Cannot report your own comment" },
        { status: 400 }
      );
    }

    // Create report
    const { data, error } = await supabase
      .from("comment_reports")
      .insert({
        post_comment_id: commentId,
        reporter_id: user.id,
        reason,
        details,
      })
      .select();

    if (error) {
      console.error("Report error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to submit report" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Report error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
