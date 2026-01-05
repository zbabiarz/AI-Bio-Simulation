import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Upload, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  color: string;
  icon: string;
  authUrl: string;
}

const providers: Provider[] = [
  {
    id: 'oura',
    name: 'Oura Ring',
    color: 'bg-slate-800 hover:bg-slate-700',
    icon: 'O',
    authUrl: 'https://cloud.ouraring.com/oauth/authorize',
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    color: 'bg-amber-500 hover:bg-amber-600',
    icon: 'W',
    authUrl: 'https://api.whoop.com/oauth/authorize',
  },
  {
    id: 'apple',
    name: 'Apple Watch',
    color: 'bg-gray-900 hover:bg-gray-800',
    icon: 'A',
    authUrl: 'https://appleid.apple.com/auth/authorize',
  },
];

interface Connection {
  id: string;
  provider: string;
  created_at: string;
}

export default function ConnectPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  async function fetchConnections() {
    try {
      const { data, error } = await supabase
        .from('user_connections')
        .select('id, provider, created_at')
        .eq('user_id', user?.id);

      if (error) throw error;
      setConnections(data || []);
    } catch (err) {
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  }

  function isConnected(providerId: string): boolean {
    return connections.some((c) => c.provider === providerId);
  }

  async function handleConnect(provider: Provider) {
    setConnecting(provider.id);

    const redirectUri = `${window.location.origin}/connect/callback/${provider.id}`;
    const clientId = import.meta.env[`VITE_${provider.id.toUpperCase()}_CLIENT_ID`] || 'demo_client_id';
    const scope = getProviderScope(provider.id);
    const state = crypto.randomUUID();

    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_provider', provider.id);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      state: state,
    });

    window.location.href = `${provider.authUrl}?${params.toString()}`;
  }

  function getProviderScope(providerId: string): string {
    const scopes: Record<string, string> = {
      oura: 'personal daily heartrate workout tag session spo2',
      whoop: 'read:profile read:cycles read:recovery read:sleep read:workout',
      apple: 'health.heartrate health.sleep health.activity health.workout',
    };
    return scopes[providerId] || '';
  }

  async function handleDisconnect(providerId: string) {
    try {
      const { error } = await supabase
        .from('user_connections')
        .delete()
        .eq('user_id', user?.id)
        .eq('provider', providerId);

      if (error) throw error;
      setConnections(connections.filter((c) => c.provider !== providerId));
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-primaryDeep dark:text-white mb-2">Connect Your Devices</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Link your wearable devices to automatically sync your health data.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-primaryDeep dark:text-white mb-4">OAuth Connections</h2>
        <div className="space-y-3">
          {providers.map((provider) => {
            const connected = isConnected(provider.id);
            return (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${provider.color.split(' ')[0]} rounded-lg flex items-center justify-center`}>
                    <span className="text-white font-bold">{provider.icon}</span>
                  </div>
                  <div>
                    <p className="font-medium text-primaryDeep dark:text-white">{provider.name}</p>
                    {connected && (
                      <p className="text-sm text-primary flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Connected
                      </p>
                    )}
                  </div>
                </div>
                {connected ? (
                  <button
                    onClick={() => handleDisconnect(provider.id)}
                    className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={() => handleConnect(provider)}
                    disabled={connecting === provider.id}
                    className={`px-4 py-2 text-sm text-white rounded-lg transition-colors flex items-center gap-2 ${provider.color} disabled:opacity-50`}
                  >
                    {connecting === provider.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ExternalLink className="w-4 h-4" />
                    )}
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-primaryDeep dark:text-white mb-2">Manual Upload</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
          Don't see your device? You can manually upload exported data files.
        </p>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primaryDeep text-white font-medium rounded-lg transition-colors"
        >
          <Upload className="w-5 h-5" />
          Upload Data File Instead
        </Link>
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong className="text-gray-700 dark:text-gray-300">Note:</strong> OAuth connections require API credentials
          to be configured. Contact your administrator if connections are not working.
        </p>
      </div>
    </div>
  );
}
