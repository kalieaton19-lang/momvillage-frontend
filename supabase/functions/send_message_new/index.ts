// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs

import { createClient } from "npm:@supabase/supabase-js@2";

// TEST LOG: Confirm fresh deployment (send_message_new)
console.log("=== TEST LOG: send_message_new function fresh deploy ===");
Deno.serve(async (req) => {
  // Log presence of critical env vars at the very top
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrlPresent = !!supabaseUrl;
  const supabaseServiceRoleKeyPresent = !!supabaseServiceRoleKey;
  // Mask all but last 6 chars for security
  const mask = (val: string | undefined) => val ? val.slice(0, 6) + '...' + val.slice(-6) : 'undefined';
  console.log("[send_message_new] SUPABASE_URL present:", supabaseUrlPresent, ", value:", mask(supabaseUrl));
  console.log("[send_message_new] SUPABASE_SERVICE_ROLE_KEY present:", supabaseServiceRoleKeyPresent, ", value:", mask(supabaseServiceRoleKey));

  try {


    const parsedBody = await req.json();


    // Helper to normalize UUIDs: convert empty string, null, or undefined to null, else trim string
    const normalizeUuid = (v: unknown) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "string") {
        const s = v.trim();
        return s === "" ? null : s;
      }
      return v;
    };

    const match_uuid_n = normalizeUuid(parsedBody.match_uuid);
    const conversation_id = normalizeUuid(parsedBody.id);
    const sender_id_n = normalizeUuid(parsedBody.sender_id);
    const receiver_id_n = normalizeUuid(parsedBody.receiver_id);
    const message_text_n = parsedBody.message_text;
    const created_at_n = parsedBody.created_at;
    const metadata_n = parsedBody.metadata;

    // Debug: log what is being sent (normalized)
    console.log({ match_uuid: match_uuid_n, conversation_id, sender_id: sender_id_n, receiver_id: receiver_id_n });

    // Basic validation
    if (!conversation_id || !sender_id_n || !message_text_n) {
      return new Response(
        JSON.stringify({
          error: "Missing required UUIDs",
          details: {
            conversation_id,
            sender_id: sender_id_n,
            message_text: message_text_n,
            request_body: { conversation_id, sender_id: sender_id_n, receiver_id: receiver_id_n, message_text: message_text_n, created_at: created_at_n, metadata: metadata_n }
          }
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          conversation_id,
          sender_id: sender_id_n,
          receiver_id: receiver_id_n, // will be null if empty string
          message_text: message_text_n,
          created_at: created_at_n ?? new Date().toISOString(),
          metadata: metadata_n ?? {},
        },
      ])
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
