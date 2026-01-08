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
  codeVerifier?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { provider, code, redirectUri, clientId, clientSecret, codeVerifier }: TokenExchangeRequest = await req.json();

    const tokenEndpoints: Record<string, string> = {
      oura: 'https://api.ouraring.com/oauth/token',
      fitbit: 'https://api.fitbit.com/oauth2/token',
      whoop: 'https://api.prod.whoop.com/oauth/oauth2/token',
      garmin: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    };

    const endpoint = tokenEndpoints[provider];
    if (!endpoint) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    let headers: Record<string, string>;
    let bodyParams: Record<string, string>;

    if (provider === 'whoop') {
      headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      bodyParams = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      };
    } else if (provider === 'fitbit') {
      headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      };
      bodyParams = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      };
      if (codeVerifier) {
        bodyParams.code_verifier = codeVerifier;
      }
    } else {
      headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      };
      bodyParams = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      };
    }

    console.log(`Making token exchange request to ${provider}:`, {
      endpoint,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasCode: !!code,
      redirectUri,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: new URLSearchParams(bodyParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Token exchange failed for ${provider}:`, {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });

      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error_description: errorText };
      }

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
