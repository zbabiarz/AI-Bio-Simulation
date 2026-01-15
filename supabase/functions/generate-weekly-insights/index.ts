import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import OpenAI from "npm:openai@4.52.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

interface HealthMetric {
  date: string;
  hrv: number | null;
  deep_sleep_minutes: number | null;
  sleep_score: number | null;
  recovery_score: number | null;
  steps: number | null;
  resting_heart_rate: number | null;
}

interface HealthScore {
  date: string;
  overall_score: number;
  hrv_score: number;
  sleep_score: number;
  recovery_score: number;
  activity_score: number;
}

interface WeeklyStats {
  avgHrv: number | null;
  avgDeepSleep: number | null;
  avgRecovery: number | null;
  avgSteps: number | null;
  avgHealthScore: number | null;
  hrvTrend: 'improving' | 'declining' | 'stable';
  sleepTrend: 'improving' | 'declining' | 'stable';
  bestDay: string | null;
  worstDay: string | null;
}

function calculateWeeklyStats(metrics: HealthMetric[], scores: HealthScore[]): WeeklyStats {
  const validHrv = metrics.filter(m => m.hrv !== null).map(m => m.hrv!);
  const validSleep = metrics.filter(m => m.deep_sleep_minutes !== null).map(m => m.deep_sleep_minutes!);
  const validRecovery = metrics.filter(m => m.recovery_score !== null).map(m => m.recovery_score!);
  const validSteps = metrics.filter(m => m.steps !== null).map(m => m.steps!);
  const validScores = scores.map(s => s.overall_score);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const calculateTrend = (values: number[]): 'improving' | 'declining' | 'stable' => {
    if (values.length < 3) return 'stable';
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = avg(firstHalf)!;
    const secondAvg = avg(secondHalf)!;
    const diff = ((secondAvg - firstAvg) / firstAvg) * 100;
    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
  };

  let bestDay: string | null = null;
  let worstDay: string | null = null;
  if (scores.length > 0) {
    const sorted = [...scores].sort((a, b) => b.overall_score - a.overall_score);
    bestDay = sorted[0].date;
    worstDay = sorted[sorted.length - 1].date;
  }

  return {
    avgHrv: avg(validHrv),
    avgDeepSleep: avg(validSleep),
    avgRecovery: avg(validRecovery),
    avgSteps: avg(validSteps),
    avgHealthScore: avg(validScores),
    hrvTrend: calculateTrend(validHrv),
    sleepTrend: calculateTrend(validSleep),
    bestDay,
    worstDay,
  };
}

