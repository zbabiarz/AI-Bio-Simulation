import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Watch,
  Smartphone,
  Link2,
  Unlink,
  RefreshCw,
  Check,
  AlertCircle,
  Upload,
  Clock,
  ChevronRight,
  Wifi,
  WifiOff,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface DeviceConnection {
  id: string;
  user_id: string;
  provider: string;
  connection_type: 'oauth' | 'manual';
  last_sync_at: string | null;
  sync_status: 'active' | 'paused' | 'error' | 'disconnected';
  sync_error: string | null;
  created_at: string;
}

interface DeviceProvider {
  id: string;
  name: string;
  logo: string;
  color: string;
  oauthSupported: boolean;
  fileTypes: string[];
  description: string;
  exportInstructions: string;
  oauthUrl?: string;
}

const deviceProviders: DeviceProvider[] = [
  {
    id: 'apple',
    name: 'Apple Watch / Health',
    logo: '',
    color: 'bg-gray-100',
    oauthSupported: true,
    fileTypes: ['.xml', '.json'],
    description: 'Sync heart rate, activity, sleep, and workout data from Apple Health.',
    exportInstructions: 'Health app > Profile icon > Export All Health Data',
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    logo: '',
    color: 'bg-white',
    oauthSupported: true,
    fileTypes: ['.csv', '.json'],
    description: 'Sync sleep, readiness, activity, and HRV data from your Oura Ring.',
    exportInstructions: 'Oura app > Settings > Account > Data Export',
  },
  {
    id: 'garmin',
    name: 'Garmin',
    logo: '',
    color: 'bg-blue-600',
    oauthSupported: true,
    fileTypes: ['.fit', '.tcx', '.gpx', '.csv'],
    description: 'Sync activities, sleep, stress, and body battery from Garmin Connect.',
    exportInstructions: 'Garmin Connect > Settings > Export Data',
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    logo: '',
    color: 'bg-primaryAccent',
    oauthSupported: true,
    fileTypes: ['.csv', '.json'],
    description: 'Sync strain, recovery, sleep, and HRV data from your WHOOP band.',
    exportInstructions: 'WHOOP app > More > Settings > Export Data',
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    logo: '',
    color: 'bg-primaryAccent',
    oauthSupported: true,
    fileTypes: ['.csv', '.xml'],
    description: 'Sync steps, heart rate, sleep, and activity data from Fitbit.',
    exportInstructions: 'Fitbit dashboard > Settings > Data Export',
  },
  {
    id: 'samsung',
    name: 'Samsung Health',
    logo: '',
    color: 'bg-blue-500',
    oauthSupported: true,
    fileTypes: ['.xml', '.csv'],
    description: 'Sync health data from Samsung Galaxy Watch and Samsung Health app.',
    exportInstructions: 'Samsung Health > Settings > Download personal data',
  },
  {
    id: 'polar',
    name: 'Polar',
    logo: '',
    color: 'bg-red-500',
    oauthSupported: true,
    fileTypes: ['.csv', '.tcx', '.fit'],
    description: 'Sync training, recovery, and sleep data from Polar devices.',
    exportInstructions: 'Polar Flow > Settings > Export Data',
  },
  {
    id: 'amazfit',
    name: 'Amazfit / Zepp',
    logo: '',
    color: 'bg-orange-500',
    oauthSupported: true,
    fileTypes: ['.csv', '.json'],
    description: 'Sync health and fitness data from Amazfit watches via Zepp app.',
    exportInstructions: 'Zepp app > Profile > Settings > Export Data',
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi Mi Band',
    logo: '',
    color: 'bg-orange-600',
    oauthSupported: true,
    fileTypes: ['.csv', '.xml'],
    description: 'Sync steps, sleep, and heart rate from Mi Band via Mi Fit app.',
    exportInstructions: 'Mi Fit app > Profile > Settings > Export Data',
  },
];

