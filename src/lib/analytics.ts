import { supabase } from './supabase';

export interface HealthScore {
  date: string;
  overallScore: number;
  components: {
    hrv: { score: number; weight: number };
    sleep: { score: number; weight: number };
    recovery: { score: number; weight: number };
    activity: { score: number; weight: number };
  };
  aiReasoning: string;
}

export interface PersonalRecord {
  id: string;
  metricType: string;
  recordValue: number;
  previousRecord: number | null;
  achievedDate: string;
  recordScope: 'all_time' | 'monthly';
}

export interface AnomalyAlert {
  id: string;
  metricType: string;
  detectedValue: number;
  baselineValue: number;
  deviationAmount: number;
  severity: 'warning' | 'critical';
  insight: string | null;
  seen: boolean;
  detectedAt: string;
}

export interface AIInsight {
  id: string;
  text: string;
  type: 'observation' | 'recommendation' | 'celebration';
  sources: string[];
  whyItMatters: string;
  generatedAt: string;
  expiresAt: string;
}

export interface WeeklyAnalytics {
  weekStart: string;
  weekEnd: string;
  avgHrv: number | null;
  avgDeepSleep: number | null;
  avgSleepScore: number | null;
  avgRecovery: number | null;
  avgSteps: number | null;
  avgRestingHr: number | null;
  avgHealthScore: number | null;
  hrvChangePct: number | null;
  sleepChangePct: number | null;
  recoveryChangePct: number | null;
  stepsChangePct: number | null;
  healthScoreChangePct: number | null;
}

export async function calculateHealthScore(date?: string): Promise<HealthScore | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calculate-health-score`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ date }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to calculate health score');
  }

  return response.json();
}

export async function fetchHealthScores(days: number = 30): Promise<HealthScore[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('health_scores')
    .select('*')
    .eq('user_id', sessionData.session.user.id)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    date: row.date,
    overallScore: row.overall_score,
    components: {
      hrv: { score: row.hrv_score, weight: row.hrv_weight },
      sleep: { score: row.sleep_score, weight: row.sleep_weight },
      recovery: { score: row.recovery_score, weight: row.recovery_weight },
      activity: { score: row.activity_score, weight: row.activity_weight },
    },
    aiReasoning: row.ai_reasoning || '',
  }));
}

export async function fetchPersonalRecords(): Promise<PersonalRecord[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return [];

  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', sessionData.session.user.id)
    .order('achieved_date', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    metricType: row.metric_type,
    recordValue: row.record_value,
    previousRecord: row.previous_record,
    achievedDate: row.achieved_date,
    recordScope: row.record_scope,
  }));
}

export async function fetchUnseenAlerts(): Promise<AnomalyAlert[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return [];

  const { data, error } = await supabase
    .from('anomaly_alerts')
    .select('*')
    .eq('user_id', sessionData.session.user.id)
    .eq('seen', false)
    .order('detected_at', { ascending: false })
    .limit(5);

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    metricType: row.metric_type,
    detectedValue: row.detected_value,
    baselineValue: row.baseline_value,
    deviationAmount: row.deviation_amount,
    severity: row.severity,
    insight: row.insight,
    seen: row.seen,
    detectedAt: row.detected_at,
  }));
}

export async function markAlertAsSeen(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('anomaly_alerts')
    .update({ seen: true })
    .eq('id', alertId);

  if (error) throw error;
}

export async function markAllAlertsAsSeen(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return;

  const { error } = await supabase
    .from('anomaly_alerts')
    .update({ seen: true })
    .eq('user_id', sessionData.session.user.id)
    .eq('seen', false);

  if (error) throw error;
}

export async function fetchActiveInsights(): Promise<AIInsight[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return [];

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', sessionData.session.user.id)
    .gte('expires_at', now)
    .order('generated_at', { ascending: false })
    .limit(10);

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    text: row.insight_text,
    type: row.insight_type,
    sources: row.source_metrics || [],
    whyItMatters: row.why_it_matters || '',
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
  }));
}

export async function generateNewInsights(): Promise<AIInsight[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-weekly-insights`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.rateLimited) {
      throw new Error('RATE_LIMITED');
    }
    throw new Error(errorData.error || 'Failed to generate insights');
  }

  const result = await response.json();
  return result.insights.map((i: any, idx: number) => ({
    id: `new-${idx}`,
    text: i.text,
    type: i.type,
    sources: i.sources,
    whyItMatters: i.whyItMatters,
    generatedAt: result.generatedAt,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

export async function fetchWeeklyAnalytics(weeksBack: number = 4): Promise<WeeklyAnalytics[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - weeksBack * 7);

  const { data, error } = await supabase
    .from('weekly_analytics')
    .select('*')
    .eq('user_id', sessionData.session.user.id)
    .gte('week_start', startDate.toISOString().split('T')[0])
    .order('week_start', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    weekStart: row.week_start,
    weekEnd: row.week_end,
    avgHrv: row.avg_hrv,
    avgDeepSleep: row.avg_deep_sleep,
    avgSleepScore: row.avg_sleep_score,
    avgRecovery: row.avg_recovery,
    avgSteps: row.avg_steps,
    avgRestingHr: row.avg_resting_hr,
    avgHealthScore: row.avg_health_score,
    hrvChangePct: row.hrv_change_pct,
    sleepChangePct: row.sleep_change_pct,
    recoveryChangePct: row.recovery_change_pct,
    stepsChangePct: row.steps_change_pct,
    healthScoreChangePct: row.health_score_change_pct,
  }));
}

