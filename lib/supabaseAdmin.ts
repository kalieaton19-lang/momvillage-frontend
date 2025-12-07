import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(url, serviceRoleKey);

/**
 * Verify an access token and return user data (or null).
 */
export async function getUserByAccessToken(accessToken: string | null) {
  if (!accessToken) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken as string);
    if (error) return null;
    return data?.user || null;
  } catch (err) {
    return null;
  }
}
