import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { generatePhysiologicalClassification } from '../lib/classification';
import { generateAllRiskProjections, getWorstTrajectories } from '../lib/riskProjection';
import { generateClinicalNarrative, generateRecommendations } from '../lib/narrativeGenerator';
import { generateAIPersonalizedNarrative } from '../lib/aiNarrativeGenerator';
import RiskTrajectoryChart from '../components/RiskTrajectoryChart';
import ComparativeTrajectoryChart from '../components/ComparativeTrajectoryChart';
import ClassificationBadge from '../components/ClassificationBadge';
import AIProcessingAnimation from '../components/AIProcessingAnimation';
import WhatIfExplanationPanel from '../components/WhatIfExplanationPanel';
import HorizontalScroll from '../components/mobile/HorizontalScroll';
import PillTabs from '../components/mobile/PillTabs';
import type { HealthMetric, RiskTrajectory, HealthIntakeData, PhysiologicalClassification } from '../types';
import {
  Brain,
  AlertTriangle,
  Upload,
  User,
  ChevronRight,
  Activity,
  RefreshCw,
  FileText,
  ExternalLink,
  Sliders,
  TrendingUp,
  History,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { format, subDays } from 'date-fns';

type SimulationState = 'checking' | 'needs-intake' | 'needs-data' | 'ready' | 'running' | 'complete';

type AIProcessingStage = 'analyzing' | 'calculating' | 'personalizing' | 'generating';

interface SimulationResult {
  classification: PhysiologicalClassification;
  projections: {
    dementia: RiskTrajectory;
    cardiovascular: RiskTrajectory;
    heartFailure: RiskTrajectory;
    cognitiveDecline: RiskTrajectory;
    metabolic: RiskTrajectory;
  };
  narrative: string;
  aiNarrative: string | null;
  recommendations: string[];
  dataDays: number;
  intake: HealthIntakeData;
}

const timeHorizonTabs = [
  { key: 'sixMonths' as const, label: '6 Months' },
  { key: 'oneYear' as const, label: '1 Year' },
  { key: 'fiveYears' as const, label: '5 Years' },
  { key: 'tenYears' as const, label: '10 Years' },
];

export default function SimulationsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<SimulationState>('checking');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [avgHrv, setAvgHrv] = useState<number>(0);
  const [avgDeepSleep, setAvgDeepSleep] = useState<number>(0);
  const [adjustedHrv, setAdjustedHrv] = useState<number>(0);
  const [adjustedDeepSleep, setAdjustedDeepSleep] = useState<number>(0);
  const [optimizedProjections, setOptimizedProjections] = useState<SimulationResult['projections'] | null>(null);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [selectedTimeHorizon, setSelectedTimeHorizon] = useState<'sixMonths' | 'oneYear' | 'fiveYears' | 'tenYears'>('fiveYears');
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [aiProcessingStage, setAiProcessingStage] = useState<AIProcessingStage>('analyzing');

  useEffect(() => {
    if (user && profile) {
      checkReadiness();
      fetchPastSessions();
    }
  }, [user, profile]);

  async function fetchPastSessions() {
    if (!user) return;

    const { data } = await supabase
      .from('biosimulation_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setPastSessions(data);
    }
  }

  async function checkReadiness() {
    if (!profile?.intake_completed) {
      setState('needs-intake');
      return;
    }

    const sixMonthsAgo = format(subDays(new Date(), 180), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', user!.id)
      .gte('date', sixMonthsAgo)
      .order('date', { ascending: false });

    if (!data || data.length === 0) {
      setState('needs-data');
      return;
    }

    const withHrv = data.filter(d => d.hrv !== null);
    const withDeepSleep = data.filter(d => d.deep_sleep_minutes !== null);

    if (withHrv.length < 3 || withDeepSleep.length < 3) {
      setState('needs-data');
      return;
    }

    setMetrics(data);
    const hrvAvg = withHrv.reduce((sum, d) => sum + (d.hrv || 0), 0) / withHrv.length;
    const deepSleepAvg = withDeepSleep.reduce((sum, d) => sum + (d.deep_sleep_minutes || 0), 0) / withDeepSleep.length;
    setAvgHrv(hrvAvg);
    setAvgDeepSleep(deepSleepAvg);
    setState('ready');
  }

  async function runBiosimulation() {
    if (!profile || !user) return;

    setState('running');
    setAiProcessingStage('analyzing');

    const intake: HealthIntakeData = {
      age: profile.age!,
      sex: profile.sex as 'male' | 'female' | 'other',
      hasHeartFailure: profile.has_heart_failure,
      hasDiabetes: profile.has_diabetes,
      hasChronicKidneyDisease: profile.has_chronic_kidney_disease,
    };

    await new Promise(r => setTimeout(r, 2000));
    setAiProcessingStage('calculating');

    const classification = generatePhysiologicalClassification(avgHrv, avgDeepSleep, intake);

    const projections = generateAllRiskProjections({
      hrvClassification: classification.hrv.classification,
      deepSleepClassification: classification.deepSleep.classification,
      avgHrv,
      avgDeepSleep,
      intake,
    });

    await new Promise(r => setTimeout(r, 2000));
    setAiProcessingStage('personalizing');

    const narrative = generateClinicalNarrative({
      hrvClassification: classification.hrv.classification,
      deepSleepClassification: classification.deepSleep.classification,
      avgHrv,
      avgDeepSleep,
      intake,
      dementia: projections.dementia,
      cardiovascular: projections.cardiovascular,
      heartFailure: projections.heartFailure,
      cognitiveDecline: projections.cognitiveDecline,
      metabolic: projections.metabolic,
    });

    const recommendations = generateRecommendations({
      hrvClassification: classification.hrv.classification,
      deepSleepClassification: classification.deepSleep.classification,
      avgHrv,
      avgDeepSleep,
      intake,
      dementia: projections.dementia,
      cardiovascular: projections.cardiovascular,
      heartFailure: projections.heartFailure,
      cognitiveDecline: projections.cognitiveDecline,
      metabolic: projections.metabolic,
    });

    let aiNarrative: string | null = null;
    let aiTokensUsed = 0;

    try {
      setAiProcessingStage('generating');
      const aiResult = await generateAIPersonalizedNarrative({
        classification,
        avgHrv,
        avgDeepSleep,
        intake,
        projections,
        templateNarrative: narrative,
      });
      aiNarrative = aiResult.narrative;
      aiTokensUsed = aiResult.tokensUsed;
    } catch (err) {
      console.error('AI narrative generation failed, using template:', err);
    }

    await supabase.from('biosimulation_sessions').insert({
      user_id: user.id,
      hrv_classification: classification.hrv.classification,
      deep_sleep_classification: classification.deepSleep.classification,
      avg_hrv: avgHrv,
      avg_deep_sleep_minutes: Math.round(avgDeepSleep),
      data_days_analyzed: metrics.length,
      dementia_risk: projections.dementia,
      cardiovascular_risk: projections.cardiovascular,
      heart_failure_risk: projections.heartFailure,
      cognitive_decline_risk: projections.cognitiveDecline,
      metabolic_risk: projections.metabolic,
      clinical_narrative: narrative,
      ai_narrative: aiNarrative,
      ai_narrative_tokens_used: aiTokensUsed,
      recommendations,
    });

    setResult({
      classification,
      projections,
      narrative,
      aiNarrative,
      recommendations,
      dataDays: metrics.length,
      intake,
    });

    setAdjustedHrv(avgHrv);
    setAdjustedDeepSleep(avgDeepSleep);

    await fetchPastSessions();

    setState('complete');
  }

  function calculateOptimizedProjections() {
    if (!profile) return;

    const intake: HealthIntakeData = {
      age: profile.age!,
      sex: profile.sex as 'male' | 'female' | 'other',
      hasHeartFailure: profile.has_heart_failure,
      hasDiabetes: profile.has_diabetes,
      hasChronicKidneyDisease: profile.has_chronic_kidney_disease,
    };

    const optimizedClassification = generatePhysiologicalClassification(adjustedHrv, adjustedDeepSleep, intake);

    const projections = generateAllRiskProjections({
      hrvClassification: optimizedClassification.hrv.classification,
      deepSleepClassification: optimizedClassification.deepSleep.classification,
      avgHrv: adjustedHrv,
      avgDeepSleep: adjustedDeepSleep,
      intake,
    });

    setOptimizedProjections(projections);
  }

  useEffect(() => {
    if (showWhatIf && result) {
      calculateOptimizedProjections();
    }
  }, [adjustedHrv, adjustedDeepSleep, showWhatIf]);

  if (state === 'checking') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-base text-gray-600 dark:text-gray-400">Preparing biosimulation...</p>
        </div>
      </div>
    );
  }

  if (state === 'needs-intake') {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <div className="card-mobile-elevated text-center py-10">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <User className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
            Health Profile Required
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto">
            To generate accurate risk projections, we need your age, sex, and relevant medical history.
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

  if (state === 'needs-data') {
    return (
      <div className="max-w-2xl mx-auto px-4">
        <div className="card-mobile-elevated text-center py-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Upload className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-3">
            Wearable Data Required
          </h2>
          <p className="text-base text-gray-600 dark:text-gray-400 mb-4 max-w-sm mx-auto">
            The biosimulation requires at least 3 days of HRV and deep sleep data from your wearable device.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-8 max-w-sm mx-auto">
            We need: Heart Rate Variability (HRV) and Deep Sleep duration from Oura Ring, WHOOP, Apple Watch, or Garmin.
          </p>
          <button
            onClick={() => navigate('/devices')}
            className="btn-primary"
          >
            Upload Data
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  if (state === 'ready') {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">
            Biosimulation Ready
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your data has been analyzed. Run the simulation to see your health trajectories.
          </p>
        </div>

        <div className="card-mobile-elevated">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Data Summary
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Days of Data</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgHrv.toFixed(0)}<span className="text-sm font-normal">ms</span></p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Avg HRV</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgDeepSleep.toFixed(0)}<span className="text-sm font-normal">m</span></p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Deep Sleep</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 p-5">
          <div className="flex gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                What to Expect
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                This simulation generates projections based on clinical relationships between your physiological markers and disease outcomes. The results are designed to inform and motivate intervention.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={runBiosimulation}
          className="w-full btn-primary py-4 text-base"
        >
          <Brain className="w-6 h-6" />
          Run Biosimulation
        </button>
      </div>
    );
  }

  if (state === 'running') {
    return <AIProcessingAnimation stage={aiProcessingStage} />;
  }

  if (state === 'complete' && result) {
    const worstOutcomes = getWorstTrajectories(result.projections);
    const showComparison = showWhatIf && optimizedProjections && (adjustedHrv !== avgHrv || adjustedDeepSleep !== avgDeepSleep);

    return (
      <div className="max-w-6xl mx-auto space-y-4 lg:space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
            Your Biosimulation Results
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Based on {result.dataDays} days of physiological data
          </p>
        </div>

        {pastSessions.length > 1 && (
          <div className="card-mobile-elevated !p-0 overflow-hidden">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors touch-target"
            >
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div className="text-left">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Session History
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {pastSessions.length} previous simulation{pastSessions.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`} />
            </button>

            {showHistory && (
              <div className="border-t border-gray-200 dark:border-slate-700 p-4">
                <div className="space-y-3">
                  {pastSessions.map((session, index) => {
                    const sessionDate = new Date(session.created_at);
                    const isCurrentSession = index === 0;

                    return (
                      <div
                        key={session.id}
                        className={`p-4 rounded-xl border ${
                          isCurrentSession
                            ? 'bg-primary/5 border-primary/20'
                            : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {format(sessionDate, 'MMM d, yyyy')}
                              </span>
                              {isCurrentSession && (
                                <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {format(sessionDate, 'h:mm a')} - {session.data_days_analyzed} days analyzed
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                            <div className="text-gray-500 dark:text-gray-400 mb-1">HRV</div>
                            <div className="font-bold text-gray-900 dark:text-white text-base">
                              {session.avg_hrv.toFixed(0)}ms
                            </div>
                            <div className={`text-xs mt-1 font-medium ${
                              session.hrv_classification === 'low' ? 'text-red-600' :
                              session.hrv_classification === 'moderate' ? 'text-amber-600' :
                              'text-green-600'
                            }`}>
                              {session.hrv_classification}
                            </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                            <div className="text-gray-500 dark:text-gray-400 mb-1">Deep Sleep</div>
                            <div className="font-bold text-gray-900 dark:text-white text-base">
                              {session.avg_deep_sleep_minutes}min
                            </div>
                            <div className={`text-xs mt-1 font-medium ${
                              session.deep_sleep_classification === 'inadequate' ? 'text-red-600' :
                              session.deep_sleep_classification === 'borderline' ? 'text-amber-600' :
                              'text-green-600'
                            }`}>
                              {session.deep_sleep_classification}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ClassificationBadge
            type="hrv"
            classification={result.classification.hrv.classification}
            value={result.classification.hrv.value}
            percentile={result.classification.hrv.percentile}
          />
          <ClassificationBadge
            type="deepSleep"
            classification={result.classification.deepSleep.classification}
            value={result.classification.deepSleep.value}
            percentile={result.classification.deepSleep.percentile}
          />
        </div>

        {(result.classification.hrv.classification === 'low' ||
          result.classification.deepSleep.classification === 'inadequate') && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl border border-red-200 dark:border-red-800 p-5">
            <div className="flex gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                  Elevated Risk Trajectories Detected
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300">
                  Your highest risk projections are in {worstOutcomes.join(' and ')}. The charts below show how these risks may evolve if current patterns continue unchanged.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="card-mobile-elevated bg-gradient-to-br from-primary/5 to-blue-50 dark:from-primary/10 dark:to-slate-900 border-primary/20 dark:border-primary/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-xl flex items-center justify-center">
                <Sliders className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  What If Engine
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Explore how improvements could change your trajectory
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowWhatIf(!showWhatIf)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all touch-target ${
                showWhatIf
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600'
              }`}
            >
              {showWhatIf ? 'Hide' : 'Explore'}
            </button>
          </div>

          {showWhatIf && (
            <div className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Adjust HRV
                    </label>
                    <span className="text-lg font-bold text-primary">
                      {adjustedHrv.toFixed(0)}ms
                    </span>
                  </div>
                  <input
                    type="range"
                    min={Math.max(10, avgHrv * 0.5)}
                    max={Math.min(120, avgHrv * 2)}
                    step="1"
                    value={adjustedHrv}
                    onChange={(e) => setAdjustedHrv(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>{Math.max(10, Math.round(avgHrv * 0.5))}ms</span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">Current: {avgHrv.toFixed(0)}ms</span>
                    <span>{Math.min(120, Math.round(avgHrv * 2))}ms</span>
                  </div>
                  {adjustedHrv !== avgHrv && (
                    <div className="mt-3 flex items-center gap-2">
                      {adjustedHrv > avgHrv ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {adjustedHrv > avgHrv
                          ? `+${((adjustedHrv - avgHrv) / avgHrv * 100).toFixed(0)}% improvement`
                          : `${((adjustedHrv - avgHrv) / avgHrv * 100).toFixed(0)}% decrease`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Adjust Deep Sleep
                    </label>
                    <span className="text-lg font-bold text-primary">
                      {adjustedDeepSleep.toFixed(0)} min
                    </span>
                  </div>
                  <input
                    type="range"
                    min={Math.max(20, avgDeepSleep * 0.5)}
                    max={Math.min(150, avgDeepSleep * 2.5)}
                    step="5"
                    value={adjustedDeepSleep}
                    onChange={(e) => setAdjustedDeepSleep(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>{Math.max(20, Math.round(avgDeepSleep * 0.5))}m</span>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">Current: {avgDeepSleep.toFixed(0)}m</span>
                    <span>{Math.min(150, Math.round(avgDeepSleep * 2.5))}m</span>
                  </div>
                  {adjustedDeepSleep !== avgDeepSleep && (
                    <div className="mt-3 flex items-center gap-2">
                      {adjustedDeepSleep > avgDeepSleep ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {adjustedDeepSleep > avgDeepSleep
                          ? `+${(adjustedDeepSleep - avgDeepSleep).toFixed(0)} min more`
                          : `${(adjustedDeepSleep - avgDeepSleep).toFixed(0)} min less`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {showComparison && optimizedProjections && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-green-900 dark:text-green-200 mb-1">
                        Potential Impact
                      </h4>
                      <p className="text-sm text-green-800 dark:text-green-300">
                        Based on your adjusted values, here's how your 5-year risk trajectories could change:
                      </p>
                    </div>
                  </div>
                  <HorizontalScroll showIndicators={false} className="lg:hidden">
                    {Object.entries(optimizedProjections).map(([key, trajectory]) => {
                      const baseline = result.projections[key as keyof typeof result.projections];
                      const difference = baseline.fiveYears - trajectory.fiveYears;
                      const names: Record<string, string> = {
                        dementia: 'Dementia',
                        cardiovascular: 'Cardiovascular',
                        heartFailure: 'Heart Failure',
                        cognitiveDecline: 'Cognitive Decline',
                        metabolic: 'Metabolic',
                      };

                      return (
                        <div key={key} className="w-36 bg-white dark:bg-slate-800 rounded-xl p-4 border border-green-200 dark:border-green-800/50">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                            {names[key]}
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-500 line-through">
                              {baseline.fiveYears.toFixed(0)}%
                            </span>
                            <span className="text-xl font-bold text-green-600 dark:text-green-400">
                              {trajectory.fiveYears.toFixed(0)}%
                            </span>
                          </div>
                          {difference > 0 && (
                            <div className="text-xs text-green-700 dark:text-green-300 mt-1 font-medium">
                              -{difference.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </HorizontalScroll>
                  <div className="hidden lg:grid lg:grid-cols-5 gap-3">
                    {Object.entries(optimizedProjections).map(([key, trajectory]) => {
                      const baseline = result.projections[key as keyof typeof result.projections];
                      const difference = baseline.fiveYears - trajectory.fiveYears;
                      const names: Record<string, string> = {
                        dementia: 'Dementia',
                        cardiovascular: 'Cardiovascular',
                        heartFailure: 'Heart Failure',
                        cognitiveDecline: 'Cognitive Decline',
                        metabolic: 'Metabolic',
                      };

                      return (
                        <div key={key} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            {names[key]}
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-500 line-through">
                              {baseline.fiveYears.toFixed(0)}%
                            </span>
                            <span className="text-lg font-bold text-green-600 dark:text-green-400">
                              {trajectory.fiveYears.toFixed(0)}%
                            </span>
                          </div>
                          {difference > 0 && (
                            <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                              -{difference.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {user && (
                    <WhatIfExplanationPanel
                      userId={user.id}
                      intake={result.intake}
                      classification={result.classification}
                      baselineHrv={avgHrv}
                      baselineDeepSleep={avgDeepSleep}
                      adjustedHrv={adjustedHrv}
                      adjustedDeepSleep={adjustedDeepSleep}
                      baselineProjections={result.projections}
                      adjustedProjections={optimizedProjections}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card-mobile-elevated !p-4 lg:!p-6 lg:bg-white lg:dark:bg-slate-800">
          <div className="hidden lg:flex lg:items-center lg:justify-center lg:gap-3">
            {timeHorizonTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedTimeHorizon(tab.key)}
                className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  selectedTimeHorizon === tab.key
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="lg:hidden">
            <PillTabs
              tabs={timeHorizonTabs}
              activeTab={selectedTimeHorizon}
              onChange={setSelectedTimeHorizon}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Risk Trajectories
            </h2>
            {showComparison && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                Comparison view
              </span>
            )}
          </div>

          <HorizontalScroll className="lg:hidden">
            {showComparison ? (
              <>
                <div className="w-72">
                  <ComparativeTrajectoryChart
                    baseline={result.projections.dementia}
                    optimized={optimizedProjections!.dementia}
                    title="Dementia Risk"
                    color="#ef4444"
                    timeHorizon={selectedTimeHorizon}
                  />
                </div>
                <div className="w-72">
                  <ComparativeTrajectoryChart
                    baseline={result.projections.cardiovascular}
                    optimized={optimizedProjections!.cardiovascular}
                    title="Cardiovascular Disease"
                    color="#f97316"
                    timeHorizon={selectedTimeHorizon}
                  />
                </div>
                <div className="w-72">
                  <ComparativeTrajectoryChart
                    baseline={result.projections.heartFailure}
                    optimized={optimizedProjections!.heartFailure}
                    title="Heart Failure"
                    color="#dc2626"
                    timeHorizon={selectedTimeHorizon}
                  />
                </div>
                <div className="w-72">
                  <ComparativeTrajectoryChart
                    baseline={result.projections.cognitiveDecline}
                    optimized={optimizedProjections!.cognitiveDecline}
                    title="Cognitive Decline"
                    color="#8b5cf6"
                    timeHorizon={selectedTimeHorizon}
                  />
                </div>
                <div className="w-72">
                  <ComparativeTrajectoryChart
                    baseline={result.projections.metabolic}
                    optimized={optimizedProjections!.metabolic}
                    title="Metabolic Dysfunction"
                    color="#eab308"
                    timeHorizon={selectedTimeHorizon}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="w-72">
                  <RiskTrajectoryChart trajectory={result.projections.dementia} title="Dementia Risk" color="#ef4444" />
                </div>
                <div className="w-72">
                  <RiskTrajectoryChart trajectory={result.projections.cardiovascular} title="Cardiovascular Disease" color="#f97316" />
                </div>
                <div className="w-72">
                  <RiskTrajectoryChart trajectory={result.projections.heartFailure} title="Heart Failure" color="#dc2626" />
                </div>
                <div className="w-72">
                  <RiskTrajectoryChart trajectory={result.projections.cognitiveDecline} title="Cognitive Decline" color="#8b5cf6" />
                </div>
                <div className="w-72">
                  <RiskTrajectoryChart trajectory={result.projections.metabolic} title="Metabolic Dysfunction" color="#eab308" />
                </div>
              </>
            )}
          </HorizontalScroll>

          <div className="hidden lg:grid lg:grid-cols-2 gap-6">
            {showComparison ? (
              <>
                <ComparativeTrajectoryChart baseline={result.projections.dementia} optimized={optimizedProjections!.dementia} title="Dementia Risk" color="#ef4444" timeHorizon={selectedTimeHorizon} />
                <ComparativeTrajectoryChart baseline={result.projections.cardiovascular} optimized={optimizedProjections!.cardiovascular} title="Cardiovascular Disease" color="#f97316" timeHorizon={selectedTimeHorizon} />
                <ComparativeTrajectoryChart baseline={result.projections.heartFailure} optimized={optimizedProjections!.heartFailure} title="Heart Failure Progression" color="#dc2626" timeHorizon={selectedTimeHorizon} />
                <ComparativeTrajectoryChart baseline={result.projections.cognitiveDecline} optimized={optimizedProjections!.cognitiveDecline} title="Cognitive Decline" color="#8b5cf6" timeHorizon={selectedTimeHorizon} />
                <ComparativeTrajectoryChart baseline={result.projections.metabolic} optimized={optimizedProjections!.metabolic} title="Metabolic Dysfunction" color="#eab308" timeHorizon={selectedTimeHorizon} />
              </>
            ) : (
              <>
                <RiskTrajectoryChart trajectory={result.projections.dementia} title="Dementia Risk" color="#ef4444" />
                <RiskTrajectoryChart trajectory={result.projections.cardiovascular} title="Cardiovascular Disease" color="#f97316" />
                <RiskTrajectoryChart trajectory={result.projections.heartFailure} title="Heart Failure Progression" color="#dc2626" />
                <RiskTrajectoryChart trajectory={result.projections.cognitiveDecline} title="Cognitive Decline" color="#8b5cf6" />
                <RiskTrajectoryChart trajectory={result.projections.metabolic} title="Metabolic Dysfunction" color="#eab308" />
              </>
            )}
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-white" />
              <h2 className="text-lg lg:text-xl font-bold text-white">Clinical Interpretation</h2>
            </div>
            {result.aiNarrative && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/20 border border-primary/30 rounded-full text-xs font-medium text-primary self-start">
                <Sparkles className="w-3.5 h-3.5" />
                AI-Personalized
              </span>
            )}
          </div>
          <div className="prose prose-invert max-w-none">
            {(result.aiNarrative || result.narrative).split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-gray-300 leading-relaxed text-sm lg:text-base mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="card-mobile-elevated">
          <h2 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white mb-4">
            Recommended Actions
          </h2>
          <ul className="space-y-3">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ChevronRight className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm lg:text-base text-gray-700 dark:text-gray-300">{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card-mobile-elevated bg-gradient-to-br from-primary/5 to-blue-50 dark:from-primary/10 dark:to-slate-900 border-primary/20 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Ready to Change Your Trajectory?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            These projections can be altered. Physician-guided intervention offers the clearest path to improved outcomes.
          </p>
          <a
            href="https://aimd.health"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Consult with a Physician
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => {
              setResult(null);
              setState('ready');
            }}
            className="flex items-center gap-2 px-4 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors touch-target"
          >
            <RefreshCw className="w-4 h-4" />
            Run New Simulation
          </button>
        </div>

        <div className="text-center text-xs text-gray-500 dark:text-gray-500 pb-8 px-4">
          <p>
            This simulation is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for medical decisions.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
