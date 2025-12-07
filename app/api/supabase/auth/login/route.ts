import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return new NextResponse(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }

    // Sign in via Supabase using the service role key on the server
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) {
      return new NextResponse(JSON.stringify({ error: error.message }), { status: 401 });
    }

    const accessToken = data?.session?.access_token || null;
    const refreshToken = data?.session?.refresh_token || null;

    const res = NextResponse.json({ user: data?.user || null });
    if (accessToken) {
      // Set HttpOnly cookie for access token (short-lived)
      res.cookies.set('sb_access_token', accessToken, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60, // 1 hour
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
    if (refreshToken) {
      // Refresh token long-lived
      res.cookies.set('sb_refresh_token', refreshToken, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    return res;
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: 'Bad request' }), { status: 400 });
  }
}
