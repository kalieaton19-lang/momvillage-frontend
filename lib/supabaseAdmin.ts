import { createClient } from '@supabase/supabase-js';

let cachedAdmin: any | null = null;

export function getSupabaseAdmin() {
  if (cachedAdmin) return cachedAdmin;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !serviceRoleKey) {
    // Provide a minimal stub to avoid build-time crashes when envs are missing.
    // At runtime, calls will surface a clear error.
    cachedAdmin = {
      auth: {
        admin: {
          listUsers: async () => ({ data: null, error: new Error('SUPABASE_SERVICE_ROLE_KEY not set') }),
          createUser: async () => ({ data: null, error: new Error('SUPABASE_SERVICE_ROLE_KEY not set') }),
        },
        getUser: async () => ({ data: null, error: new Error('SUPABASE_SERVICE_ROLE_KEY not set') }),
        signInWithPassword: async () => ({ data: null, error: new Error('SUPABASE_SERVICE_ROLE_KEY not set') }),
      },
    } as const;
    return cachedAdmin;
  }

  cachedAdmin = createClient(url, serviceRoleKey);
  return cachedAdmin;
}

export const supabaseAdmin = getSupabaseAdmin();

/**
 * Verify an access token and return user data (or null).
 */
export async function getUserByAccessToken(accessToken: string | null) {
  if (!accessToken) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await (admin as any).auth.getUser(accessToken as string);
    if (error) return null;
    return data?.user || null;
  } catch (err) {
    return null;
  }
}
