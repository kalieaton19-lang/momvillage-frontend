import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || url.includes('your-project-ref')) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not configured in .env.local');
}
if (!anonKey || anonKey.includes('your-anon-public-key')) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured in .env.local');
}

export const supabase = createClient(url, anonKey);
