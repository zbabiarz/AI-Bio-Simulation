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
  checkHasHealthMetrics,
  getDataDebugInfo,
  type HealthScore,
  type PersonalRecord,
  type AnomalyAlert,
  type AIInsight,
  type DataDebugInfo,
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
import BottomSheet from '../components/mobile/BottomSheet';
import {
  Activity,
  Download,
  RefreshCw,
  ChevronRight,
  FileText,
  Brain,
  AlertCircle,
  Check,
  X,
  Info,
  Database,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

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
  const [hasHealthData, setHasHealthData] = useState(true);
  const [thisWeekData, setThisWeekData] = useState<any>(null);
  const [lastWeekData, setLastWeekData] = useState<any>(null);
  const [exportModal, setExportModal] = useState<ExportModalState>('closed');
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('standard');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [debugInfo, setDebugInfo] = useState<DataDebugInfo | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  useEffect(() => {
    if (user && profile) {
      loadAnalyticsData();
      loadDebugInfo();
    }
  }, [user, profile]);

  async function loadDebugInfo() {
    try {
      const info = await getDataDebugInfo();
      setDebugInfo(info);
      console.log('Debug info:', info);
    } catch (error) {
      console.error('Error loading debug info:', error);
    }
  }

  async function loadAnalyticsData() {
    if (!user) return;

    setLoading(true);

    try {
      const hasData = await checkHasHealthMetrics();
      setHasHealthData(hasData);

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
      } else if (hasData) {
        console.log('No health scores found, but metrics exist. Auto-calculating...');
        try {
          const newScore = await calculateHealthScore();
          if (newScore) {
            setCurrentScore(newScore);
            setMessage({ type: 'success', text: 'Health score calculated!' });
            setTimeout(() => setMessage(null), 3000);
          }
        } catch (error: any) {
          console.error('Auto-calculation failed:', error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
          });

          let errorText = 'Could not calculate health score.';
          if (error.message?.includes('No health metrics')) {
            errorText = 'No recent health data found. Please upload or sync your data.';
          } else if (error.message?.includes('profile')) {
            errorText = 'Complete your health profile to calculate score.';
          } else {
            errorText = error.message || 'Try clicking Refresh.';
          }

          setMessage({ type: 'error', text: errorText });
          setTimeout(() => setMessage(null), 8000);
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
    console.log('Generate Insights button clicked');
    console.log('Has health data:', hasHealthData);

    if (!hasHealthData) {
      console.log('No health data, showing error');
      setMessage({
        type: 'error',
        text: 'No health data available. Please sync your wearable device first.'
      });
      setTimeout(() => setMessage(null), 5000);
      return;
    }

    setInsightsLoading(true);
    console.log('Starting insights generation...');

    try {
      const newInsights = await generateNewInsights();
      console.log('Insights generated successfully:', newInsights);
      setInsights(newInsights);
      setInsightsRateLimited(false);
      setMessage({ type: 'success', text: 'New insights generated!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Insights generation error:', error);
      if (error.message === 'RATE_LIMITED') {
        setInsightsRateLimited(true);
        setMessage({ type: 'error', text: 'Insights limited to once per day' });
      } else if (error.message === 'NO_DATA') {
        setHasHealthData(false);
        setMessage({
          type: 'error',
          text: 'No health data available. Please sync your wearable device first.'
        });
      } else {
        const errorMsg = error.message || 'Failed to generate insights';
        console.error('Unexpected error:', errorMsg);
        setMessage({ type: 'error', text: errorMsg });
      }
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setInsightsLoading(false);
      console.log('Insights loading state reset');
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
          .select('date, hrv, resting_heart_rate, deep_sleep_minutes, sleep_score, recovery_score, steps')
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
      <div className="max-w-2xl mx-auto px-4">
        <div className="card-mobile-elevated text-center py-10">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Activity className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
            Complete Your Health Profile
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto">
            To generate your personalized health score and analytics, we need some basic information about you.
          </p>
          <button
            onClick={() => navigate('/intake')}
            className="btn-primary"
          >
            Complete Health Profile
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Health Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Your personalized health intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExportModal('selecting')}
            className="flex items-center justify-center gap-2 h-10 px-4 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl transition-all active:scale-[0.98] touch-target text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={handleCalculateScore}
            disabled={calculatingScore}
            className="flex items-center justify-center gap-2 h-10 px-4 bg-gradient-to-r from-primary to-primaryAccent hover:from-primaryDark hover:to-primary text-white rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 touch-target text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${calculatingScore ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{calculatingScore ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-center justify-between gap-3 p-4 rounded-2xl animate-fade-in-up ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <Check className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!hasHealthData && debugInfo && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Health Data Status
              </h3>
              <div className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                <p>Total metrics in database: <strong>{debugInfo.totalMetrics}</strong></p>
                {debugInfo.dateRange ? (
                  <p>
                    Date range: <strong>{debugInfo.dateRange.oldest}</strong> to <strong>{debugInfo.dateRange.newest}</strong>
                  </p>
                ) : (
                  <p className="font-semibold">No metrics found in database</p>
                )}
                <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                  <p className="font-medium mb-1">Metrics with data:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>HRV: {debugInfo.metricsWithData.hrv}</div>
                    <div>Sleep: {debugInfo.metricsWithData.sleep}</div>
                    <div>Recovery: {debugInfo.metricsWithData.recovery}</div>
                    <div>Steps: {debugInfo.metricsWithData.steps}</div>
                  </div>
                </div>
                {debugInfo.recentDates.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                    <p className="font-medium mb-1">Recent dates:</p>
                    <p className="text-xs">{debugInfo.recentDates.join(', ')}</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
              >
                {showDebugPanel ? 'Hide' : 'Show'} technical details
              </button>
            </div>
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <AnomalyAlertBanner
          alerts={alerts}
          onDismiss={handleDismissAlert}
          onDismissAll={handleDismissAllAlerts}
        />
      )}

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

      <AIInsightsCarousel
        insights={insights}
        loading={loading}
        onRefresh={handleGenerateInsights}
        refreshLoading={insightsLoading}
        lastRefreshBlocked={insightsRateLimited}
        hasHealthData={hasHealthData}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <PersonalRecordsCard records={records} loading={loading} />
        {thisWeekData && (
          <WeeklyComparisonCard
            thisWeekData={thisWeekData}
            lastWeekData={lastWeekData}
            loading={loading}
          />
        )}
      </div>

      <button
        onClick={() => navigate('/simulation')}
        className="w-full card-mobile-elevated press-scale-sm group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primaryAccent/10 dark:from-primary/20 dark:to-primaryAccent/20 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Run Biosimulation
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              See your long-term health risk trajectories
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </button>

      <BottomSheet
        isOpen={exportModal !== 'closed'}
        onClose={() => setExportModal('closed')}
        title="Export Health Data"
      >
        {exportModal === 'selecting' && (
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose the level of detail for your export:
            </p>

            <div className="space-y-3">
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
                <button
                  key={option.value}
                  onClick={() => setSelectedExportFormat(option.value)}
                  className={`w-full flex items-start gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98] text-left ${
                    selectedExportFormat === option.value
                      ? 'bg-primary/10 border-primary dark:bg-primary/20'
                      : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selectedExportFormat === option.value
                        ? 'border-primary bg-primary'
                        : 'border-gray-300 dark:border-slate-600'
                    }`}
                  >
                    {selectedExportFormat === option.value && (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{option.label}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setExportModal('closed')}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                className="flex-1 btn-primary"
              >
                <FileText className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>
        )}

        {exportModal === 'exporting' && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Preparing your export...</p>
          </div>
        )}
      </BottomSheet>

      <div className="hidden lg:block">
        {exportModal !== 'closed' && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 max-w-md w-full animate-scale-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-xl flex items-center justify-center">
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
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
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
                      className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExport}
                      className="flex-1 px-4 py-2.5 bg-primary hover:bg-primaryDark text-white rounded-xl transition-colors font-medium"
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
    </div>
  );
}
