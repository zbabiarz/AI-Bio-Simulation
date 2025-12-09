import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logPHIAccess } from '../lib/audit';
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  X,
  Watch,
  FileJson,
  FileSpreadsheet,
  Link2,
  ChevronRight,
  Info,
  FileCode,
} from 'lucide-react';

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

interface DeviceInfo {
  id: string;
  name: string;
  color: string;
  fileTypes: string[];
  exportInstructions: string[];
  sampleFields: string[];
}

const deviceInfo: Record<string, DeviceInfo> = {
  apple: {
    id: 'apple',
    name: 'Apple Watch / Health',
    color: 'bg-slate-700',
    fileTypes: ['.xml', '.json', '.csv'],
    exportInstructions: [
      'Open the Health app on your iPhone',
      'Tap your profile picture in the top right',
      'Scroll down and tap "Export All Health Data"',
      'Wait for the export to complete and share the file',
    ],
    sampleFields: ['HRV', 'Heart Rate', 'Steps', 'Sleep Analysis', 'Active Energy'],
  },
  oura: {
    id: 'oura',
    name: 'Oura Ring',
    color: 'bg-slate-800',
    fileTypes: ['.csv', '.json'],
    exportInstructions: [
      'Open the Oura app',
      'Go to the menu (three lines)',
      'Tap Settings > Account',
      'Select "Download My Data"',
      'Choose your date range and export',
    ],
    sampleFields: ['HRV', 'Sleep Score', 'Readiness', 'Deep Sleep', 'REM Sleep'],
  },
  garmin: {
    id: 'garmin',
    name: 'Garmin',
    color: 'bg-blue-600',
    fileTypes: ['.fit', '.tcx', '.gpx', '.csv'],
    exportInstructions: [
      'Log in to Garmin Connect (web)',
      'Go to Activities or Health Stats',
      'Click the gear icon > Export',
      'Select Original format or CSV',
    ],
    sampleFields: ['Body Battery', 'Stress', 'Steps', 'Sleep', 'Heart Rate'],
  },
  whoop: {
    id: 'whoop',
    name: 'WHOOP',
    color: 'bg-teal-600',
    fileTypes: ['.csv', '.json'],
    exportInstructions: [
      'Open the WHOOP app',
      'Tap the More menu',
      'Go to Settings > Data Export',
      'Select date range and download',
    ],
    sampleFields: ['Strain', 'Recovery', 'HRV', 'RHR', 'Sleep Performance'],
  },
  fitbit: {
    id: 'fitbit',
    name: 'Fitbit',
    color: 'bg-teal-500',
    fileTypes: ['.csv', '.xml', '.json'],
    exportInstructions: [
      'Log in to fitbit.com',
      'Go to Settings > Data Export',
      'Click "Request Data"',
      'Download when ready (may take time)',
    ],
    sampleFields: ['Steps', 'Heart Rate', 'Sleep Stages', 'Active Minutes', 'Calories'],
  },
  samsung: {
    id: 'samsung',
    name: 'Samsung Health',
    color: 'bg-blue-500',
    fileTypes: ['.xml', '.csv'],
    exportInstructions: [
      'Open Samsung Health app',
      'Tap Menu > Settings',
      'Select "Download personal data"',
      'Wait for download to complete',
    ],
    sampleFields: ['Steps', 'Heart Rate', 'Sleep', 'Stress', 'Blood Oxygen'],
  },
  polar: {
    id: 'polar',
    name: 'Polar',
    color: 'bg-red-500',
    fileTypes: ['.csv', '.tcx', '.fit'],
    exportInstructions: [
      'Log in to Polar Flow (web)',
      'Go to your training diary',
      'Select sessions to export',
      'Choose export format and download',
    ],
    sampleFields: ['Training Load', 'Recovery', 'Sleep', 'Heart Rate', 'Calories'],
  },
  amazfit: {
    id: 'amazfit',
    name: 'Amazfit / Zepp',
    color: 'bg-orange-500',
    fileTypes: ['.csv', '.json'],
    exportInstructions: [
      'Open the Zepp app',
      'Go to Profile > Settings',
      'Tap "Export Data"',
      'Select data types and export',
    ],
    sampleFields: ['PAI', 'Sleep', 'Steps', 'Heart Rate', 'SpO2'],
  },
  xiaomi: {
    id: 'xiaomi',
    name: 'Xiaomi Mi Band',
    color: 'bg-orange-600',
    fileTypes: ['.csv', '.xml'],
    exportInstructions: [
      'Open Mi Fitness app',
      'Go to Profile > Settings',
      'Select "Export health data"',
      'Choose format and download',
    ],
    sampleFields: ['Steps', 'Sleep', 'Heart Rate', 'Stress', 'SpO2'],
  },
};

const allDevices = Object.values(deviceInfo);

