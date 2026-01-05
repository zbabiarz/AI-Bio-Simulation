import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logPHIAccess } from '../lib/audit';
import { initiateOAuthFlow } from '../lib/oauth';
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
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileCode,
  X,
  Info,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

type TabType = 'connected' | 'add' | 'upload';

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
  exportInstructions: string[];
}

interface ParsedMetric {
  date: string;
  hrv?: number;
  resting_heart_rate?: number;
  sleep_duration_minutes?: number;
  sleep_efficiency?: number;
  deep_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  light_sleep_minutes?: number;
  steps?: number;
  active_calories?: number;
  total_calories?: number;
  activity_minutes?: number;
  stress_level?: number;
  recovery_score?: number;
  body_battery?: number;
  weight_kg?: number;
  body_fat_percentage?: number;
}

const deviceProviders: DeviceProvider[] = [
  {
    id: 'oura',
    name: 'Oura Ring',
    logo: 'O',
    color: 'bg-slate-800',
    oauthSupported: true,
    fileTypes: ['.csv', '.json'],
    description: 'Sync sleep, readiness, activity, and HRV data from your Oura Ring.',
    exportInstructions: [
      'Open the Oura app on your phone',
      'Go to the menu (three lines)',
      'Tap Settings > Account',
      'Select "Download My Data"',
      'Choose your date range and export',
    ],
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    logo: 'W',
    color: 'bg-amber-500',
    oauthSupported: true,
    fileTypes: ['.csv', '.json'],
    description: 'Sync strain, recovery, sleep, and HRV data from your WHOOP band.',
    exportInstructions: [
      'Open the WHOOP app',
      'Tap the More menu',
      'Go to Settings > Data Export',
      'Select date range and download',
    ],
  },
  {
    id: 'apple',
    name: 'Apple Watch',
    logo: 'A',
    color: 'bg-gray-900',
    oauthSupported: true,
    fileTypes: ['.xml', '.json'],
    description: 'Sync heart rate, activity, sleep, and workout data from Apple Health.',
    exportInstructions: [
      'Open the Health app on your iPhone',
      'Tap your profile picture in the top right',
      'Scroll down and tap "Export All Health Data"',
      'Wait for the export to complete and share the file',
    ],
  },
];

const otherDeviceProvider: DeviceProvider = {
  id: 'other',
  name: 'Other Device',
  logo: '?',
  color: 'bg-gray-500',
  oauthSupported: false,
  fileTypes: ['.csv', '.json', '.xml'],
  description: 'Garmin, Fitbit, Samsung, Polar, and other wearables via file upload.',
  exportInstructions: [
    'Export your health data from your device app',
    'Most apps have an export option in Settings',
    'Look for "Export Data" or "Download My Data"',
    'Save the file in CSV or JSON format if possible',
  ],
};

