import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function GET() {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return new NextResponse(JSON.stringify({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not set' }), { status: 400 });
    }

    // harmless admin call: list a single user page to verify admin access
    const { data, error } = await (supabaseAdmin as any).auth.admin.listUsers({ per_page: 1 });
    if (error) {
      return new NextResponse(JSON.stringify({ ok: false, error: error.message || error }), { status: 502 });
    }

    const userCount = Array.isArray(data?.users) ? data.users.length : 0;
    return NextResponse.json({ ok: true, message: 'Supabase admin reachable', userCount });
  } catch (err: any) {
    return new NextResponse(JSON.stringify({ ok: false, error: err?.message || String(err) }), { status: 500 });
  }
}
