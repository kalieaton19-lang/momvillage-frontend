import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await (admin as any)
      .from("user_public_profiles")
      .select(
        "id,full_name,name,city,state,zip_code,number_of_kids,kids_age_groups,preferred_language,parenting_style,profile_photo_url,services_offered,services_needed",
      );

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to load users" }, { status: 500 });
    }

    return NextResponse.json({ users: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load users" }, { status: 500 });
  }
}
