import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Keep-Alive-Token",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const KEEP_ALIVE_SECRET = Deno.env.get("KEEP_ALIVE_SECRET");
    
    if (!KEEP_ALIVE_SECRET) {
      console.error("[Keep-Alive] KEEP_ALIVE_SECRET environment variable not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Server configuration error" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("X-Keep-Alive-Token");
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get("token");
    const providedToken = authHeader || tokenParam;

    if (!providedToken || providedToken !== KEEP_ALIVE_SECRET) {
      console.warn("[Keep-Alive] Unauthorized access attempt");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Unauthorized" 
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[Keep-Alive] Supabase environment variables not found");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Database configuration error" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const startTime = Date.now();
    
    const dbResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/keep_alive_ping`,
      {
        method: "POST",
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const responseTime = Date.now() - startTime;

    if (!dbResponse.ok) {
      console.error(`[Keep-Alive] Database ping failed: ${dbResponse.status} ${dbResponse.statusText}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Database ping failed",
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Keep-Alive] ✓ Database ping successful (${responseTime}ms)`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Database keep-alive ping successful",
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("[Keep-Alive] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Internal server error",
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});