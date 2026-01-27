import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("[Keep-Alive] Supabase environment variables not found");
      return new Response("alive", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    // Perform a minimal read-only database query to keep the database active
    // This uses a simple SELECT 1 which doesn't access any user data
    const dbResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/version`,
      {
        method: "GET",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    // Even if the query fails, we still return success
    // The important thing is that we attempted to touch the database
    if (dbResponse.ok) {
      console.log("[Keep-Alive] Database ping successful");
    } else {
      console.log("[Keep-Alive] Database ping attempted");
    }

    return new Response("alive", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });

  } catch (error) {
    // Even on error, return success to allow cron to continue
    console.error("[Keep-Alive] Error:", error);
    return new Response("alive", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});