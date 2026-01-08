import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

type CallbackStatus = 'processing' | 'success' | 'error';

export default function ConnectCallbackPage() {
  const { provider } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user && provider) {
      handleCallback();
    }
  }, [user, provider]);

  async function handleCallback() {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        throw new Error(errorDescription || error);
      }

      let savedState = sessionStorage.getItem('oauth_state');
      let savedProvider = sessionStorage.getItem('oauth_provider');

      // Fallback to localStorage if sessionStorage is empty
      if (!savedState) {
        savedState = localStorage.getItem('oauth_state');
        savedProvider = localStorage.getItem('oauth_provider');
        const timestamp = localStorage.getItem('oauth_timestamp');

        // Check if localStorage data is not too old (5 minutes max)
        if (timestamp && Date.now() - parseInt(timestamp) > 5 * 60 * 1000) {
          localStorage.removeItem('oauth_state');
          localStorage.removeItem('oauth_provider');
          localStorage.removeItem('oauth_timestamp');
          throw new Error('OAuth session expired. Please try connecting again.');
        }
      }

      console.log('OAuth callback debug:', {
        receivedState: state,
        savedState,
        receivedProvider: provider,
        savedProvider,
        stateMatch: state === savedState,
        providerMatch: provider === savedProvider,
      });

      if (!savedState) {
        throw new Error('OAuth session expired. Please try connecting again.');
      }

      if (state !== savedState) {
        throw new Error('OAuth state mismatch. This may be a security issue or the session expired.');
      }

      if (provider !== savedProvider) {
        throw new Error('Provider mismatch. Please try connecting again.');
      }

      if (!code) {
        throw new Error('No authorization code received.');
      }

      let codeVerifier = sessionStorage.getItem('oauth_code_verifier');
      if (!codeVerifier) {
        codeVerifier = localStorage.getItem('oauth_code_verifier');
      }

      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_provider');
      sessionStorage.removeItem('oauth_code_verifier');
      localStorage.removeItem('oauth_state');
      localStorage.removeItem('oauth_provider');
      localStorage.removeItem('oauth_timestamp');
      localStorage.removeItem('oauth_code_verifier');

      const tokens = await exchangeCodeForTokens(provider!, code, codeVerifier || undefined);

      const { error: dbError } = await supabase
        .from('user_connections')
        .upsert({
          user_id: user?.id,
          provider: provider,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: tokens.expires_at || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,provider',
        });

      if (dbError) throw dbError;

      await supabase.from('device_connections').upsert({
        user_id: user?.id,
        provider: provider,
        connection_type: 'oauth',
        sync_status: 'active',
        last_sync_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' });

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'connect_device',
        details: { provider: provider, connection_type: 'oauth' },
      });

      setStatus('success');

      setTimeout(() => {
        navigate('/devices?tab=connected', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('OAuth callback error:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  async function exchangeCodeForTokens(
    providerName: string,
    code: string,
    codeVerifier?: string
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
  }> {
    const clientId = import.meta.env[`VITE_${providerName.toUpperCase()}_CLIENT_ID`];
    const clientSecret = import.meta.env[`VITE_${providerName.toUpperCase()}_CLIENT_SECRET`];
    const envRedirectUri = import.meta.env[`VITE_${providerName.toUpperCase()}_REDIRECT_URI`];
    const redirectUri = envRedirectUri || `${window.location.origin}/connect/callback/${providerName}`;

    if (!clientId || !clientSecret) {
      console.warn('OAuth credentials not configured, using demo mode');
      return {
        access_token: `demo_${providerName}_token_${Date.now()}`,
        refresh_token: `demo_${providerName}_refresh_${Date.now()}`,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
    }

    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-exchange`;

    const requestBody: Record<string, string> = {
      provider: providerName,
      code,
      redirectUri,
      clientId,
      clientSecret,
    };

    if (codeVerifier) {
      requestBody.codeVerifier = codeVerifier;
    }

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to exchange code for tokens');
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    };
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-12 h-12 text-[#1A5BE9] animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Connecting to {provider?.charAt(0).toUpperCase()}{provider?.slice(1)}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we complete the connection...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-[#1A5BE9]/10 dark:bg-[#1A5BE9]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-[#1A5BE9]" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Connected Successfully
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your {provider?.charAt(0).toUpperCase()}{provider?.slice(1)} account has been linked.
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-500/20 dark:bg-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Connection Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{errorMessage}</p>
            <button
              onClick={() => navigate('/devices?tab=add', { replace: true })}
              className="px-5 py-2.5 bg-[#1A5BE9] hover:bg-[#1450C9] text-white font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
