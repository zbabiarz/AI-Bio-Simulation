import { useState, useEffect } from 'react';
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getScoreColor, getScoreLabel } from '../lib/analytics';

interface HealthScoreGaugeProps {
  score: number;
  previousScore?: number | null;
  components: {
    hrv: { score: number; weight: number };
    sleep: { score: number; weight: number };
    recovery: { score: number; weight: number };
    activity: { score: number; weight: number };
  };
  aiReasoning?: string;
  loading?: boolean;
}

export default function HealthScoreGauge({
  score,
  previousScore,
  components,
  aiReasoning,
  loading = false,
}: HealthScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    if (loading) {
      setAnimatedScore(0);
      return;
    }

    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score, loading]);

  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
  const scoreColor = getScoreColor(animatedScore);
  const scoreLabel = getScoreLabel(animatedScore);

  const change = previousScore !== null && previousScore !== undefined
    ? score - previousScore
    : null;

  const componentList = [
    { name: 'HRV', ...components.hrv, color: '#3b82f6' },
    { name: 'Sleep', ...components.sleep, color: '#8b5cf6' },
    { name: 'Recovery', ...components.recovery, color: '#10b981' },
    { name: 'Activity', ...components.activity, color: '#f59e0b' },
  ];

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Calculating your health score...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Health Score</h3>
        <button
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title="View breakdown"
        >
          <Info className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative w-52 h-52">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-gray-200 dark:text-slate-700"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={scoreColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1.5s ease-out, stroke 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-5xl font-bold transition-colors"
              style={{ color: scoreColor }}
            >
              {animatedScore}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">out of 100</span>
            <span
              className="text-sm font-medium mt-2 px-3 py-1 rounded-full"
              style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
            >
              {scoreLabel}
            </span>
          </div>
        </div>

        {change !== null && (
          <div className="flex items-center gap-2 mt-4">
            {change > 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : change < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <Minus className="w-4 h-4 text-gray-400" />
            )}
            <span
              className={`text-sm font-medium ${
                change > 0
                  ? 'text-green-600 dark:text-green-400'
                  : change < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {change > 0 ? '+' : ''}
              {change} from yesterday
            </span>
          </div>
        )}
      </div>

      {showBreakdown && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Score Breakdown
          </h4>
          <div className="space-y-4">
            {componentList.map((component) => (
              <div key={component.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: component.color }}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {component.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {component.score}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      ({(component.weight * 100).toFixed(0)}% weight)
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${component.score}%`,
                      backgroundColor: component.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {aiReasoning && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                <span className="font-medium text-gray-700 dark:text-gray-300">AI Weighting: </span>
                {aiReasoning}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