export default function DevicesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('connected');
  const [connections, setConnections] = useState<DeviceConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceProvider | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);
  const [selectedSource, setSelectedSource] = useState('auto');
  const [showInstructions, setShowInstructions] = useState<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType | null;
    if (tab && ['connected', 'add', 'upload'].includes(tab)) {
      setActiveTab(tab);
    }
    const device = searchParams.get('device');
    if (device && (deviceProviders.find(d => d.id === device) || device === 'other')) {
      setSelectedSource(device);
      setShowInstructions(device);
      if (tab !== 'upload') {
        setActiveTab('upload');
      }
    }
  }, [searchParams]);

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

  function handleOAuthConnect(provider: DeviceProvider) {
    try {
      setConnecting(provider.id);
      initiateOAuthFlow(provider.id);
    } catch (error) {
      console.error('Failed to initiate OAuth flow:', error);
      setConnecting(null);
      alert('Failed to connect. Please ensure OAuth credentials are configured.');
    }
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

  function changeTab(tab: TabType) {
    setActiveTab(tab);
    setSearchParams({ tab });
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files).filter((file) => {
        const ext = file.name.toLowerCase();
        return ext.endsWith('.csv') || ext.endsWith('.json') || ext.endsWith('.xml') ||
               ext.endsWith('.fit') || ext.endsWith('.tcx') || ext.endsWith('.gpx');
      });
      setFiles((prev) => [...prev, ...newFiles]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  async function parseCSV(content: string): Promise<ParsedMetric[]> {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''));
    const metrics: ParsedMetric[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      const metric: ParsedMetric = {
        date: row.date || row.timestamp?.split('T')[0] || row.summary_date || row.day || new Date().toISOString().split('T')[0],
      };

      if (row.hrv || row.average_hrv || row.hrv_rmssd) metric.hrv = parseFloat(row.hrv || row.average_hrv || row.hrv_rmssd);
      if (row.resting_heart_rate || row.rhr || row.hr_lowest || row.resting_hr) {
        metric.resting_heart_rate = parseInt(row.resting_heart_rate || row.rhr || row.hr_lowest || row.resting_hr);
      }
      if (row.sleep_duration || row.sleep_duration_minutes || row.total_sleep || row.sleep_total || row.duration) {
        const val = row.sleep_duration || row.sleep_duration_minutes || row.total_sleep || row.sleep_total || row.duration;
        metric.sleep_duration_minutes = val.includes(':')
          ? parseInt(val.split(':')[0]) * 60 + parseInt(val.split(':')[1])
          : parseInt(val);
      }
      if (row.sleep_efficiency || row.efficiency) metric.sleep_efficiency = parseFloat(row.sleep_efficiency || row.efficiency);
      if (row.deep_sleep || row.deep_sleep_minutes || row.deep) {
        metric.deep_sleep_minutes = parseInt(row.deep_sleep || row.deep_sleep_minutes || row.deep);
      }
      if (row.rem_sleep || row.rem_sleep_minutes || row.rem) {
        metric.rem_sleep_minutes = parseInt(row.rem_sleep || row.rem_sleep_minutes || row.rem);
      }
      if (row.light_sleep || row.light_sleep_minutes || row.light) {
        metric.light_sleep_minutes = parseInt(row.light_sleep || row.light_sleep_minutes || row.light);
      }
      if (row.steps || row.total_steps || row.step_count) {
        metric.steps = parseInt(row.steps || row.total_steps || row.step_count);
      }
      if (row.active_calories || row.calories_active || row.active_energy) {
        metric.active_calories = parseInt(row.active_calories || row.calories_active || row.active_energy);
      }
      if (row.total_calories || row.calories || row.calories_total) {
        metric.total_calories = parseInt(row.total_calories || row.calories || row.calories_total);
      }
      if (row.activity_minutes || row.active_minutes || row.high_activity_time) {
        metric.activity_minutes = parseInt(row.activity_minutes || row.active_minutes || row.high_activity_time);
      }
      if (row.stress_level || row.stress || row.stress_score) {
        metric.stress_level = parseInt(row.stress_level || row.stress || row.stress_score);
      }
      if (row.recovery_score || row.recovery || row.readiness_score || row.readiness) {
        metric.recovery_score = parseInt(row.recovery_score || row.recovery || row.readiness_score || row.readiness);
      }
      if (row.body_battery || row.energy) {
        metric.body_battery = parseInt(row.body_battery || row.energy);
      }
      if (row.weight || row.weight_kg || row.body_weight) {
        metric.weight_kg = parseFloat(row.weight || row.weight_kg || row.body_weight);
      }
      if (row.body_fat || row.body_fat_percentage || row.fat_percentage) {
        metric.body_fat_percentage = parseFloat(row.body_fat || row.body_fat_percentage || row.fat_percentage);
      }

      if (metric.date && Object.keys(metric).length > 1) {
        metrics.push(metric);
      }
    }

    return metrics;
  }

  async function parseJSON(content: string): Promise<ParsedMetric[]> {
    try {
      const data = JSON.parse(content);
      const metrics: ParsedMetric[] = [];

      let items: unknown[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data.data) {
        items = Array.isArray(data.data) ? data.data : [data.data];
      } else if (data.sleep) {
        items = Array.isArray(data.sleep) ? data.sleep : [data.sleep];
      } else if (data.activity) {
        items = Array.isArray(data.activity) ? data.activity : [data.activity];
      } else if (data.records) {
        items = Array.isArray(data.records) ? data.records : [data.records];
      } else {
        items = [data];
      }

      for (const item of items) {
        if (typeof item !== 'object' || item === null) continue;
        const obj = item as Record<string, unknown>;

        const dateVal = obj.date || obj.timestamp || obj.summary_date || obj.day || obj.bedtime_start;
        const dateStr = typeof dateVal === 'string' ? dateVal.split('T')[0] : new Date().toISOString().split('T')[0];

        const metric: ParsedMetric = { date: dateStr };

        const hrvVal = obj.hrv || obj.average_hrv || obj.hrv_rmssd;
        if (hrvVal) metric.hrv = parseFloat(String(hrvVal));

        const rhrVal = obj.resting_heart_rate || obj.hr_lowest || obj.rhr;
        if (rhrVal) metric.resting_heart_rate = parseInt(String(rhrVal));

        const sleepVal = obj.sleep_duration_minutes || obj.total_sleep || obj.duration || obj.total;
        if (sleepVal) metric.sleep_duration_minutes = parseInt(String(sleepVal));

        const effVal = obj.sleep_efficiency || obj.efficiency;
        if (effVal) metric.sleep_efficiency = parseFloat(String(effVal));

        const deepVal = obj.deep_sleep || obj.deep || obj.deep_sleep_seconds;
        if (deepVal) {
          const deep = parseInt(String(deepVal));
          metric.deep_sleep_minutes = deep > 1000 ? Math.round(deep / 60) : deep;
        }

        const remVal = obj.rem_sleep || obj.rem || obj.rem_sleep_seconds;
        if (remVal) {
          const rem = parseInt(String(remVal));
          metric.rem_sleep_minutes = rem > 1000 ? Math.round(rem / 60) : rem;
        }

        const stepsVal = obj.steps || obj.total_steps;
        if (stepsVal) metric.steps = parseInt(String(stepsVal));

        const activeCalVal = obj.active_calories || obj.cal_active;
        if (activeCalVal) metric.active_calories = parseInt(String(activeCalVal));

        const totalCalVal = obj.total_calories || obj.cal_total || obj.calories;
        if (totalCalVal) metric.total_calories = parseInt(String(totalCalVal));

        const activityVal = obj.activity_minutes || obj.high_activity_time || obj.active_minutes;
        if (activityVal) metric.activity_minutes = parseInt(String(activityVal));

        const recoveryVal = obj.recovery_score || obj.score || obj.readiness_score;
        if (recoveryVal) metric.recovery_score = parseInt(String(recoveryVal));

        const stressVal = obj.stress_level || obj.stress;
        if (stressVal) metric.stress_level = parseInt(String(stressVal));

        if (Object.keys(metric).length > 1) {
          metrics.push(metric);
        }
      }

      return metrics;
    } catch {
      return [];
    }
  }

  async function parseXML(content: string): Promise<ParsedMetric[]> {
    const metrics: ParsedMetric[] = [];
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');

    const records = xmlDoc.querySelectorAll('Record, record, entry, Entry, HealthData, healthdata');

    const dailyData: Record<string, ParsedMetric> = {};

    records.forEach((record) => {
      const startDate = record.getAttribute('startDate') || record.getAttribute('date');
      const date = startDate?.split(' ')[0] || startDate?.split('T')[0];

      if (!date) return;

      if (!dailyData[date]) {
        dailyData[date] = { date };
      }

      const type = record.getAttribute('type') || record.tagName || '';
      const value = record.getAttribute('value') || record.textContent || '';
      const numValue = parseFloat(value);

      if (isNaN(numValue)) return;

      if (type.includes('HeartRateVariability') || type.includes('HRV')) {
        if (!dailyData[date].hrv || numValue > dailyData[date].hrv!) {
          dailyData[date].hrv = numValue * (numValue < 10 ? 1000 : 1);
        }
      }
      if (type.includes('RestingHeartRate')) {
        dailyData[date].resting_heart_rate = Math.round(numValue);
      }
      if (type.includes('StepCount') || type.includes('Steps')) {
        dailyData[date].steps = (dailyData[date].steps || 0) + Math.round(numValue);
      }
      if (type.includes('ActiveEnergyBurned')) {
        dailyData[date].active_calories = (dailyData[date].active_calories || 0) + Math.round(numValue);
      }
      if (type.includes('SleepAnalysis')) {
        const duration = parseInt(record.getAttribute('duration') || '0');
        dailyData[date].sleep_duration_minutes = (dailyData[date].sleep_duration_minutes || 0) + Math.round(duration / 60);
      }
    });

    Object.values(dailyData).forEach((metric) => {
      if (Object.keys(metric).length > 1) {
        metrics.push(metric);
      }
    });

    return metrics;
  }

  function detectSource(filename: string, content: string): string {
    const lower = (filename + content).toLowerCase();
    if (lower.includes('oura')) return 'oura';
    if (lower.includes('whoop')) return 'whoop';
    if (lower.includes('apple') || lower.includes('healthkit') || lower.includes('health')) return 'apple';
    return 'manual';
  }

  function createNormalizedData(metrics: ParsedMetric[]): {
    hrv?: number;
    resting_hr?: number;
    sleep_hours?: number;
    steps?: number;
    recovery_score?: number;
  } {
    if (metrics.length === 0) return {};

    const latest = metrics[metrics.length - 1];
    const normalized: {
      hrv?: number;
      resting_hr?: number;
      sleep_hours?: number;
      steps?: number;
      recovery_score?: number;
    } = {};

    const hrvValues = metrics.filter(m => m.hrv).map(m => m.hrv!);
    if (hrvValues.length > 0) {
      normalized.hrv = Math.round(hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length);
    } else if (latest.hrv) {
      normalized.hrv = Math.round(latest.hrv);
    }

    const rhrValues = metrics.filter(m => m.resting_heart_rate).map(m => m.resting_heart_rate!);
    if (rhrValues.length > 0) {
      normalized.resting_hr = Math.round(rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length);
    } else if (latest.resting_heart_rate) {
      normalized.resting_hr = latest.resting_heart_rate;
    }

    const sleepValues = metrics.filter(m => m.sleep_duration_minutes).map(m => m.sleep_duration_minutes!);
    if (sleepValues.length > 0) {
      const avgMinutes = sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length;
      normalized.sleep_hours = Math.round((avgMinutes / 60) * 10) / 10;
    } else if (latest.sleep_duration_minutes) {
      normalized.sleep_hours = Math.round((latest.sleep_duration_minutes / 60) * 10) / 10;
    }

    const stepsValues = metrics.filter(m => m.steps).map(m => m.steps!);
    if (stepsValues.length > 0) {
      normalized.steps = Math.round(stepsValues.reduce((a, b) => a + b, 0) / stepsValues.length);
    } else if (latest.steps) {
      normalized.steps = latest.steps;
    }

    const recoveryValues = metrics.filter(m => m.recovery_score).map(m => m.recovery_score!);
    if (recoveryValues.length > 0) {
      normalized.recovery_score = Math.round(recoveryValues.reduce((a, b) => a + b, 0) / recoveryValues.length);
    } else if (latest.recovery_score) {
      normalized.recovery_score = latest.recovery_score;
    }

    return normalized;
  }

  async function processFiles() {
    if (!user || files.length === 0) return;

    setUploading(true);
    setProgress(0);
    setResults(null);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(Math.round(((i + 0.5) / files.length) * 100));

      try {
        const content = await file.text();
        let metrics: ParsedMetric[] = [];
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.csv')) {
          metrics = await parseCSV(content);
        } else if (fileName.endsWith('.json')) {
          metrics = await parseJSON(content);
        } else if (fileName.endsWith('.xml')) {
          metrics = await parseXML(content);
        } else if (fileName.endsWith('.fit') || fileName.endsWith('.tcx') || fileName.endsWith('.gpx')) {
          errors.push(`${file.name}: FIT/TCX/GPX files require conversion. Please export as CSV or JSON.`);
          continue;
        }

        if (metrics.length === 0) {
          errors.push(`${file.name}: No valid health data found in file`);
          continue;
        }

        const source = selectedSource === 'auto' ? detectSource(file.name, content) : (selectedSource === 'other' ? 'manual' : selectedSource);

        for (const metric of metrics) {
          const { error } = await supabase.from('health_metrics').upsert(
            {
              user_id: user.id,
              ...metric,
              source,
            },
            { onConflict: 'user_id,date,source' }
          );

          if (error) {
            errors.push(`${file.name}: ${error.message}`);
          } else {
            successCount++;
          }
        }

        await logPHIAccess({
          userId: user.id,
          accessType: 'create',
          resourceType: 'health_metrics',
          metadata: { file_name: file.name, records_count: metrics.length, source },
        });

        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'upload_data',
          details: { file_name: file.name, records_count: metrics.length, source },
        });

        if (source !== 'manual' && source !== 'auto' && source !== 'other') {
          await supabase.from('device_connections').upsert({
            user_id: user.id,
            provider: source,
            connection_type: 'manual',
            sync_status: 'active',
            last_sync_at: new Date().toISOString(),
          }, { onConflict: 'user_id,provider' });
        }

        const normalizedData = createNormalizedData(metrics);
        await supabase.from('wearable_data').insert({
          user_id: user.id,
          source,
          normalized: normalizedData,
          raw_filename: file.name,
        });
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setResults({ success: successCount, errors });
    setUploading(false);
    if (errors.length === 0) {
      setFiles([]);
    }
  }

  function getFileIcon(filename: string) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.json')) return <FileJson className="w-5 h-5 text-amber-400" />;
    if (lower.endsWith('.xml')) return <FileText className="w-5 h-5 text-blue-400" />;
    if (lower.endsWith('.fit') || lower.endsWith('.tcx') || lower.endsWith('.gpx')) {
      return <FileCode className="w-5 h-5 text-rose-400" />;
    }
    return <FileSpreadsheet className="w-5 h-5 text-primary" />;
  }

  const connectedDevices = connections.filter((c) => c.sync_status !== 'disconnected');
  const availableDevices = deviceProviders.filter(
    (p) => !connections.find((c) => c.provider === p.id)
  );

  const allDeviceProviders = [...deviceProviders, otherDeviceProvider];
  const getDeviceById = (id: string) => allDeviceProviders.find(d => d.id === id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primaryDeep dark:text-white mb-2">Devices & Data</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Connect wearable devices or upload health data files
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => changeTab('connected')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'connected'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Wifi className="w-4 h-4" />
              My Devices
              {connectedDevices.length > 0 && (
                <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-xs rounded-full">
                  {connectedDevices.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => changeTab('add')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'add'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Link2 className="w-4 h-4" />
              Connect Device
            </div>
          </button>
          <button
            onClick={() => changeTab('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              Upload Data
            </div>
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'connected' && (
            <div className="space-y-4">
              {connectedDevices.length > 0 ? (
                connectedDevices.map((connection) => {
                  const provider = deviceProviders.find((p) => p.id === connection.provider);
                  if (!provider) return null;

                  return (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 ${provider.color} rounded-xl flex items-center justify-center`}>
                          <span className="text-xl font-bold text-white">{provider.logo}</span>
                        </div>
                        <div>
                          <h3 className="text-primaryDeep dark:text-white font-semibold">{provider.name}</h3>
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
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {connection.connection_type === 'manual' && (
                          <button
                            onClick={() => {
                              setSelectedSource(connection.provider);
                              changeTab('upload');
                            }}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-primaryDeep dark:text-white text-sm rounded-lg transition-colors"
                          >
                            <Upload className="w-4 h-4" />
                            Upload
                          </button>
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
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <WifiOff className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-primaryDeep dark:text-white mb-2">No Devices Connected</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-md mx-auto">
                    Connect your wearable device to automatically sync health data, or upload data files manually.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => changeTab('add')}
                      className="inline-flex items-center gap-2 bg-primary hover:bg-primaryDark text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                    >
                      <Link2 className="w-4 h-4" />
                      Connect Device
                    </button>
                    <button
                      onClick={() => changeTab('upload')}
                      className="inline-flex items-center gap-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-primaryDeep dark:text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'add' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  Primary Devices (OAuth Supported)
                </h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  {deviceProviders.map((provider) => {
                    const isConnected = connections.some(c => c.provider === provider.id);
                    return (
                      <button
                        key={provider.id}
                        onClick={() => !isConnected && setSelectedDevice(provider)}
                        disabled={isConnected}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          isConnected
                            ? 'bg-primary/5 border-primary/30 cursor-default'
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className={`w-10 h-10 ${provider.color} rounded-xl flex items-center justify-center`}>
                            <span className="text-lg font-bold text-white">{provider.logo}</span>
                          </div>
                          {isConnected ? (
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <Check className="w-3 h-3" />
                              Connected
                            </span>
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <h4 className="text-primaryDeep dark:text-white font-medium mb-1">{provider.name}</h4>
                        <p className="text-gray-500 dark:text-gray-400 text-xs line-clamp-2">{provider.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Watch className="w-4 h-4" />
                  Other Devices (Manual Upload)
                </h3>
                <button
                  onClick={() => changeTab('upload')}
                  className="w-full p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-primary/50 transition-all flex items-center gap-4 text-left"
                >
                  <div className="w-10 h-10 bg-gray-500 rounded-xl flex items-center justify-center">
                    <Watch className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-primaryDeep dark:text-white font-medium">Other Wearables</h4>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      Garmin, Fitbit, Samsung, Polar, and more - upload via CSV/JSON files
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-3">
                {deviceProviders.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => {
                      setSelectedSource(device.id);
                      setShowInstructions(device.id);
                    }}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      selectedSource === device.id
                        ? 'bg-primary/10 border-primary'
                        : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 hover:border-primary/50'
                    }`}
                  >
                    <div className={`w-10 h-10 ${device.color} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                      <span className="font-bold text-white">{device.logo}</span>
                    </div>
                    <p className="text-gray-900 dark:text-white text-xs font-medium">{device.name}</p>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setSelectedSource('other');
                    setShowInstructions('other');
                  }}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    selectedSource === 'other'
                      ? 'bg-primary/10 border-primary'
                      : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 hover:border-primary/50'
                  }`}
                >
                  <div className="w-10 h-10 bg-gray-500 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Watch className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-gray-900 dark:text-white text-xs font-medium">Other</p>
                </button>
              </div>

              {showInstructions && (
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-primaryDeep dark:text-white font-medium flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />
                      How to Export from {getDeviceById(showInstructions)?.name}
                    </h4>
                    <button
                      onClick={() => setShowInstructions(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <ol className="space-y-1.5">
                    {getDeviceById(showInstructions)?.exportInstructions.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-gray-600 dark:text-gray-400 text-sm">
                        <span className="w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs flex-shrink-0">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-gray-200 dark:border-slate-700 hover:border-gray-300'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept=".csv,.json,.xml,.fit,.tcx,.gpx"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-14 h-14 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-7 h-7 text-gray-500 dark:text-gray-400" />
                </div>
                <p className="text-gray-900 dark:text-white font-medium mb-1">
                  Drag and drop files here
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">or click to browse</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['.csv', '.json', '.xml'].map((ext) => (
                    <span key={ext} className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                      {ext}
                    </span>
                  ))}
                </div>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">
                    {files.length} file{files.length > 1 ? 's' : ''} selected
                  </p>
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.name)}
                        <div>
                          <p className="text-gray-900 dark:text-white text-sm">{file.name}</p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploading && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Processing files...</span>
                    <span className="text-primary text-sm">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {results && (
                <div className="space-y-2">
                  {results.success > 0 && (
                    <div className="flex items-center gap-2 text-primary bg-primary/10 rounded-lg p-3">
                      <Check className="w-5 h-5" />
                      <span className="text-sm">Successfully imported {results.success} records</span>
                    </div>
                  )}
                  {results.errors.length > 0 && (
                    <div className="bg-red-500/10 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-red-500 mb-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">{results.errors.length} issue{results.errors.length > 1 ? 's' : ''}</span>
                      </div>
                      <ul className="text-red-500 text-xs space-y-1">
                        {results.errors.slice(0, 3).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {results.errors.length > 3 && (
                          <li>...and {results.errors.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={processFiles}
                disabled={files.length === 0 || uploading}
                className="w-full bg-primary hover:bg-primaryDark text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    Process & Import Data
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-lg border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-14 h-14 ${selectedDevice.color} rounded-xl flex items-center justify-center`}>
                <span className="text-2xl font-bold text-white">{selectedDevice.logo}</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-primaryDeep dark:text-white">Connect {selectedDevice.name}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{selectedDevice.description}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {selectedDevice.oauthSupported && (
                <button
                  onClick={() => handleOAuthConnect(selectedDevice)}
                  disabled={connecting === selectedDevice.id}
                  className="w-full bg-primary hover:bg-primaryDark text-white font-semibold py-4 px-4 rounded-xl flex items-center justify-between transition-all disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <Link2 className="w-5 h-5" />
                    <div className="text-left">
                      <p className="font-semibold">Connect with {selectedDevice.name}</p>
                      <p className="text-white/80 text-xs">Automatic sync - Recommended</p>
                    </div>
                  </div>
                  {connecting === selectedDevice.id ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ExternalLink className="w-5 h-5" />
                  )}
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedSource(selectedDevice.id);
                  setSelectedDevice(null);
                  changeTab('upload');
                }}
                className="w-full bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-primaryDeep dark:text-white py-4 px-4 rounded-xl flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Upload className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-semibold">Upload Files Manually</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      Supports {selectedDevice.fileTypes.join(', ')}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <button
              onClick={() => setSelectedDevice(null)}
              className="w-full py-2.5 px-4 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-primaryDeep dark:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
