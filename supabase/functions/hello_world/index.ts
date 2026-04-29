// supabase/functions/hello_world/index.ts
Deno.serve((_req) => {
  console.log("=== HELLO WORLD FUNCTION LOG ===");
  return new Response(JSON.stringify({ message: "Hello, world!" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
