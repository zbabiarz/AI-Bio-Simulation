import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  calculateHealthScore,
  fetchHealthScores,
  fetchPersonalRecords,
  fetchUnseenAlerts,
  fetchActiveInsights,
  generateNewInsights,
  markAlertAsSeen,
  markAllAlertsAsSeen,
  calculateAndSaveBaselines,
  type HealthScore,
  type PersonalRecord,
  type AnomalyAlert,
  type AIInsight,
} from '../lib/analytics';
import {
  downloadCSV,
  generateComprehensiveExportCSV,
  getExportFilename,
  type ExportFormat,
} from '../lib/csvExport';
import HealthScoreGauge from '../components/HealthScoreGauge';
import PersonalRecordsCard from '../components/PersonalRecordsCard';
import WeeklyComparisonCard from '../components/WeeklyComparisonCard';
import AnomalyAlertBanner from '../components/AnomalyAlertBanner';
import AIInsightsCarousel from '../components/AIInsightsCarousel';
import {
  Activity,
  Download,
  RefreshCw,
  ChevronRight,
  FileText,
  BarChart3,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

type ExportModalState = 'closed' | 'selecting' | 'exporting';

export default function AnalyticsDashboardPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [calculatingScore, setCalculatingScore] = useState(false);
  const [currentScore, setCurrentScore] = useState<HealthScore | null>(null);
  const [previousScore, setPreviousScore] = useState<number | null>(null);
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsRateLimited, setInsightsRateLimited] = useState(false);
  const [thisWeekData, setThisWeekData] = useState<any>(null);
  const [lastWeekData, setLastWeekData] = useState<any>(null);
  const [exportModal, setExportModal] = useState<ExportModalState>('closed');
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('standard');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user && profile) {
      loadAnalyticsData();
    }
  }, [user, profile]);

  async function loadAnalyticsData() {
    if (!user) return;

    setLoading(true);

    try {
      await calculateAndSaveBaselines();

      const [scoresData, recordsData, alertsData, insightsData] = await Promise.all([
        fetchHealthScores(7),
        fetchPersonalRecords(),
        fetchUnseenAlerts(),
        fetchActiveInsights(),
      ]);

      setRecords(recordsData);
      setAlerts(alertsData);
      setInsights(insightsData);

      if (scoresData.length > 0) {
        setCurrentScore(scoresData[0]);
        if (scoresData.length > 1) {
          setPreviousScore(scoresData[1].overallScore);
        }
      }

      await loadWeeklyComparison();
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadWeeklyComparison() {
    if (!user) return;

    const now = new Date();
    const thisWeekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const thisWeekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const lastWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const lastWeekEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const [thisWeekMetrics, lastWeekMetrics, thisWeekScores, lastWeekScores] = await Promise.all([
      supabase
        .from('health_metrics')
        .select('hrv, deep_sleep_minutes, recovery_score, steps')
        .eq('user_id', user.id)
        .gte('date', thisWeekStart)
        .lte('date', thisWeekEnd),
      supabase
        .from('health_metrics')
        .select('hrv, deep_sleep_minutes, recovery_score, steps')
        .eq('user_id', user.id)
        .gte('date', lastWeekStart)
        .lte('date', lastWeekEnd),
      supabase
        .from('health_scores')
        .select('overall_score')
        .eq('user_id', user.id)
        .gte('date', thisWeekStart)
        .lte('date', thisWeekEnd),
      supabase
        .from('health_scores')
        .select('overall_score')
        .eq('user_id', user.id)
        .gte('date', lastWeekStart)
        .lte('date', lastWeekEnd),
    ]);

    const calculateAvg = (data: any[], field: string) => {
      const valid = data?.filter((d) => d[field] !== null) || [];
      if (valid.length === 0) return null;
      return valid.reduce((sum, d) => sum + d[field], 0) / valid.length;
    };

    setThisWeekData({
      avgHrv: calculateAvg(thisWeekMetrics.data, 'hrv'),
      avgDeepSleep: calculateAvg(thisWeekMetrics.data, 'deep_sleep_minutes'),
      avgRecovery: calculateAvg(thisWeekMetrics.data, 'recovery_score'),
      avgSteps: calculateAvg(thisWeekMetrics.data, 'steps'),
      avgHealthScore: calculateAvg(thisWeekScores.data, 'overall_score'),
    });

    setLastWeekData({
      avgHrv: calculateAvg(lastWeekMetrics.data, 'hrv'),
      avgDeepSleep: calculateAvg(lastWeekMetrics.data, 'deep_sleep_minutes'),
      avgRecovery: calculateAvg(lastWeekMetrics.data, 'recovery_score'),
      avgSteps: calculateAvg(lastWeekMetrics.data, 'steps'),
      avgHealthScore: calculateAvg(lastWeekScores.data, 'overall_score'),
    });
  }

  async function handleCalculateScore() {
    setCalculatingScore(true);
    try {
      const score = await calculateHealthScore();
      if (score) {
        setCurrentScore(score);
        setMessage({ type: 'success', text: 'Health score updated!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to calculate score' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setCalculatingScore(false);
    }
  }

  async function handleGenerateInsights() {
    setInsightsLoading(true);
    try {
      const newInsights = await generateNewInsights();
      setInsights(newInsights);
      setInsightsRateLimited(false);
      setMessage({ type: 'success', text: 'New insights generated!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      if (error.message === 'RATE_LIMITED') {
        setInsightsRateLimited(true);
        setMessage({ type: 'error', text: 'Insights limited to once per day' });
      } else {
        setMessage({ type: 'error', text: error.message || 'Failed to generate insights' });
      }
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setInsightsLoading(false);
    }
  }

  async function handleDismissAlert(alertId: string) {
    try {
      await markAlertAsSeen(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  }

  async function handleDismissAllAlerts() {
    try {
      await markAllAlertsAsSeen();
      setAlerts([]);
    } catch (error) {
      console.error('Failed to dismiss alerts:', error);
    }
  }

  async function handleExport() {
    if (!user || !profile) return;

    setExportModal('exporting');

    try {
      const [metricsRes, scoresRes, anomaliesRes, recordsRes, insightsRes] = await Promise.all([
        supabase
          .from('health_metrics')
          .select('date, hrv, resting_hr, deep_sleep_minutes, sleep_score, recovery_score, steps')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
        supabase
          .from('health_scores')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
        supabase
          .from('anomaly_alerts')
          .select('*')
          .eq('user_id', user.id)
          .order('detected_at', { ascending: false }),
        supabase
          .from('personal_records')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('ai_insights')
          .select('*')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false }),
      ]);

      const csvContent = generateComprehensiveExportCSV({
        metrics: metricsRes.data || [],
        scores: (scoresRes.data || []).map((s) => ({
          date: s.date,
          overall_score: s.overall_score,
          hrv_score: s.hrv_score,
          sleep_score: s.sleep_score,
          recovery_score: s.recovery_score,
          activity_score: s.activity_score,
          hrv_weight: s.hrv_weight,
          sleep_weight: s.sleep_weight,
          recovery_weight: s.recovery_weight,
          activity_weight: s.activity_weight,
          ai_reasoning: s.ai_reasoning,
        })),
        anomalies: (anomaliesRes.data || []).map((a) => ({
          detected_at: a.detected_at,
          metric_type: a.metric_type,
          detected_value: a.detected_value,
          baseline_value: a.baseline_value,
          deviation_amount: a.deviation_amount,
          severity: a.severity,
        })),
        records: (recordsRes.data || []).map((r) => ({
          metric_type: r.metric_type,
          record_value: r.record_value,
          previous_record: r.previous_record,
          achieved_date: r.achieved_date,
          record_scope: r.record_scope,
        })),
        insights: (insightsRes.data || []).map((i) => ({
          generated_at: i.generated_at,
          insight_type: i.insight_type,
          insight_text: i.insight_text,
          source_metrics: i.source_metrics || [],
          why_it_matters: i.why_it_matters,
        })),
        profile: {
          email: profile.email,
          full_name: profile.full_name,
          age: profile.age,
          sex: profile.sex,
        },
        exportFormat: selectedExportFormat,
      });

      const filename = getExportFilename(selectedExportFormat, profile.full_name);
      downloadCSV(csvContent, filename);

      setMessage({ type: 'success', text: 'Data exported successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to export data' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setExportModal('closed');
    }
  }

  if (!profile?.intake_completed) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Activity className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Complete Your Health Profile
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            To generate your personalized health score and analytics, we need some basic information about you.
          </p>
          <button
            onClick={() => navigate('/intake')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primaryDark text-white font-semibold rounded-xl transition-colors"
          >
            Complete Health Profile
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Health Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Your personalized health intelligence dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExportModal('selecting')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleCalculateScore}
            disabled={calculatingScore}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primaryDark text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {calculatingScore ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Refresh Score
              </>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      {alerts.length > 0 && (
        <AnomalyAlertBanner
          alerts={alerts}
          onDismiss={handleDismissAlert}
          onDismissAll={handleDismissAllAlerts}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <HealthScoreGauge
            score={currentScore?.overallScore || 0}
            previousScore={previousScore}
            components={
              currentScore?.components || {
                hrv: { score: 0, weight: 0.25 },
                sleep: { score: 0, weight: 0.25 },
                recovery: { score: 0, weight: 0.25 },
                activity: { score: 0, weight: 0.25 },
              }
            }
            aiReasoning={currentScore?.aiReasoning}
            loading={loading || calculatingScore}
          />
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <PersonalRecordsCard records={records} loading={loading} />
          <AIInsightsCarousel
            insights={insights}
            loading={loading}
            onRefresh={handleGenerateInsights}
            refreshLoading={insightsLoading}
            lastRefreshBlocked={insightsRateLimited}
          />
        </div>
      </div>

      {thisWeekData && (
        <WeeklyComparisonCard
          thisWeekData={thisWeekData}
          lastWeekData={lastWeekData}
          loading={loading}
        />
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Advanced Analysis
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Deep-dive into your health trajectories
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/simulation')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            Open Biosimulation
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Run a comprehensive biosimulation to see your long-term health risk trajectories based on your HRV and sleep data. Get personalized projections for dementia, cardiovascular disease, and more.
        </p>
      </div>

      {exportModal !== 'closed' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Export Health Data
              </h3>
            </div>

            {exportModal === 'selecting' && (
              <>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  Choose the level of detail for your export:
                </p>

                <div className="space-y-3 mb-6">
                  {[
                    {
                      value: 'basic' as ExportFormat,
                      label: 'Basic',
                      description: 'Raw daily metrics only',
                    },
                    {
                      value: 'standard' as ExportFormat,
                      label: 'Standard',
                      description: 'Metrics + health scores and trends',
                    },
                    {
                      value: 'research' as ExportFormat,
                      label: 'Research',
                      description: 'Full export with anomaly flags and AI insights',
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedExportFormat === option.value
                          ? 'bg-primary/10 border-primary'
                          : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="exportFormat"
                        value={option.value}
                        checked={selectedExportFormat === option.value}
                        onChange={(e) => setSelectedExportFormat(e.target.value as ExportFormat)}
                        className="mt-1"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{option.label}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setExportModal('closed')}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    className="flex-1 px-4 py-2 bg-primary hover:bg-primaryDark text-white rounded-lg transition-colors"
                  >
                    Export CSV
                  </button>
                </div>
              </>
            )}

            {exportModal === 'exporting' && (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">Preparing your export...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
