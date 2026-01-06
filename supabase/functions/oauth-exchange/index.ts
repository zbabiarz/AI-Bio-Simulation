import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TokenExchangeRequest {
  provider: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { provider, code, redirectUri, clientId, clientSecret }: TokenExchangeRequest = await req.json();

    const tokenEndpoints: Record<string, string> = {
      oura: 'https://api.ouraring.com/oauth/token',
      fitbit: 'https://api.fitbit.com/oauth2/token',
      whoop: 'https://api.whoop.com/oauth/token',
      garmin: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    };

    const endpoint = tokenEndpoints[provider];
    if (!endpoint) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error_description || `Failed to exchange code: ${response.statusText}`);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000).toISOString()
          : null,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    console.error('OAuth token exchange error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
