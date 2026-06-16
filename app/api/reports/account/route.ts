import { supabase } from "../../../../lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { accountUserId, reason, details } = await request.json();

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
    if (accountUserId === user.id) {
      return NextResponse.json(
        { error: "Cannot report your own account" },
        { status: 400 }
      );
    }

    // Create report (using a generic reports table for accounts)
    // For now, we'll use a simple approach storing in a generic reports table
    // You may want to create a dedicated account_reports table
    const { data, error } = await supabase
      .from("account_reports")
      .insert({
        reported_user_id: accountUserId,
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
