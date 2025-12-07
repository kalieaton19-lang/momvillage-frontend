import { NextResponse } from 'next/server';
import { getUserByAccessToken } from '../../../../../lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenPair = cookieHeader.split('; ').find((c) => c.startsWith('sb_access_token='));
    const token = tokenPair ? tokenPair.split('=')[1] : null;
    const user = await getUserByAccessToken(token);
    if (!user) {
      return new NextResponse(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
    }
    return NextResponse.json({ user: { email: user.email } });
  } catch (err) {
    return new NextResponse(JSON.stringify({ error: 'Bad request' }), { status: 400 });
  }
}
