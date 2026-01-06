import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { generatePhysiologicalClassification } from '../lib/classification';
import { generateAllRiskProjections, getWorstTrajectories } from '../lib/riskProjection';
import { generateClinicalNarrative, generateRecommendations } from '../lib/narrativeGenerator';
import RiskTrajectoryChart from '../components/RiskTrajectoryChart';
import ClassificationBadge from '../components/ClassificationBadge';
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
} from 'lucide-react';
import { format, subDays } from 'date-fns';

type SimulationState = 'checking' | 'needs-intake' | 'needs-data' | 'ready' | 'running' | 'complete';

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
  recommendations: string[];
  dataDays: number;
}

export default function SimulationsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<SimulationState>('checking');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [avgHrv, setAvgHrv] = useState<number>(0);
  const [avgDeepSleep, setAvgDeepSleep] = useState<number>(0);

  useEffect(() => {
    if (user && profile) {
      checkReadiness();
    }
  }, [user, profile]);

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

    await new Promise(r => setTimeout(r, 2000));

    const intake: HealthIntakeData = {
      age: profile.age!,
      sex: profile.sex as 'male' | 'female' | 'other',
      hasHeartFailure: profile.has_heart_failure,
      hasDiabetes: profile.has_diabetes,
      hasChronicKidneyDisease: profile.has_chronic_kidney_disease,
    };

    const classification = generatePhysiologicalClassification(avgHrv, avgDeepSleep, intake);

    const projections = generateAllRiskProjections({
      hrvClassification: classification.hrv.classification,
      deepSleepClassification: classification.deepSleep.classification,
      avgHrv,
      avgDeepSleep,
      intake,
    });

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
      recommendations,
    });

    setResult({
      classification,
      projections,
      narrative,
      recommendations,
      dataDays: metrics.length,
    });

    setState('complete');
  }

  if (state === 'checking') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Preparing biosimulation...</p>
        </div>
      </div>
    );
  }

  if (state === 'needs-intake') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <User className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Health Profile Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            To generate accurate risk projections, we need your age, sex, and relevant medical history. This information calibrates the biosimulation to your specific physiology.
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

  if (state === 'needs-data') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            Wearable Data Required
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The biosimulation requires at least 3 days of HRV and deep sleep data from your wearable device. This data forms the foundation of your risk trajectory analysis.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            We specifically need: Heart Rate Variability (HRV) and Deep Sleep duration from devices like Oura Ring, WHOOP, Apple Watch, or Garmin.
          </p>
          <button
            onClick={() => navigate('/devices')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primaryDark text-white font-semibold rounded-xl transition-colors"
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
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Biosimulation Ready
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your data has been analyzed. Run the simulation to see your health trajectories.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Data Summary
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{metrics.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Days of Data</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgHrv.toFixed(0)}ms</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg HRV</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{avgDeepSleep.toFixed(0)}min</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Deep Sleep</p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-6 mb-6">
          <div className="flex gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                What to Expect
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                This simulation generates projections based on established clinical relationships between your physiological markers and disease outcomes. The results may be confronting. They are designed to show you the trajectory your data indicates - not to diagnose, but to inform and motivate intervention.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={runBiosimulation}
          className="w-full py-4 px-6 bg-primary hover:bg-primaryDark text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-3"
        >
          <Brain className="w-6 h-6" />
          Run Biosimulation
        </button>
      </div>
    );
  }

  if (state === 'running') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Running Biosimulation
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Analyzing your physiological data and generating risk trajectories across five disease outcomes...
          </p>
        </div>
      </div>
    );
  }

  if (state === 'complete' && result) {
    const worstOutcomes = getWorstTrajectories(result.projections);

    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Your Biosimulation Results
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Based on {result.dataDays} days of physiological data
          </p>
        </div>

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
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6">
            <div className="flex gap-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                  Elevated Risk Trajectories Detected
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300">
                  Your highest risk projections are in {worstOutcomes.join(' and ')}. The charts below show how these risks are projected to evolve over time if current patterns continue unchanged.
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Risk Trajectories
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RiskTrajectoryChart
              trajectory={result.projections.dementia}
              title="Dementia Risk"
              color="#ef4444"
            />
            <RiskTrajectoryChart
              trajectory={result.projections.cardiovascular}
              title="Cardiovascular Disease"
              color="#f97316"
            />
            <RiskTrajectoryChart
              trajectory={result.projections.heartFailure}
              title="Heart Failure Progression"
              color="#dc2626"
            />
            <RiskTrajectoryChart
              trajectory={result.projections.cognitiveDecline}
              title="Cognitive Decline"
              color="#8b5cf6"
            />
            <RiskTrajectoryChart
              trajectory={result.projections.metabolic}
              title="Metabolic Dysfunction"
              color="#eab308"
            />
          </div>
        </div>

        <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">Clinical Interpretation</h2>
          </div>
          <div className="prose prose-invert max-w-none">
            {result.narrative.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-gray-300 leading-relaxed mb-4 last:mb-0">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Recommended Actions
          </h2>
          <ul className="space-y-3">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3">
                <ChevronRight className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-gray-300">{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-primary/10 dark:bg-primary/20 rounded-xl border border-primary/30 p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Ready to Change Your Trajectory?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            These projections can be altered. Physician-guided intervention based on your specific risk profile offers the clearest path to improved outcomes.
          </p>
          <a
            href="https://aimd.health"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primaryDark text-white font-semibold rounded-xl transition-colors"
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
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Run New Simulation
          </button>
        </div>

        <div className="text-center text-xs text-gray-500 dark:text-gray-500 pb-8">
          <p>
            This simulation is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Risk projections are based on population-level associations and may not reflect individual outcomes. Always consult a qualified healthcare provider for medical decisions.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
