const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  let page = 1;
  const perPage = 100;
  let totalSynced = 0;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    if (users.length === 0) break;

    for (const u of users) {
      const meta = u.user_metadata || {};
      const upsertData = {
        id: u.id,
        email: u.email,
        full_name: meta.full_name || null,
        name: meta.name || null,
        profile_photo_url: meta.profile_photo_url || null,
        city: meta.city || null,
        state: meta.state || null,
        kids_age_groups: Array.isArray(meta.kids_age_groups) ? meta.kids_age_groups.join(',') : (meta.kids_age_groups || null),
        number_of_kids: meta.number_of_kids ? String(meta.number_of_kids) : null,
        is_public: meta.is_public !== undefined ? meta.is_public : true,
        verified_status: meta.verified_status || 'unverified',
        updated_at: new Date().toISOString(),
      };

      // Remove undefined keys
      Object.keys(upsertData).forEach((k) => upsertData[k] === undefined && delete upsertData[k]);

      console.log('Upserting for user:', u.id, upsertData);
      const { error: upsertError } = await supabase
        .from('user_public_profiles')
        .upsert(upsertData, { onConflict: 'id' });
      if (upsertError) {
        console.error(`Failed to upsert for user ${u.id}:`, upsertError.message);
      } else {
        console.log(`Upserted user ${u.id}`);
        totalSynced++;
      }
    }
    page++;
  }
  console.log(`Sync complete. Total users upserted: ${totalSynced}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
