import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import OpenAI from "npm:openai@4.52.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface HealthMetrics {
  hrv: number | null;
  resting_heart_rate: number | null;
  deep_sleep_minutes: number | null;
  sleep_score: number | null;
  recovery_score: number | null;
  steps: number | null;
  date: string;
}

interface ComponentScores {
  hrvScore: number;
  sleepScore: number;
  recoveryScore: number;
  activityScore: number;
}

interface AIWeights {
  hrvWeight: number;
  sleepWeight: number;
  recoveryWeight: number;
  activityWeight: number;
  reasoning: string;
}

interface UserBaseline {
  metric_type: string;
  mean_value: number;
  std_deviation: number;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

function normalizeHRV(hrv: number, age: number): number {
  const ageRanges: Record<string, { low: number; high: number }> = {
    '20-29': { low: 35, high: 75 },
    '30-39': { low: 30, high: 65 },
    '40-49': { low: 25, high: 55 },
    '50-59': { low: 20, high: 45 },
    '60-69': { low: 15, high: 35 },
    '70+': { low: 10, high: 30 },
  };

  let range = ageRanges['40-49'];
  if (age < 30) range = ageRanges['20-29'];
  else if (age < 40) range = ageRanges['30-39'];
  else if (age < 50) range = ageRanges['40-49'];
  else if (age < 60) range = ageRanges['50-59'];
  else if (age < 70) range = ageRanges['60-69'];
  else range = ageRanges['70+'];

  if (hrv <= range.low) return Math.max(0, (hrv / range.low) * 40);
  if (hrv >= range.high) return Math.min(100, 70 + ((hrv - range.high) / (range.high * 0.5)) * 30);
  return 40 + ((hrv - range.low) / (range.high - range.low)) * 30;
}

function normalizeDeepSleep(minutes: number, age: number): number {
  const targets: Record<string, number> = {
    '20-39': 100,
    '40-59': 85,
    '60+': 70,
  };

  let target = targets['40-59'];
  if (age < 40) target = targets['20-39'];
  else if (age >= 60) target = targets['60+'];

  if (minutes >= target) return Math.min(100, 70 + ((minutes - target) / (target * 0.5)) * 30);
  if (minutes >= target * 0.6) return 40 + ((minutes - target * 0.6) / (target * 0.4)) * 30;
  return Math.max(0, (minutes / (target * 0.6)) * 40);
}

function normalizeRecovery(score: number | null): number {
  if (score === null) return 50;
  return Math.min(100, Math.max(0, score));
}

function normalizeActivity(steps: number | null, restingHr: number | null): number {
  let activityScore = 50;
  
  if (steps !== null) {
    if (steps >= 10000) activityScore = 85 + Math.min(15, (steps - 10000) / 1000);
    else if (steps >= 7500) activityScore = 70 + ((steps - 7500) / 2500) * 15;
    else if (steps >= 5000) activityScore = 50 + ((steps - 5000) / 2500) * 20;
    else activityScore = (steps / 5000) * 50;
  }

  if (restingHr !== null) {
    let hrBonus = 0;
    if (restingHr < 60) hrBonus = 10;
    else if (restingHr < 70) hrBonus = 5;
    else if (restingHr > 80) hrBonus = -10;
    else if (restingHr > 90) hrBonus = -20;
    activityScore = Math.min(100, Math.max(0, activityScore + hrBonus));
  }

  return activityScore;
}

function calculateComponentScores(metrics: HealthMetrics, age: number): ComponentScores {
  return {
    hrvScore: metrics.hrv !== null ? normalizeHRV(metrics.hrv, age) : 50,
    sleepScore: metrics.deep_sleep_minutes !== null 
      ? normalizeDeepSleep(metrics.deep_sleep_minutes, age)
      : (metrics.sleep_score !== null ? metrics.sleep_score : 50),
    recoveryScore: normalizeRecovery(metrics.recovery_score),
    activityScore: normalizeActivity(metrics.steps, metrics.resting_heart_rate),
  };
}

async function getAIWeights(
  openai: OpenAI,
  metrics: HealthMetrics[],
  age: number,
  conditions: string[]
): Promise<AIWeights> {
  const hasHrvData = metrics.filter(m => m.hrv !== null).length >= 3;
  const hasSleepData = metrics.filter(m => m.deep_sleep_minutes !== null || m.sleep_score !== null).length >= 3;
  const hasRecoveryData = metrics.filter(m => m.recovery_score !== null).length >= 3;
  const hasActivityData = metrics.filter(m => m.steps !== null).length >= 3;

  const hrvTrend = hasHrvData 
    ? metrics.filter(m => m.hrv !== null).slice(-7).map(m => m.hrv).join(', ')
    : 'insufficient data';
  const sleepTrend = hasSleepData
    ? metrics.filter(m => m.deep_sleep_minutes !== null).slice(-7).map(m => m.deep_sleep_minutes).join(', ')
    : 'insufficient data';

  const prompt = `You are a health analytics AI. Determine optimal weighting for a health score based on this user's data quality and health profile.

User Profile:
- Age: ${age}
- Conditions: ${conditions.length > 0 ? conditions.join(', ') : 'None reported'}

Data Availability:
- HRV data: ${hasHrvData ? 'Available' : 'Limited'} (recent values: ${hrvTrend})
- Sleep data: ${hasSleepData ? 'Available' : 'Limited'} (recent deep sleep mins: ${sleepTrend})
- Recovery data: ${hasRecoveryData ? 'Available' : 'Limited'}
- Activity data: ${hasActivityData ? 'Available' : 'Limited'}

Provide weights (must sum to 1.0) in this exact JSON format:
{"hrvWeight": 0.XX, "sleepWeight": 0.XX, "recoveryWeight": 0.XX, "activityWeight": 0.XX, "reasoning": "brief explanation"}

Considerations:
- Weight metrics higher if user has more reliable data for them
- For users with heart conditions, weight HRV and recovery higher
- For users with diabetes, weight activity and recovery higher
- For older users (60+), weight sleep and HRV higher
- If data is limited for a metric, weight it lower`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a clinical health analytics AI. Respond only with valid JSON." },
        { role: "user", content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.3,
    });

