interface OAuthConfig {
  authUrl: string;
  clientId: string;
  scope: string;
  redirectUri: string;
}

export function getOAuthConfig(provider: string): OAuthConfig | null {
  const clientId = import.meta.env[`VITE_${provider.toUpperCase()}_CLIENT_ID`];

  if (!clientId) {
    console.warn(`OAuth client ID not configured for ${provider}`);
    return null;
  }

  const envRedirectUri = import.meta.env[`VITE_${provider.toUpperCase()}_REDIRECT_URI`];
  const redirectUri = envRedirectUri || `${window.location.origin}/connect/callback/${provider}`;

  const configs: Record<string, { authUrl: string; scope: string }> = {
    oura: {
      authUrl: 'https://cloud.ouraring.com/oauth/authorize',
      scope: 'email personal daily heartrate tag workout session spo2 ring_configuration stress heart_health',
    },
    whoop: {
      authUrl: 'https://app.whoop.com/oauth/oauth2/auth',
      scope: 'read:recovery read:cycles read:sleep read:workout read:profile',
    },
    apple: {
      authUrl: 'https://appleid.apple.com/auth/authorize',
      scope: 'name email',
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
  };
}

export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function initiateOAuthFlow(provider: string): void {
  const config = getOAuthConfig(provider);
  if (!config) {
    throw new Error(`OAuth not configured for ${provider}`);
  }

  const state = generateState();

  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_provider', provider);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scope,
    state: state,
  });

  const authUrl = `${config.authUrl}?${params.toString()}`;
  window.location.href = authUrl;
}
