import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return new NextResponse(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }

    // Create user via Supabase Admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      return new NextResponse(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return NextResponse.json({ user: data.user });
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: 'Bad request' }), { status: 400 });
  }
}
