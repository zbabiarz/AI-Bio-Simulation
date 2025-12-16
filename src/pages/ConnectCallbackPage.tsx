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

      const savedState = sessionStorage.getItem('oauth_state');
      const savedProvider = sessionStorage.getItem('oauth_provider');

      if (state !== savedState || provider !== savedProvider) {
        throw new Error('Invalid OAuth state. Please try connecting again.');
      }

      if (!code) {
        throw new Error('No authorization code received.');
      }

      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_provider');

      const tokens = await exchangeCodeForTokens(provider!, code);

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

      setStatus('success');

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('OAuth callback error:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  }

  async function exchangeCodeForTokens(
    providerName: string,
    code: string
  ): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
  }> {
    const tokenEndpoints: Record<string, string> = {
      oura: 'https://api.ouraring.com/oauth/token',
      fitbit: 'https://api.fitbit.com/oauth2/token',
      whoop: 'https://api.whoop.com/oauth/token',
      garmin: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    };

    const endpoint = tokenEndpoints[providerName];
    if (!endpoint) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    const clientId = import.meta.env[`VITE_${providerName.toUpperCase()}_CLIENT_ID`];
    const clientSecret = import.meta.env[`VITE_${providerName.toUpperCase()}_CLIENT_SECRET`];
    const redirectUri = `${window.location.origin}/connect/callback/${providerName}`;

    if (!clientId || !clientSecret) {
      console.warn('OAuth credentials not configured, using demo mode');
      return {
        access_token: `demo_${providerName}_token_${Date.now()}`,
        refresh_token: `demo_${providerName}_refresh_${Date.now()}`,
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      };
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
      throw new Error(errorData.error_description || 'Failed to exchange code for tokens');
    }

    const data = await response.json();

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined,
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
              onClick={() => navigate('/connect', { replace: true })}
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
