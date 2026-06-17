const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function toCanonicalName(meta = {}, email = "") {
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName;

  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  if (name) return name;

  const local = typeof email === "string" && email.includes("@")
    ? email.split("@")[0].trim()
    : "";
  if (!local) return null;

  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/[0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  return cleaned
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
    .trim() || null;
}

async function main() {
  let page = 1;
  const perPage = 100;
  let processed = 0;
  let updated = 0;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    if (users.length === 0) break;

    for (const user of users) {
      processed += 1;
      const meta = user.user_metadata || {};
      const canonicalName = toCanonicalName(meta, user.email || "");

      if (!canonicalName) {
        console.log(`[skip] ${user.id} has no usable name`);
        continue;
      }

      const payload = {
        id: user.id,
        email: user.email || null,
        full_name: canonicalName,
        name: canonicalName,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from("user_public_profiles")
        .upsert(payload, { onConflict: "id" });

      if (upsertError) {
        console.error(`[error] ${user.id}: ${upsertError.message}`);
        continue;
      }

      updated += 1;
      console.log(`[ok] ${user.id} => ${canonicalName}`);
    }

    page += 1;
  }

  console.log(`Backfill complete. Processed: ${processed}, Updated: ${updated}`);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
