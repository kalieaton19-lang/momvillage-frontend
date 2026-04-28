// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs



import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Public function: no JWT/Authorization required

  try {
    const parsedBody = await req.json();
    // TEMP: Return the parsed body for debugging
    return new Response(JSON.stringify({ debug: parsedBody }), { status: 200, headers: { "Content-Type": "application/json" } });
    // const { match_uuid, match_id, sender_id, receiver_id, message_text, created_at, metadata } = parsedBody;

    // Basic validation
    if (!match_uuid || !sender_id || !message_text) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields",
          details: {
            match_uuid,
            sender_id,
            message_text,
            request_body: { match_uuid, match_id, sender_id, receiver_id, message_text, created_at, metadata }
          }
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert into public.messages
    const { data, error } = await Deno.supabase.from("messages").insert([
      try {
        const parsedBody = await req.json();
        const { match_uuid, match_id, sender_id, receiver_id, message_text, created_at, metadata } = parsedBody;

        // Basic validation
        if (!match_uuid || !sender_id || !message_text) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields",
              details: { match_uuid, sender_id, message_text }
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
              match_uuid,
              match_id: match_id ?? null,
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
        message_text,
        created_at: created_at ?? new Date().toISOString(),
        metadata: metadata ?? {},
      },
    ]).select().single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send_message' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
