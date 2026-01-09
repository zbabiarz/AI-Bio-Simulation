import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Heart, Moon, Zap, Footprints } from 'lucide-react';
import { getScoreColor, getScoreLabel } from '../lib/analytics';
import { SkeletonGauge } from './mobile/Skeleton';

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

  const componentChips = useMemo(() => [
    {
      name: 'HRV',
      score: components.hrv.score,
      weight: components.hrv.weight,
      icon: Heart,
      color: '#3b82f6',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      name: 'Sleep',
      score: components.sleep.score,
      weight: components.sleep.weight,
      icon: Moon,
      color: '#8b5cf6',
      bgColor: 'bg-violet-50 dark:bg-violet-900/20',
      textColor: 'text-violet-600 dark:text-violet-400'
    },
    {
      name: 'Recovery',
      score: components.recovery.score,
      weight: components.recovery.weight,
      icon: Zap,
      color: '#10b981',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      name: 'Activity',
      score: components.activity.score,
      weight: components.activity.weight,
      icon: Footprints,
      color: '#f59e0b',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      textColor: 'text-amber-600 dark:text-amber-400'
    },
  ], [components]);

  const glowClass = useMemo(() => {
    if (animatedScore >= 80) return 'glow-success';
    if (animatedScore >= 60) return 'glow-primary';
    if (animatedScore >= 40) return 'glow-warning';
    return 'glow-danger';
  }, [animatedScore]);

  if (loading) {
    return <SkeletonGauge />;
  }

  return (
    <div className="card-mobile-elevated">
      <div className="flex items-center justify-between mb-2 lg:mb-4">
        <h3 className="text-xl lg:text-lg font-bold tracking-tight text-gray-900 dark:text-white">
          Health Score
        </h3>
        {change !== null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-slate-800">
            {change > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            ) : change < 0 ? (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span
              className={`text-xs font-semibold ${
                change > 0
                  ? 'text-green-600 dark:text-green-400'
                  : change < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {change > 0 ? '+' : ''}{change}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center py-4 lg:py-2">
        <div className={`relative w-56 h-56 lg:w-48 lg:h-48 rounded-full ${glowClass} animate-pulse-glow`}>
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-gray-100 dark:text-slate-800"
            />
            <circle
              cx="100"
              cy="100"
              r="90"
              fill="none"
              stroke={scoreColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="drop-shadow-lg"
              style={{
                transition: 'stroke-dashoffset 1.5s ease-out, stroke 0.5s ease',
                filter: `drop-shadow(0 0 8px ${scoreColor}40)`
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-6xl lg:text-5xl font-bold tracking-tight transition-colors animate-count-up"
              style={{ color: scoreColor }}
            >
              {animatedScore}
            </span>
            <span className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">out of 100</span>
            <span
              className="text-xs font-semibold mt-2 px-3 py-1 rounded-full uppercase tracking-wide"
              style={{ backgroundColor: `${scoreColor}15`, color: scoreColor }}
            >
              {scoreLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 lg:mt-2">
        <div className="horizontal-scroll !pb-2 !-mx-5 !px-5">
          {componentChips.map((chip) => (
            <div
              key={chip.name}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl ${chip.bgColor} min-w-fit`}
            >
              <chip.icon className={`w-4 h-4 ${chip.textColor}`} />
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {chip.name}
                </span>
                <span className={`text-sm font-bold ${chip.textColor}`}>
                  {chip.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {aiReasoning && (
        <div className="mt-3 p-3 bg-gradient-to-r from-primary/5 to-primaryAccent/5 dark:from-primary/10 dark:to-primaryAccent/10 rounded-xl border border-primary/10 dark:border-primary/20">
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            <span className="font-semibold text-primary">AI Analysis: </span>
            {aiReasoning}
          </p>
        </div>
      )}
    </div>
  );
}
