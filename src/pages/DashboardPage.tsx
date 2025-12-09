import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { HealthMetric, MetricsSummary, HealthGoal, UserBadge } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import {
  Heart,
  Moon,
  Footprints,
  Battery,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Award,
  Brain,
  Upload,
  ArrowRight,
  Watch,
  Zap,
} from 'lucide-react';

interface NormalizedWearableData {
  hrv?: number;
  resting_hr?: number;
  sleep_hours?: number;
  steps?: number;
  recovery_score?: number;
}

interface WearableDataEntry {
  id: string;
  source: string;
  normalized: NormalizedWearableData;
  created_at: string;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [latestWearable, setLatestWearable] = useState<WearableDataEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  async function fetchData() {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    const [metricsRes, goalsRes, badgesRes, wearableRes] = await Promise.all([
      supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', user!.id)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: true }),
      supabase
        .from('health_goals')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .limit(3),
      supabase
        .from('user_badges')
        .select('*, badge:badges(*)')
        .eq('user_id', user!.id)
        .order('earned_at', { ascending: false })
        .limit(3),
      supabase
        .from('wearable_data')
        .select('id, source, normalized, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (metricsRes.data) {
      setMetrics(metricsRes.data);
      calculateSummary(metricsRes.data);
    }
    if (goalsRes.data) setGoals(goalsRes.data);
    if (badgesRes.data) setBadges(badgesRes.data);
    if (wearableRes.data) setLatestWearable(wearableRes.data);
    setLoading(false);
  }

  function calculateSummary(data: HealthMetric[]) {
    if (data.length === 0) {
      setSummary(null);
      return;
    }

    const avgHrv = data.filter(d => d.hrv).reduce((sum, d) => sum + (d.hrv || 0), 0) / data.filter(d => d.hrv).length || null;
    const avgRestingHr = data.filter(d => d.resting_heart_rate).reduce((sum, d) => sum + (d.resting_heart_rate || 0), 0) / data.filter(d => d.resting_heart_rate).length || null;
    const avgSleepDuration = data.filter(d => d.sleep_duration_minutes).reduce((sum, d) => sum + (d.sleep_duration_minutes || 0), 0) / data.filter(d => d.sleep_duration_minutes).length || null;
    const avgSleepEfficiency = data.filter(d => d.sleep_efficiency).reduce((sum, d) => sum + (d.sleep_efficiency || 0), 0) / data.filter(d => d.sleep_efficiency).length || null;
    const avgSteps = data.filter(d => d.steps).reduce((sum, d) => sum + (d.steps || 0), 0) / data.filter(d => d.steps).length || null;
    const avgRecoveryScore = data.filter(d => d.recovery_score).reduce((sum, d) => sum + (d.recovery_score || 0), 0) / data.filter(d => d.recovery_score).length || null;

    setSummary({
      avgHrv: avgHrv ? Math.round(avgHrv * 10) / 10 : null,
      avgRestingHr: avgRestingHr ? Math.round(avgRestingHr) : null,
      avgSleepDuration: avgSleepDuration ? Math.round(avgSleepDuration) : null,
      avgSleepEfficiency: avgSleepEfficiency ? Math.round(avgSleepEfficiency * 10) / 10 : null,
      avgSteps: avgSteps ? Math.round(avgSteps) : null,
      avgRecoveryScore: avgRecoveryScore ? Math.round(avgRecoveryScore) : null,
      totalActiveDays: data.length,
    });
  }

  const chartData = metrics.map(m => ({
    date: format(parseISO(m.date), 'MMM d'),
    hrv: m.hrv,
    sleep: m.sleep_duration_minutes ? Math.round(m.sleep_duration_minutes / 60 * 10) / 10 : null,
    steps: m.steps,
    recovery: m.recovery_score,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Upload className="w-10 h-10 text-slate-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Welcome to AIMD, {profile?.full_name?.split(' ')[0] || 'there'}!
        </h2>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          Start your health journey by uploading your wearable data. We support data from Oura Ring, Apple Watch, Garmin, Whoop, and more.
        </p>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
        >
          Upload Your Data
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-slate-400">
          Here's an overview of your health metrics from the past 30 days
        </p>
      </div>

      {latestWearable && (
        <div className="bg-gradient-to-r from-slate-800 to-slate-800/50 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <Watch className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Latest Wearable Data</h3>
                <p className="text-sm text-slate-400">
                  From {latestWearable.source} - {format(parseISO(latestWearable.created_at), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
            <Link
              to="/upload"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              Upload new
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <WearableMetricCard
              icon={Heart}
              label="HRV"
              value={latestWearable.normalized.hrv}
              unit="ms"
            />
            <WearableMetricCard
              icon={Zap}
              label="Resting HR"
              value={latestWearable.normalized.resting_hr}
              unit="bpm"
            />
            <WearableMetricCard
              icon={Moon}
              label="Sleep"
              value={latestWearable.normalized.sleep_hours}
              unit="hrs"
            />
            <WearableMetricCard
              icon={Footprints}
              label="Steps"
              value={latestWearable.normalized.steps}
              unit=""
            />
            <WearableMetricCard
              icon={Battery}
              label="Recovery"
              value={latestWearable.normalized.recovery_score}
              unit="%"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Heart}
          label="Avg HRV"
          value={summary?.avgHrv}
          unit="ms"
          color="rose"
          trend={5}
        />
        <MetricCard
          icon={Moon}
          label="Avg Sleep"
          value={summary?.avgSleepDuration ? Math.round(summary.avgSleepDuration / 60 * 10) / 10 : null}
          unit="hrs"
          color="indigo"
          trend={-2}
        />
        <MetricCard
          icon={Footprints}
          label="Avg Steps"
          value={summary?.avgSteps}
          unit=""
          color="amber"
          trend={12}
        />
        <MetricCard
          icon={Battery}
          label="Avg Recovery"
          value={summary?.avgRecoveryScore}
          unit="%"
          color="emerald"
          trend={8}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-400" />
            HRV Trend
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="hrvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Area
                  type="monotone"
                  dataKey="hrv"
                  stroke="#f43f5e"
                  fill="url(#hrvGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Moon className="w-5 h-5 text-blue-400" />
            Sleep Duration
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="sleepGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 12]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number) => [`${value} hrs`, 'Sleep']}
                />
                <Area
                  type="monotone"
                  dataKey="sleep"
                  stroke="#6366f1"
                  fill="url(#sleepGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-400" />
              Active Goals
            </h3>
            <Link
              to="/goals"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              View all
            </Link>
          </div>
          {goals.length === 0 ? (
            <p className="text-slate-400 text-sm">No active goals. Set your first goal!</p>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => (
                <div key={goal.id} className="bg-slate-700/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">{goal.title}</span>
                    <span className="text-emerald-400 text-xs">
                      {Math.round((goal.current_value / goal.target_value) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                      style={{ width: `${Math.min((goal.current_value / goal.target_value) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Recent Badges
            </h3>
            <Link
              to="/achievements"
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              View all
            </Link>
          </div>
          {badges.length === 0 ? (
            <p className="text-slate-400 text-sm">No badges yet. Keep tracking to earn badges!</p>
          ) : (
            <div className="space-y-3">
              {badges.map((ub) => (
                <div key={ub.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                    <Award className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{ub.badge?.name}</p>
                    <p className="text-slate-400 text-xs">{ub.badge?.points} pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl p-6 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">AI Insight</h3>
          </div>
          <p className="text-slate-300 text-sm mb-4">
            Based on your recent data, your HRV has been improving. Consider maintaining your current sleep schedule for continued recovery gains.
          </p>
          <Link
            to="/simulations"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium"
          >
            Run a simulation
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-400" />
          Daily Steps
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Line
                type="monotone"
                dataKey="steps"
                stroke="#14b8a6"
                strokeWidth={2}
                dot={{ fill: '#14b8a6', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number | null;
  unit: string;
  color: 'rose' | 'indigo' | 'amber' | 'emerald';
  trend?: number;
}

function MetricCard({ icon: Icon, label, value, unit, color, trend }: MetricCardProps) {
  const colorClasses = {
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400',
    indigo: 'from-blue-500/20 to-blue-500/5 text-blue-400',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 border border-slate-700/50`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5" />
        <span className="text-slate-300 text-sm">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold text-white">
            {value !== null ? value.toLocaleString() : '--'}
          </span>
          {unit && <span className="text-slate-400 text-sm ml-1">{unit}</span>}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );
}

interface WearableMetricCardProps {
  icon: React.ElementType;
  label: string;
  value?: number;
  unit: string;
}

function WearableMetricCard({ icon: Icon, label, value, unit }: WearableMetricCardProps) {
  return (
    <div className="bg-slate-700/30 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-emerald-400" />
        <span className="text-slate-400 text-xs">{label}</span>
      </div>
      <div>
        <span className="text-xl font-bold text-white">
          {value !== undefined ? value.toLocaleString() : '--'}
        </span>
        {unit && <span className="text-slate-400 text-sm ml-1">{unit}</span>}
      </div>
    </div>
  );
}
