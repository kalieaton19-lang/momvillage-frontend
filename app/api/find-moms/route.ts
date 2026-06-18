import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_public_profiles")
      .select(
        "id,full_name,name,city,state,number_of_kids,kids_age_groups,parenting_style,profile_photo_url,services_offered,services_needed",
      );

    if (error) {
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from("user_public_profiles")
        .select(
          "id,full_name,name,city,state,number_of_kids,kids_age_groups,parenting_style,profile_photo_url",
        );

      if (!fallbackError) {
        return NextResponse.json({ users: fallbackData || [] }, { headers: { "Cache-Control": "no-store" } });
      }

      return NextResponse.json(
        {
          error: fallbackError.message || error.message || "Failed to load users",
          code: fallbackError.code || error.code || null,
        },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json({ users: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load users";
    return NextResponse.json({ error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
