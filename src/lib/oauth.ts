interface OAuthConfig {
  authUrl: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  usePKCE?: boolean;
}

export function getOAuthConfig(provider: string): OAuthConfig | null {
  const clientId = import.meta.env[`VITE_${provider.toUpperCase()}_CLIENT_ID`];

  if (!clientId) {
    console.warn(`OAuth client ID not configured for ${provider}`);
    return null;
  }

  const envRedirectUri = import.meta.env[`VITE_${provider.toUpperCase()}_REDIRECT_URI`];
  const redirectUri = envRedirectUri || `${window.location.origin}/connect/callback/${provider}`;

  const configs: Record<string, { authUrl: string; scope: string; usePKCE?: boolean }> = {
    oura: {
      authUrl: 'https://cloud.ouraring.com/oauth/authorize',
      scope: 'email personal daily heartrate tag workout session spo2 ring_configuration stress heart_health',
    },
    fitbit: {
      authUrl: 'https://www.fitbit.com/oauth2/authorize',
      scope: 'activity heartrate sleep profile weight oxygen_saturation respiratory_rate cardio_fitness temperature',
      usePKCE: true,
    },
    whoop: {
      authUrl: 'https://api.prod.whoop.com/oauth/oauth2/auth',
      scope: 'read:recovery read:cycles read:sleep read:workout read:profile',
    },
  };

  const config = configs[provider];
  if (!config) {
    return null;
  }

  return {
    authUrl: config.authUrl,
    clientId,
    scope: config.scope,
    redirectUri,
    usePKCE: config.usePKCE,
  };
}

export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

export async function initiateOAuthFlow(provider: string): Promise<void> {
  const config = getOAuthConfig(provider);
  if (!config) {
    throw new Error(`OAuth not configured for ${provider}`);
  }

  const state = generateState();

  console.log('Initiating OAuth flow:', {
    provider,
    state,
    redirectUri: config.redirectUri,
    clientId: config.clientId.substring(0, 10) + '...',
    usePKCE: config.usePKCE,
  });

  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_provider', provider);
  localStorage.setItem('oauth_state', state);
  localStorage.setItem('oauth_provider', provider);
  localStorage.setItem('oauth_timestamp', Date.now().toString());

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    state: state,
  });

  if (config.usePKCE) {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    sessionStorage.setItem('oauth_code_verifier', codeVerifier);
    localStorage.setItem('oauth_code_verifier', codeVerifier);
    params.append('code_challenge', codeChallenge);
    params.append('code_challenge_method', 'S256');
  }

  const authUrl = `${config.authUrl}?${params.toString()}`;
  console.log('Redirecting to:', authUrl);
  window.location.href = authUrl;
}