export default function UploadPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; errors: string[] } | null>(null);
  const [selectedSource, setSelectedSource] = useState('auto');
  const [showInstructions, setShowInstructions] = useState<string | null>(null);

  useEffect(() => {
    const device = searchParams.get('device');
    if (device && deviceInfo[device]) {
      setSelectedSource(device);
      setShowInstructions(device);
    }
  }, [searchParams]);

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

        const source = selectedSource === 'auto' ? detectSource(file.name, content) : selectedSource;

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

        if (source !== 'manual' && source !== 'auto') {
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

  function detectSource(filename: string, content: string): string {
    const lower = (filename + content).toLowerCase();
    if (lower.includes('oura')) return 'oura';
    if (lower.includes('apple') || lower.includes('healthkit')) return 'apple';
    if (lower.includes('garmin')) return 'garmin';
    if (lower.includes('whoop')) return 'whoop';
    if (lower.includes('fitbit')) return 'fitbit';
    if (lower.includes('samsung')) return 'samsung';
    if (lower.includes('polar')) return 'polar';
    if (lower.includes('zepp') || lower.includes('amazfit')) return 'amazfit';
    if (lower.includes('xiaomi') || lower.includes('mi fit') || lower.includes('mifit')) return 'xiaomi';
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

  function getFileIcon(filename: string) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.json')) return <FileJson className="w-5 h-5 text-amber-400" />;
    if (lower.endsWith('.xml')) return <FileText className="w-5 h-5 text-blue-400" />;
    if (lower.endsWith('.fit') || lower.endsWith('.tcx') || lower.endsWith('.gpx')) {
      return <FileCode className="w-5 h-5 text-rose-400" />;
    }
    return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
  }

  const selectedDevice = selectedSource !== 'auto' && selectedSource !== 'manual' ? deviceInfo[selectedSource] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Upload Wearable Data</h1>
          <p className="text-slate-400">
            Import your health data from various wearable devices
          </p>
        </div>
        <Link
          to="/devices"
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          <Link2 className="w-4 h-4" />
          Connect Device
        </Link>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {allDevices.map((device) => (
          <button
            key={device.id}
            onClick={() => {
              setSelectedSource(device.id);
              setShowInstructions(device.id);
            }}
            className={`p-3 rounded-xl border text-center transition-all ${
              selectedSource === device.id
                ? 'bg-emerald-500/20 border-emerald-500/50'
                : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
            }`}
          >
            <div className={`w-8 h-8 ${device.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
              <Watch className="w-4 h-4 text-white" />
            </div>
            <p className="text-white text-xs font-medium truncate">{device.name.split(' ')[0]}</p>
          </button>
        ))}
      </div>

      {showInstructions && deviceInfo[showInstructions] && (
        <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Info className="w-5 h-5 text-emerald-400" />
              How to Export from {deviceInfo[showInstructions].name}
            </h3>
            <button
              onClick={() => setShowInstructions(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <ol className="space-y-2 mb-4">
            {deviceInfo[showInstructions].exportInstructions.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
                <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <span className="text-slate-500 text-xs">Supported formats:</span>
            {deviceInfo[showInstructions].fileTypes.map((type) => (
              <span key={type} className="px-2 py-0.5 bg-slate-700/50 text-slate-400 text-xs rounded">
                {type}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Data Source
          </label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="auto">Auto-detect from file</option>
            <optgroup label="Wearables">
              {allDevices.map((device) => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </optgroup>
            <option value="manual">Other / Manual Entry</option>
          </select>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-slate-600 hover:border-slate-500'
          }`}
        >
          <input
            type="file"
            multiple
            accept=".csv,.json,.xml,.fit,.tcx,.gpx"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-white font-medium mb-2">
            Drag and drop your files here
          </p>
          <p className="text-slate-400 text-sm mb-3">
            or click to browse
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['.csv', '.json', '.xml', '.fit', '.tcx', '.gpx'].map((ext) => (
              <span key={ext} className="px-2 py-1 bg-slate-700/50 text-slate-400 text-xs rounded">
                {ext}
              </span>
            ))}
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-slate-300 text-sm font-medium">
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </p>
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(file.name)}
                  <div>
                    <p className="text-white text-sm">{file.name}</p>
                    <p className="text-slate-500 text-xs">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm">Processing files...</span>
              <span className="text-emerald-400 text-sm">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {results && (
          <div className="mt-6 space-y-3">
            {results.success > 0 && (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 rounded-lg p-3">
                <Check className="w-5 h-5" />
                <span className="text-sm">Successfully imported {results.success} records</span>
              </div>
            )}
            {results.errors.length > 0 && (
              <div className="bg-red-500/10 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">{results.errors.length} issue{results.errors.length > 1 ? 's' : ''}</span>
                </div>
                <ul className="text-red-400/80 text-xs space-y-1">
                  {results.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {results.errors.length > 5 && (
                    <li>...and {results.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          onClick={processFiles}
          disabled={files.length === 0 || uploading}
          className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-5 border border-emerald-500/30">
        <h3 className="text-white font-semibold mb-3">Prefer automatic syncing?</h3>
        <p className="text-slate-400 text-sm mb-4">
          Connect your wearable device directly to automatically sync your health data without manual uploads.
        </p>
        <Link
          to="/devices"
          className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
        >
          Connect a device
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