    const content = completion.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const weights = JSON.parse(jsonMatch[0]);
      const total = weights.hrvWeight + weights.sleepWeight + weights.recoveryWeight + weights.activityWeight;
      return {
        hrvWeight: weights.hrvWeight / total,
        sleepWeight: weights.sleepWeight / total,
        recoveryWeight: weights.recoveryWeight / total,
        activityWeight: weights.activityWeight / total,
        reasoning: weights.reasoning || 'AI-determined weights based on data quality and health profile',
      };
    }
  } catch (error) {
    console.error('AI weighting failed:', error);
  }

  return {
    hrvWeight: 0.30,
    sleepWeight: 0.30,
    recoveryWeight: 0.20,
    activityWeight: 0.20,
    reasoning: 'Default balanced weights (AI unavailable)',
  };
}

function checkForAnomalies(
  metrics: HealthMetrics,
  baselines: UserBaseline[]
): Array<{ metricType: string; value: number; baseline: number; deviation: number; severity: 'warning' | 'critical' }> {
  const anomalies: Array<{ metricType: string; value: number; baseline: number; deviation: number; severity: 'warning' | 'critical' }> = [];

  for (const baseline of baselines) {
    let currentValue: number | null = null;
    
    switch (baseline.metric_type) {
      case 'hrv':
        currentValue = metrics.hrv;
        break;
      case 'deep_sleep':
        currentValue = metrics.deep_sleep_minutes;
        break;
      case 'resting_hr':
        currentValue = metrics.resting_heart_rate;
        break;
      case 'steps':
        currentValue = metrics.steps;
        break;
      case 'recovery':
        currentValue = metrics.recovery_score;
        break;
    }

    if (currentValue === null || baseline.std_deviation === 0) continue;

    const deviation = (currentValue - baseline.mean_value) / baseline.std_deviation;
    
    if (Math.abs(deviation) >= 1.5) {
      const isNegativeAnomaly = (
        (baseline.metric_type === 'hrv' && deviation < 0) ||
        (baseline.metric_type === 'deep_sleep' && deviation < 0) ||
        (baseline.metric_type === 'recovery' && deviation < 0) ||
        (baseline.metric_type === 'steps' && deviation < 0) ||
        (baseline.metric_type === 'resting_hr' && deviation > 0)
      );

      if (isNegativeAnomaly || Math.abs(deviation) >= 2) {
        anomalies.push({
          metricType: baseline.metric_type,
          value: currentValue,
          baseline: baseline.mean_value,
          deviation: deviation,
          severity: Math.abs(deviation) >= 2.5 ? 'critical' : 'warning',
        });
      }
    }
  }

  return anomalies;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { date } = body;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('age, sex, has_heart_failure, has_diabetes, has_chronic_kidney_disease')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.age) {
      return new Response(
        JSON.stringify({ error: 'User profile with age required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dateRangeStart = thirtyDaysAgo.toISOString().split('T')[0];
    console.log(`Querying health_metrics for user ${user.id} from ${dateRangeStart}`);

    const { data: recentMetrics, error: metricsError } = await supabase
      .from('health_metrics')
      .select('hrv, resting_heart_rate, deep_sleep_minutes, sleep_score, recovery_score, steps, date')
      .eq('user_id', user.id)
      .gte('date', dateRangeStart)
      .order('date', { ascending: true });

    console.log(`Found ${recentMetrics?.length || 0} health metrics`);
    if (recentMetrics && recentMetrics.length > 0) {
      console.log('Date range of available metrics:', recentMetrics[0].date, 'to', recentMetrics[recentMetrics.length - 1].date);
    }

    if (metricsError) {
      console.error('Database error fetching metrics:', metricsError);
    }

    if (!recentMetrics || recentMetrics.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No health metrics found in the last 30 days',
          dateRangeChecked: `${dateRangeStart} to ${new Date().toISOString().split('T')[0]}`,
          suggestion: 'Upload health metrics data first'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const todayMetrics = recentMetrics.find(m => m.date === targetDate) || recentMetrics[recentMetrics.length - 1];

    const conditions: string[] = [];
    if (profile.has_heart_failure) conditions.push('heart failure');
    if (profile.has_diabetes) conditions.push('diabetes');
    if (profile.has_chronic_kidney_disease) conditions.push('chronic kidney disease');

    const componentScores = calculateComponentScores(todayMetrics, profile.age);

    let weights: AIWeights;
    if (openaiApiKey) {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      weights = await getAIWeights(openai, recentMetrics, profile.age, conditions);
    } else {
      weights = {
        hrvWeight: 0.30,
        sleepWeight: 0.30,
        recoveryWeight: 0.20,
        activityWeight: 0.20,
        reasoning: 'Default weights (AI not configured)',
      };
    }

    const overallScore = Math.round(
      componentScores.hrvScore * weights.hrvWeight +
      componentScores.sleepScore * weights.sleepWeight +
      componentScores.recoveryScore * weights.recoveryWeight +
      componentScores.activityScore * weights.activityWeight
    );

    const { data: baselines } = await supabase
      .from('user_baselines')
      .select('metric_type, mean_value, std_deviation')
      .eq('user_id', user.id);

    const anomalies = baselines ? checkForAnomalies(todayMetrics, baselines) : [];

    for (const anomaly of anomalies) {
      await supabase.from('anomaly_alerts').insert({
        user_id: user.id,
        metric_type: anomaly.metricType,
        detected_value: anomaly.value,
        baseline_value: anomaly.baseline,
        deviation_amount: anomaly.deviation,
        severity: anomaly.severity,
        detected_at: new Date().toISOString(),
      });
    }

    await supabase.from('health_scores').upsert({
      user_id: user.id,
      date: targetDate,
      overall_score: overallScore,
      hrv_score: Math.round(componentScores.hrvScore),
      sleep_score: Math.round(componentScores.sleepScore),
      recovery_score: Math.round(componentScores.recoveryScore),
      activity_score: Math.round(componentScores.activityScore),
      hrv_weight: weights.hrvWeight,
      sleep_weight: weights.sleepWeight,
      recovery_weight: weights.recoveryWeight,
      activity_weight: weights.activityWeight,
      ai_reasoning: weights.reasoning,
    }, { onConflict: 'user_id,date' });

    return new Response(
      JSON.stringify({
        date: targetDate,
        overallScore,
        components: {
          hrv: { score: Math.round(componentScores.hrvScore), weight: weights.hrvWeight },
          sleep: { score: Math.round(componentScores.sleepScore), weight: weights.sleepWeight },
          recovery: { score: Math.round(componentScores.recoveryScore), weight: weights.recoveryWeight },
          activity: { score: Math.round(componentScores.activityScore), weight: weights.activityWeight },
        },
        aiReasoning: weights.reasoning,
        anomalies: anomalies.map(a => ({
          metric: a.metricType,
          value: a.value,
          baseline: a.baseline,
          severity: a.severity,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Health score calculation error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});