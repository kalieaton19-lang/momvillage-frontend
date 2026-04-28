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

    const { match_uuid, id, sender_id, receiver_id, message_text, created_at, metadata } = parsedBody;
    // Debug: log what is being sent
    console.log({ match_uuid, id, sender_id, receiver_id });
    // treat `id` as conversation uuid
    const conversation_id = id;

    // Basic validation
    if (!conversation_id || !sender_id || !message_text) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          details: {
            conversation_id,
            sender_id,
            message_text,
            request_body: { conversation_id, sender_id, receiver_id, message_text, created_at, metadata }
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
          sender_id,
          receiver_id: receiver_id ?? null,
          message_text,
          created_at: created_at ?? new Date().toISOString(),
          metadata: metadata ?? {},
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