async function generateInsightsWithAI(
  openai: OpenAI,
  stats: WeeklyStats,
  previousStats: WeeklyStats | null,
  age: number,
  conditions: string[]
): Promise<Array<{ text: string; type: 'observation' | 'recommendation' | 'celebration'; sources: string[]; whyItMatters: string }>> {
  const prompt = `You are a clinical health AI generating personalized weekly insights for a user.

User Profile:
- Age: ${age}
- Medical Conditions: ${conditions.length > 0 ? conditions.join(', ') : 'None'}

This Week's Data:
- Average HRV: ${stats.avgHrv?.toFixed(0) || 'No data'}ms
- Average Deep Sleep: ${stats.avgDeepSleep?.toFixed(0) || 'No data'} minutes
- Average Recovery: ${stats.avgRecovery?.toFixed(0) || 'No data'}%
- Average Steps: ${stats.avgSteps?.toFixed(0) || 'No data'}
- Average Health Score: ${stats.avgHealthScore?.toFixed(0) || 'No data'}/100
- HRV Trend: ${stats.hrvTrend}
- Sleep Trend: ${stats.sleepTrend}
- Best Day: ${stats.bestDay || 'N/A'}
- Worst Day: ${stats.worstDay || 'N/A'}

${previousStats ? `
Last Week Comparison:
- HRV Change: ${stats.avgHrv && previousStats.avgHrv ? ((stats.avgHrv - previousStats.avgHrv) / previousStats.avgHrv * 100).toFixed(1) : 'N/A'}%
- Sleep Change: ${stats.avgDeepSleep && previousStats.avgDeepSleep ? ((stats.avgDeepSleep - previousStats.avgDeepSleep) / previousStats.avgDeepSleep * 100).toFixed(1) : 'N/A'}%
- Health Score Change: ${stats.avgHealthScore && previousStats.avgHealthScore ? ((stats.avgHealthScore - previousStats.avgHealthScore) / previousStats.avgHealthScore * 100).toFixed(1) : 'N/A'}%` : ''}

Generate exactly 4 insights in this JSON array format:
[
  {"text": "insight text", "type": "observation|recommendation|celebration", "sources": ["metric1", "metric2"], "whyItMatters": "brief clinical explanation"}
]

Rules:
1. Include at least one celebration if any metric improved
2. Include at least one actionable recommendation
3. Be specific with numbers from their data
4. Keep insights under 100 characters each
5. Why it matters should be clinical but accessible (under 150 chars)
6. Types: observation (neutral finding), recommendation (action to take), celebration (positive achievement)`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a clinical health analyst. Respond only with a valid JSON array." },
        { role: "user", content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[([\s\S]*?)\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('AI insight generation failed:', error);
  }

  return [
    {
      text: stats.avgHealthScore && stats.avgHealthScore >= 70 
        ? `Your health score averaged ${stats.avgHealthScore.toFixed(0)} this week - solid performance!`
        : `Your health score averaged ${stats.avgHealthScore?.toFixed(0) || 'N/A'} this week`,
      type: (stats.avgHealthScore && stats.avgHealthScore >= 70 ? 'celebration' : 'observation') as 'observation' | 'recommendation' | 'celebration',
      sources: ['health_score'],
      whyItMatters: 'Your health score reflects overall physiological wellness based on multiple biomarkers.',
    },
    {
      text: 'Consider tracking your sleep consistency for better insights',
      type: 'recommendation' as const,
      sources: ['sleep'],
      whyItMatters: 'Consistent sleep timing helps regulate circadian rhythm and improves recovery.',
    },
  ];
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

    const { data: existingInsights } = await supabase
      .from('ai_insights')
      .select('generated_at')
      .eq('user_id', user.id)
      .eq('is_weekly', false)
      .gte('generated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh === true;

    if (existingInsights && existingInsights.length > 0 && !forceRefresh) {
      return new Response(
        JSON.stringify({ error: 'On-demand insights limited to once per day', rateLimited: true }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('age, has_heart_failure, has_diabetes, has_chronic_kidney_disease')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || !profile.age) {
      return new Response(
        JSON.stringify({ error: 'User profile required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [thisWeekMetrics, lastWeekMetrics, thisWeekScores, lastWeekScores] = await Promise.all([
      supabase
        .from('health_metrics')
        .select('date, hrv, deep_sleep_minutes, sleep_score, recovery_score, steps, resting_heart_rate')
        .eq('user_id', user.id)
        .gte('date', oneWeekAgo.toISOString().split('T')[0])
        .order('date', { ascending: true }),
      supabase
        .from('health_metrics')
        .select('date, hrv, deep_sleep_minutes, sleep_score, recovery_score, steps, resting_heart_rate')
        .eq('user_id', user.id)
        .gte('date', twoWeeksAgo.toISOString().split('T')[0])
        .lt('date', oneWeekAgo.toISOString().split('T')[0])
        .order('date', { ascending: true }),
      supabase
        .from('health_scores')
        .select('date, overall_score, hrv_score, sleep_score, recovery_score, activity_score')
        .eq('user_id', user.id)
        .gte('date', oneWeekAgo.toISOString().split('T')[0]),
      supabase
        .from('health_scores')
        .select('date, overall_score, hrv_score, sleep_score, recovery_score, activity_score')
        .eq('user_id', user.id)
        .gte('date', twoWeeksAgo.toISOString().split('T')[0])
        .lt('date', oneWeekAgo.toISOString().split('T')[0]),
    ]);

    if (!thisWeekMetrics.data || thisWeekMetrics.data.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No metrics data available for this week' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const thisWeekStats = calculateWeeklyStats(thisWeekMetrics.data, thisWeekScores.data || []);
    const lastWeekStats = lastWeekMetrics.data && lastWeekMetrics.data.length > 0
      ? calculateWeeklyStats(lastWeekMetrics.data, lastWeekScores.data || [])
      : null;

    const conditions: string[] = [];
    if (profile.has_heart_failure) conditions.push('heart failure');
    if (profile.has_diabetes) conditions.push('diabetes');
    if (profile.has_chronic_kidney_disease) conditions.push('chronic kidney disease');

    let insights: Array<{ text: string; type: 'observation' | 'recommendation' | 'celebration'; sources: string[]; whyItMatters: string }>;

    if (openaiApiKey) {
      const openai = new OpenAI({ apiKey: openaiApiKey });
      insights = await generateInsightsWithAI(openai, thisWeekStats, lastWeekStats, profile.age, conditions);
    } else {
      insights = [
        {
          text: `Your average health score this week: ${thisWeekStats.avgHealthScore?.toFixed(0) || 'N/A'}`,
          type: 'observation',
          sources: ['health_score'],
          whyItMatters: 'Health score reflects overall physiological wellness.',
        },
      ];
    }

    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const insight of insights) {
      await supabase.from('ai_insights').insert({
        user_id: user.id,
        insight_text: insight.text,
        insight_type: insight.type,
        source_metrics: insight.sources,
        why_it_matters: insight.whyItMatters,
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_weekly: false,
      });
    }

    return new Response(
      JSON.stringify({
        insights: insights.map(i => ({
          text: i.text,
          type: i.type,
          sources: i.sources,
          whyItMatters: i.whyItMatters,
        })),
        weeklyStats: thisWeekStats,
        generatedAt: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Weekly insights error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});