import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { HealthMetric, Simulation, SimulationPrediction } from '../types';
import {
  Brain,
  Play,
  TrendingUp,
  TrendingDown,
  Clock,
  Heart,
  Moon,
  Footprints,
  Battery,
  Zap,
  History,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

const simulationScenarios = [
  {
    id: 'improve_sleep',
    title: 'Improve Sleep Duration',
    description: 'What if you slept 1 hour more per night?',
    icon: Moon,
    changes: { sleep_duration_minutes: 60 },
  },
  {
    id: 'increase_activity',
    title: 'Increase Activity',
    description: 'What if you added 30 minutes of daily activity?',
    icon: Footprints,
    changes: { activity_minutes: 30 },
  },
  {
    id: 'boost_hrv',
    title: 'Boost HRV',
    description: 'What if your HRV improved by 10ms?',
    icon: Heart,
    changes: { hrv: 10 },
  },
  {
    id: 'reduce_stress',
    title: 'Reduce Stress',
    description: 'What if your stress levels dropped by 20%?',
    icon: Zap,
    changes: { stress_level: -20 },
  },
];

export default function SimulationsPage() {
  const { user } = useAuth();
  const [currentMetrics, setCurrentMetrics] = useState<Record<string, number>>({});
  const [customChanges, setCustomChanges] = useState<Record<string, number>>({});
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<SimulationPrediction | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [pastSimulations, setPastSimulations] = useState<Simulation[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCurrentMetrics();
      fetchPastSimulations();
    }
  }, [user]);

  async function fetchCurrentMetrics() {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', user!.id)
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: false });

    if (data && data.length > 0) {
      const avgMetrics = calculateAverages(data);
      setCurrentMetrics(avgMetrics);
    }
  }

  async function fetchPastSimulations() {
    const { data } = await supabase
      .from('simulations')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setPastSimulations(data);
    }
  }

  function calculateAverages(data: HealthMetric[]): Record<string, number> {
    const metrics: Record<string, number[]> = {};

    data.forEach((d) => {
      if (d.hrv) (metrics.hrv = metrics.hrv || []).push(d.hrv);
      if (d.sleep_duration_minutes) (metrics.sleep_duration_minutes = metrics.sleep_duration_minutes || []).push(d.sleep_duration_minutes);
      if (d.steps) (metrics.steps = metrics.steps || []).push(d.steps);
      if (d.activity_minutes) (metrics.activity_minutes = metrics.activity_minutes || []).push(d.activity_minutes);
      if (d.recovery_score) (metrics.recovery_score = metrics.recovery_score || []).push(d.recovery_score);
      if (d.stress_level) (metrics.stress_level = metrics.stress_level || []).push(d.stress_level);
      if (d.resting_heart_rate) (metrics.resting_heart_rate = metrics.resting_heart_rate || []).push(d.resting_heart_rate);
    });

    const averages: Record<string, number> = {};
    Object.keys(metrics).forEach((key) => {
      averages[key] = Math.round(metrics[key].reduce((a, b) => a + b, 0) / metrics[key].length * 10) / 10;
    });

    return averages;
  }

  async function runSimulation(changes: Record<string, number>) {
    if (!user) return;

    setSimulating(true);
    setResult(null);
    setRecommendations([]);

    await new Promise((r) => setTimeout(r, 1500));

    const prediction = generatePrediction(currentMetrics, changes);
    const recs = generateRecommendations(changes, prediction);

    const { error } = await supabase.from('simulations').insert({
      user_id: user.id,
      input_metrics: currentMetrics,
      changes,
      predictions: prediction,
      recommendations: recs,
    });

    if (!error) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'run_simulation',
        details: { changes, prediction },
      });
    }

    setResult(prediction);
    setRecommendations(recs);
    setSimulating(false);
    fetchPastSimulations();
  }

  function generatePrediction(current: Record<string, number>, changes: Record<string, number>): SimulationPrediction {
    let fitnessImpact = 0;
    let stressReduction = 0;
    let recoveryImprovement = 0;
    let sleepQualityChange = 0;
    let energyLevelChange = 0;

    if (changes.sleep_duration_minutes) {
      const sleepChange = changes.sleep_duration_minutes / 60;
      sleepQualityChange += sleepChange * 8;
      recoveryImprovement += sleepChange * 5;
      energyLevelChange += sleepChange * 10;
      stressReduction += sleepChange * 3;
    }

    if (changes.activity_minutes) {
      const activityChange = changes.activity_minutes / 30;
      fitnessImpact += activityChange * 12;
      stressReduction += activityChange * 8;
      energyLevelChange += activityChange * 5;
      recoveryImprovement += activityChange * 3;
    }

    if (changes.hrv) {
      const hrvChange = changes.hrv / 5;
      recoveryImprovement += hrvChange * 10;
      stressReduction += hrvChange * 7;
      fitnessImpact += hrvChange * 5;
      energyLevelChange += hrvChange * 8;
    }

    if (changes.stress_level) {
      const stressChange = Math.abs(changes.stress_level) / 10;
      stressReduction += stressChange * 15;
      sleepQualityChange += stressChange * 5;
      recoveryImprovement += stressChange * 7;
    }

    if (changes.steps) {
      const stepsChange = changes.steps / 2000;
      fitnessImpact += stepsChange * 8;
      energyLevelChange += stepsChange * 4;
    }

    const totalChange = Math.abs(fitnessImpact) + Math.abs(stressReduction) + Math.abs(recoveryImprovement);
    const timeframe = Math.max(14, Math.min(90, Math.round(totalChange * 1.5)));
    const confidence = Math.min(95, 60 + Object.keys(current).length * 5);

    return {
      fitness_impact: Math.round(Math.min(50, Math.max(-50, fitnessImpact))),
      stress_reduction: Math.round(Math.min(50, Math.max(-20, stressReduction))),
      recovery_improvement: Math.round(Math.min(50, Math.max(-30, recoveryImprovement))),
      sleep_quality_change: Math.round(Math.min(40, Math.max(-20, sleepQualityChange))),
      energy_level_change: Math.round(Math.min(40, Math.max(-30, energyLevelChange))),
      timeframe_days: timeframe,
      confidence,
    };
  }

  function generateRecommendations(changes: Record<string, number>, prediction: SimulationPrediction): string[] {
    const recs: string[] = [];

    if (changes.sleep_duration_minutes && changes.sleep_duration_minutes > 0) {
      recs.push('Establish a consistent bedtime routine to achieve the extra sleep.');
      recs.push('Avoid screens 1 hour before bed to improve sleep onset.');
    }

    if (changes.activity_minutes && changes.activity_minutes > 0) {
      recs.push('Start with 10-minute walks after meals to build the habit.');
      recs.push('Consider activities you enjoy to make the increase sustainable.');
    }

    if (changes.hrv && changes.hrv > 0) {
      recs.push('Practice deep breathing exercises for 5 minutes daily.');
      recs.push('Reduce alcohol consumption to support HRV improvement.');
    }

    if (changes.stress_level && changes.stress_level < 0) {
      recs.push('Incorporate 10 minutes of meditation into your morning routine.');
      recs.push('Take short breaks during work to prevent stress buildup.');
    }

    if (prediction.fitness_impact > 20) {
      recs.push('Track your progress weekly to stay motivated.');
    }

    if (prediction.recovery_improvement > 15) {
      recs.push('Prioritize rest days to maximize recovery gains.');
    }

    return recs.slice(0, 4);
  }

  function handleScenarioClick(scenario: typeof simulationScenarios[0]) {
    setActiveScenario(scenario.id);
    setCustomChanges(scenario.changes);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Bio-Simulations</h1>
          <p className="text-slate-400">
            Explore how changes in your habits could impact your health outcomes
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          <History className="w-5 h-5" />
          History
        </button>
      </div>

      {Object.keys(currentMetrics).length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 text-center">
          <Brain className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Data Available</h3>
          <p className="text-slate-400 text-sm">
            Upload your wearable data first to run bio-simulations
          </p>
        </div>
      ) : (
        <>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Your Current Averages (30 days)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {currentMetrics.hrv && (
                <MetricDisplay icon={Heart} label="HRV" value={currentMetrics.hrv} unit="ms" color="rose" />
              )}
              {currentMetrics.sleep_duration_minutes && (
                <MetricDisplay icon={Moon} label="Sleep" value={Math.round(currentMetrics.sleep_duration_minutes / 60 * 10) / 10} unit="hrs" color="blue" />
              )}
              {currentMetrics.steps && (
                <MetricDisplay icon={Footprints} label="Steps" value={Math.round(currentMetrics.steps)} unit="" color="amber" />
              )}
              {currentMetrics.recovery_score && (
                <MetricDisplay icon={Battery} label="Recovery" value={currentMetrics.recovery_score} unit="%" color="emerald" />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Quick Scenarios</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {simulationScenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => handleScenarioClick(scenario)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    activeScenario === scenario.id
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <scenario.icon className={`w-6 h-6 mb-3 ${activeScenario === scenario.id ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <p className="text-white font-medium text-sm mb-1">{scenario.title}</p>
                  <p className="text-slate-400 text-xs">{scenario.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h3 className="text-lg font-semibold text-white mb-4">Custom Simulation</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Sleep Change (minutes)</label>
                <input
                  type="number"
                  value={customChanges.sleep_duration_minutes || ''}
                  onChange={(e) => setCustomChanges({ ...customChanges, sleep_duration_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="+60"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Activity Change (minutes)</label>
                <input
                  type="number"
                  value={customChanges.activity_minutes || ''}
                  onChange={(e) => setCustomChanges({ ...customChanges, activity_minutes: parseInt(e.target.value) || 0 })}
                  placeholder="+30"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">HRV Change (ms)</label>
                <input
                  type="number"
                  value={customChanges.hrv || ''}
                  onChange={(e) => setCustomChanges({ ...customChanges, hrv: parseInt(e.target.value) || 0 })}
                  placeholder="+5"
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              onClick={() => runSimulation(customChanges)}
              disabled={simulating || Object.values(customChanges).every((v) => !v)}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {simulating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running Simulation...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Run Simulation
                </>
              )}
            </button>
          </div>

          {result && (
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-6 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-6">
                <Brain className="w-6 h-6 text-emerald-400" />
                <h3 className="text-lg font-semibold text-white">Simulation Results</h3>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <PredictionCard label="Fitness Impact" value={result.fitness_impact} suffix="%" />
                <PredictionCard label="Stress Reduction" value={result.stress_reduction} suffix="%" />
                <PredictionCard label="Recovery Boost" value={result.recovery_improvement} suffix="%" />
                <PredictionCard label="Sleep Quality" value={result.sleep_quality_change} suffix="%" />
                <PredictionCard label="Energy Level" value={result.energy_level_change} suffix="%" />
              </div>

              <div className="flex items-center gap-4 mb-6 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span>Expected in {result.timeframe_days} days</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Info className="w-4 h-4" />
                  <span>{result.confidence}% confidence</span>
                </div>
              </div>

              {recommendations.length > 0 && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Recommendations</h4>
                  <ul className="space-y-2">
                    {recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                        <ArrowRight className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showHistory && pastSimulations.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            Past Simulations
          </h3>
          <div className="space-y-3">
            {pastSimulations.map((sim) => (
              <div key={sim.id} className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white text-sm font-medium">
                    {Object.entries(sim.changes)
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${k.replace('_', ' ')}: ${v > 0 ? '+' : ''}${v}`)
                      .join(', ')}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {format(parseISO(sim.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-slate-400">
                  <span>Fitness: {sim.predictions.fitness_impact > 0 ? '+' : ''}{sim.predictions.fitness_impact}%</span>
                  <span>Recovery: {sim.predictions.recovery_improvement > 0 ? '+' : ''}{sim.predictions.recovery_improvement}%</span>
                  <span>Confidence: {sim.predictions.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MetricDisplayProps {
  icon: React.ElementType;
  label: string;
  value: number;
  unit: string;
  color: 'rose' | 'blue' | 'amber' | 'emerald';
}

function MetricDisplay({ icon: Icon, label, value, unit, color }: MetricDisplayProps) {
  const colorClasses = {
    rose: 'text-rose-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className="bg-slate-700/30 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${colorClasses[color]}`} />
        <span className="text-slate-400 text-xs">{label}</span>
      </div>
      <p className="text-white text-lg font-semibold">
        {value.toLocaleString()}
        {unit && <span className="text-slate-400 text-sm ml-1">{unit}</span>}
      </p>
    </div>
  );
}

interface PredictionCardProps {
  label: string;
  value: number;
  suffix: string;
}

function PredictionCard({ label, value, suffix }: PredictionCardProps) {
  const isPositive = value >= 0;
  return (
    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <div className="flex items-center justify-center gap-1">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        ) : (
          <TrendingDown className="w-4 h-4 text-rose-400" />
        )}
        <span className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? '+' : ''}{value}{suffix}
        </span>
      </div>
    </div>
  );
}
