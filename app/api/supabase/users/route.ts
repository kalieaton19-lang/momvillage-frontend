import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabaseAdmin";

type SafeUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any> | null;
};

export async function GET() {
  try {
    const admin = getSupabaseAdmin() as any;
    if (!admin?.auth?.admin?.listUsers) {
      return NextResponse.json({ users: [] as SafeUser[], error: "Supabase admin unavailable" }, { status: 200 });
    }

    const users: SafeUser[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        return NextResponse.json({ users: [] as SafeUser[], error: error.message }, { status: 200 });
      }
      const batch = (data?.users || []).map((u: any) => ({
        id: u.id,
        email: u.email ?? null,
        user_metadata: u.user_metadata ?? null,
      }));
      users.push(...batch);
      if (!data || !data.users || data.users.length < perPage) break;
      page += 1;
      if (page > 10) break; // safety cap
    }

    return NextResponse.json({ users }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ users: [] as SafeUser[], error: err?.message || "unknown" }, { status: 200 });
  }
}