export default function DevicesPage() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<DeviceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceProvider | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user]);

  async function fetchConnections() {
    const { data } = await supabase
      .from('device_connections')
      .select('*')
      .eq('user_id', user!.id);

    if (data) {
      setConnections(data);
    }
    setLoading(false);
  }

  function getConnection(providerId: string): DeviceConnection | undefined {
    return connections.find((c) => c.provider === providerId);
  }

  async function handleOAuthConnect(provider: DeviceProvider) {
    setConnecting(provider.id);

    await new Promise((r) => setTimeout(r, 1500));

    const { error } = await supabase.from('device_connections').upsert({
      user_id: user!.id,
      provider: provider.id,
      connection_type: 'oauth',
      sync_status: 'active',
      last_sync_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    if (!error) {
      await supabase.from('activity_logs').insert({
        user_id: user!.id,
        action: 'connect_device',
        details: { provider: provider.id, connection_type: 'oauth' },
      });
      fetchConnections();
    }

    setConnecting(null);
    setSelectedDevice(null);
  }

  async function handleManualConnect(provider: DeviceProvider) {
    const { error } = await supabase.from('device_connections').upsert({
      user_id: user!.id,
      provider: provider.id,
      connection_type: 'manual',
      sync_status: 'active',
    }, { onConflict: 'user_id,provider' });

    if (!error) {
      await supabase.from('activity_logs').insert({
        user_id: user!.id,
        action: 'connect_device',
        details: { provider: provider.id, connection_type: 'manual' },
      });
      fetchConnections();
    }

    setSelectedDevice(null);
  }

  async function handleDisconnect(providerId: string) {
    await supabase
      .from('device_connections')
      .delete()
      .eq('user_id', user!.id)
      .eq('provider', providerId);

    await supabase.from('activity_logs').insert({
      user_id: user!.id,
      action: 'disconnect_device',
      details: { provider: providerId },
    });

    fetchConnections();
  }

  async function handleSync(connection: DeviceConnection) {
    setSyncing(connection.provider);

    await new Promise((r) => setTimeout(r, 2000));

    await supabase
      .from('device_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: 'active',
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    fetchConnections();
    setSyncing(null);
  }

  const connectedDevices = connections.filter((c) => c.sync_status !== 'disconnected');
  const availableDevices = deviceProviders.filter(
    (p) => !connections.find((c) => c.provider === p.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primaryDeep mb-2">Connect Your Devices</h1>
        <p className="text-gray-500">
          Connect your wearable devices to automatically sync health data or upload files manually.
        </p>
      </div>

      {connectedDevices.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-primaryDeep mb-4 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-primary" />
            Connected Devices ({connectedDevices.length})
          </h2>

          <div className="grid gap-4">
            {connectedDevices.map((connection) => {
              const provider = deviceProviders.find((p) => p.id === connection.provider);
              if (!provider) return null;

              return (
                <div
                  key={connection.id}
                  className="bg-white rounded-xl p-5 border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${provider.color} rounded-xl flex items-center justify-center`}>
                        <Watch className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-primaryDeep font-semibold">{provider.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`flex items-center gap-1 text-xs ${
                            connection.sync_status === 'active'
                              ? 'text-primary'
                              : connection.sync_status === 'error'
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }`}>
                            {connection.sync_status === 'active' ? (
                              <Check className="w-3 h-3" />
                            ) : connection.sync_status === 'error' ? (
                              <AlertCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {connection.sync_status === 'active'
                              ? 'Connected'
                              : connection.sync_status === 'error'
                              ? 'Sync Error'
                              : 'Paused'}
                          </span>
                          <span className="text-gray-400 text-xs">
                            via {connection.connection_type === 'oauth' ? 'OAuth' : 'Manual Upload'}
                          </span>
                        </div>
                        {connection.last_sync_at && (
                          <p className="text-gray-400 text-xs mt-1">
                            Last synced: {format(parseISO(connection.last_sync_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        )}
                        {connection.sync_error && (
                          <p className="text-red-400 text-xs mt-1">{connection.sync_error}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {connection.connection_type === 'manual' && (
                        <Link
                          to={`/upload?device=${connection.provider}`}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-50 text-primaryDeep text-sm rounded-lg transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Upload
                        </Link>
                      )}
                      {connection.connection_type === 'oauth' && (
                        <button
                          onClick={() => handleSync(connection)}
                          disabled={syncing === connection.provider}
                          className="flex items-center gap-2 px-3 py-2 bg-primary/20 hover:bg-primary/30 text-primary text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-4 h-4 ${syncing === connection.provider ? 'animate-spin' : ''}`} />
                          {syncing === connection.provider ? 'Syncing...' : 'Sync Now'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDisconnect(connection.provider)}
                        className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 text-sm rounded-lg transition-colors"
                      >
                        <Unlink className="w-4 h-4" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-primaryDeep mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-blue-400" />
          Available Devices
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableDevices.map((provider) => (
            <button
              key={provider.id}
              onClick={() => setSelectedDevice(provider)}
              className="bg-white rounded-xl p-5 border border-gray-200 hover:border-primary/50 transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 ${provider.color} rounded-xl flex items-center justify-center`}>
                  <Watch className="w-6 h-6 text-primaryDeep" />
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-primaryDeep font-semibold mb-1">{provider.name}</h3>
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">{provider.description}</p>
              <div className="flex flex-wrap gap-1">
                {provider.fileTypes.map((type) => (
                  <span
                    key={type}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {type}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {connectedDevices.length === 0 && (
        <div className="bg-primary/10 rounded-xl p-6 border border-primary/30 text-center">
          <WifiOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primaryDeep mb-2">No Devices Connected</h3>
          <p className="text-gray-600 text-sm mb-4">
            Connect your wearable device to start tracking your health data automatically, or upload your data files manually.
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primaryDark text-white font-semibold py-2.5 px-4 rounded-lg transition-all"
          >
            <Upload className="w-5 h-5" />
            Upload Data Manually
          </Link>
        </div>
      )}

      {selectedDevice && (
        <DeviceConnectionModal
          provider={selectedDevice}
          onClose={() => setSelectedDevice(null)}
          onOAuthConnect={() => handleOAuthConnect(selectedDevice)}
          onManualConnect={() => handleManualConnect(selectedDevice)}
          connecting={connecting === selectedDevice.id}
        />
      )}
    </div>
  );
}

interface DeviceConnectionModalProps {
  provider: DeviceProvider;
  onClose: () => void;
  onOAuthConnect: () => void;
  onManualConnect: () => void;
  connecting: boolean;
}

function DeviceConnectionModal({
  provider,
  onClose,
  onOAuthConnect,
  onManualConnect,
  connecting,
}: DeviceConnectionModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg border border-gray-200">
        <div className="flex items-center gap-4 mb-6">
          <div className={`w-14 h-14 ${provider.color} rounded-xl flex items-center justify-center`}>
            <Watch className="w-7 h-7 text-primaryDeep" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primaryDeep">Connect {provider.name}</h2>
            <p className="text-gray-600 text-sm">{provider.description}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {provider.oauthSupported && (
            <button
              onClick={onOAuthConnect}
              disabled={connecting}
              className="w-full bg-primary hover:bg-primaryDark text-white font-semibold py-4 px-4 rounded-xl flex items-center justify-between transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5" />
                <div className="text-left">
                  <p className="font-semibold">Connect with {provider.name}</p>
                  <p className="text-white/80 text-xs">Automatic sync - Recommended</p>
                </div>
              </div>
              {connecting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ExternalLink className="w-5 h-5" />
              )}
            </button>
          )}

          <Link
            to={`/upload?device=${provider.id}`}
            onClick={onManualConnect}
            className="w-full bg-gray-100 hover:bg-gray-50 text-primaryDeep py-4 px-4 rounded-xl flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">Upload Files Manually</p>
                <p className="text-gray-600 text-xs">
                  Supports {provider.fileTypes.join(', ')}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </Link>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h4 className="text-primaryDeep font-medium text-sm mb-2 flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-600" />
            How to Export Data
          </h4>
          <p className="text-gray-600 text-sm">{provider.exportInstructions}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-50 text-primaryDeep rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