export async function calculateAndSaveBaselines(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return;

  const userId = sessionData.session.user.id;
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: metrics } = await supabase
    .from('health_metrics')
    .select('hrv, deep_sleep_minutes, resting_heart_rate, steps, recovery_score')
    .eq('user_id', userId)
    .gte('date', fourteenDaysAgo.toISOString().split('T')[0]);

  if (!metrics || metrics.length < 7) return;

  const calculateStats = (values: number[]) => {
    if (values.length === 0) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
    return { mean, stdDev, count: values.length };
  };

  const metricTypes = [
    { type: 'hrv', extractor: (m: any) => m.hrv },
    { type: 'deep_sleep', extractor: (m: any) => m.deep_sleep_minutes },
    { type: 'resting_hr', extractor: (m: any) => m.resting_heart_rate },
    { type: 'steps', extractor: (m: any) => m.steps },
    { type: 'recovery', extractor: (m: any) => m.recovery_score },
  ];

  for (const { type, extractor } of metricTypes) {
    const values = metrics.map(extractor).filter((v: any) => v !== null) as number[];
    const stats = calculateStats(values);

    if (stats && stats.count >= 5) {
      await supabase.from('user_baselines').upsert(
        {
          user_id: userId,
          metric_type: type,
          mean_value: stats.mean,
          std_deviation: stats.stdDev,
          sample_count: stats.count,
          calculated_at: new Date().toISOString(),
          next_recalc_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: 'user_id,metric_type' }
      );
    }
  }
}

export async function checkAndUpdateRecords(metrics: {
  date: string;
  hrv?: number | null;
  deepSleepMinutes?: number | null;
  sleepEfficiency?: number | null;
  recoveryScore?: number | null;
  steps?: number | null;
  restingHr?: number | null;
}): Promise<PersonalRecord[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) return [];

  const userId = sessionData.session.user.id;
  const newRecords: PersonalRecord[] = [];

  const recordChecks = [
    { type: 'highest_hrv', value: metrics.hrv, higher: true },
    { type: 'best_deep_sleep', value: metrics.deepSleepMinutes, higher: true },
    { type: 'best_sleep_efficiency', value: metrics.sleepEfficiency, higher: true },
    { type: 'best_recovery', value: metrics.recoveryScore, higher: true },
    { type: 'highest_steps', value: metrics.steps, higher: true },
    { type: 'lowest_resting_hr', value: metrics.restingHr, higher: false },
  ];

  for (const check of recordChecks) {
    if (check.value === null || check.value === undefined) continue;

    const { data: existing } = await supabase
      .from('personal_records')
      .select('*')
      .eq('user_id', userId)
      .eq('metric_type', check.type)
      .eq('record_scope', 'all_time')
      .maybeSingle();

    const isNewRecord = !existing || (check.higher
      ? check.value > existing.record_value
      : check.value < existing.record_value);

    if (isNewRecord) {
      const { data: inserted } = await supabase
        .from('personal_records')
        .upsert(
          {
            user_id: userId,
            metric_type: check.type,
            record_value: check.value,
            previous_record: existing?.record_value || null,
            achieved_date: metrics.date,
            record_scope: 'all_time',
          },
          { onConflict: 'user_id,metric_type,record_scope' }
        )
        .select()
        .single();

      if (inserted) {
        newRecords.push({
          id: inserted.id,
          metricType: inserted.metric_type,
          recordValue: inserted.record_value,
          previousRecord: inserted.previous_record,
          achievedDate: inserted.achieved_date,
          recordScope: inserted.record_scope,
        });
      }
    }
  }

  return newRecords;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 70) return '#84cc16';
  if (score >= 60) return '#eab308';
  if (score >= 50) return '#f97316';
  if (score >= 40) return '#ef4444';
  return '#dc2626';
}

export function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  if (score >= 40) return 'Needs Attention';
  return 'Poor';
}

export function formatMetricName(metricType: string): string {
  const names: Record<string, string> = {
    highest_hrv: 'Highest HRV',
    best_deep_sleep: 'Best Deep Sleep',
    best_sleep_efficiency: 'Best Sleep Efficiency',
    best_recovery: 'Best Recovery',
    highest_steps: 'Most Steps',
    lowest_resting_hr: 'Lowest Resting HR',
    hrv: 'HRV',
    deep_sleep: 'Deep Sleep',
    resting_hr: 'Resting HR',
    steps: 'Steps',
    recovery: 'Recovery',
  };
  return names[metricType] || metricType;
}

export function formatMetricValue(metricType: string, value: number): string {
  if (metricType.includes('hrv')) return `${value.toFixed(0)}ms`;
  if (metricType.includes('sleep') && !metricType.includes('efficiency')) return `${value.toFixed(0)}min`;
  if (metricType.includes('efficiency') || metricType.includes('recovery')) return `${value.toFixed(0)}%`;
  if (metricType.includes('steps')) return value.toLocaleString();
  if (metricType.includes('hr')) return `${value.toFixed(0)}bpm`;
  return value.toFixed(1);
}
