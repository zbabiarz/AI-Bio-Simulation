import { TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { formatMetricName, formatMetricValue } from '../lib/analytics';
import { format, parseISO, startOfWeek, endOfWeek, subWeeks } from 'date-fns';

interface MetricComparison {
  name: string;
  metricType: string;
  thisWeek: number | null;
  lastWeek: number | null;
  changePct: number | null;
  unit: string;
}

interface WeeklyComparisonCardProps {
  thisWeekData: {
    avgHrv: number | null;
    avgDeepSleep: number | null;
    avgRecovery: number | null;
    avgSteps: number | null;
    avgHealthScore: number | null;
  };
  lastWeekData: {
    avgHrv: number | null;
    avgDeepSleep: number | null;
    avgRecovery: number | null;
    avgSteps: number | null;
    avgHealthScore: number | null;
  } | null;
  loading?: boolean;
}

export default function WeeklyComparisonCard({
  thisWeekData,
  lastWeekData,
  loading = false,
}: WeeklyComparisonCardProps) {
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  const calculateChange = (current: number | null, previous: number | null): number | null => {
    if (current === null || previous === null || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const metrics: MetricComparison[] = [
    {
      name: 'Health Score',
      metricType: 'health_score',
      thisWeek: thisWeekData.avgHealthScore,
      lastWeek: lastWeekData?.avgHealthScore ?? null,
      changePct: calculateChange(thisWeekData.avgHealthScore, lastWeekData?.avgHealthScore ?? null),
      unit: '',
    },
    {
      name: 'HRV',
      metricType: 'hrv',
      thisWeek: thisWeekData.avgHrv,
      lastWeek: lastWeekData?.avgHrv ?? null,
      changePct: calculateChange(thisWeekData.avgHrv, lastWeekData?.avgHrv ?? null),
      unit: 'ms',
    },
    {
      name: 'Deep Sleep',
      metricType: 'deep_sleep',
      thisWeek: thisWeekData.avgDeepSleep,
      lastWeek: lastWeekData?.avgDeepSleep ?? null,
      changePct: calculateChange(thisWeekData.avgDeepSleep, lastWeekData?.avgDeepSleep ?? null),
      unit: 'min',
    },
    {
      name: 'Recovery',
      metricType: 'recovery',
      thisWeek: thisWeekData.avgRecovery,
      lastWeek: lastWeekData?.avgRecovery ?? null,
      changePct: calculateChange(thisWeekData.avgRecovery, lastWeekData?.avgRecovery ?? null),
      unit: '%',
    },
    {
      name: 'Steps',
      metricType: 'steps',
      thisWeek: thisWeekData.avgSteps,
      lastWeek: lastWeekData?.avgSteps ?? null,
      changePct: calculateChange(thisWeekData.avgSteps, lastWeekData?.avgSteps ?? null),
      unit: '',
    },
  ];

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Week over Week</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-200 dark:bg-slate-700 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Week over Week</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {format(thisWeekStart, 'MMM d')} - {format(thisWeekEnd, 'MMM d')} vs{' '}
              {format(lastWeekStart, 'MMM d')} - {format(lastWeekEnd, 'MMM d')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {metrics.map((metric) => {
          const isPositiveChange = metric.changePct !== null && metric.changePct > 0;
          const isNegativeChange = metric.changePct !== null && metric.changePct < 0;
          const noChange = metric.changePct !== null && metric.changePct === 0;
          const hasData = metric.thisWeek !== null;

          return (
            <div
              key={metric.name}
              className={`p-4 rounded-lg border ${
                isPositiveChange
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : isNegativeChange
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600'
              }`}
            >
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {metric.name}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {hasData
                  ? metric.metricType === 'steps'
                    ? Math.round(metric.thisWeek!).toLocaleString()
                    : `${Math.round(metric.thisWeek!)}${metric.unit}`
                  : '--'}
              </p>
              {metric.changePct !== null ? (
                <div className="flex items-center gap-1 mt-2">
                  {isPositiveChange ? (
                    <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : isNegativeChange ? (
                    <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <Minus className="w-4 h-4 text-gray-400" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      isPositiveChange
                        ? 'text-green-600 dark:text-green-400'
                        : isNegativeChange
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {isPositiveChange ? '+' : ''}
                    {metric.changePct.toFixed(1)}%
                  </span>
                </div>
              ) : (
                <div className="mt-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500">No previous data</span>
                </div>
              )}
              {metric.lastWeek !== null && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Last week:{' '}
                  {metric.metricType === 'steps'
                    ? Math.round(metric.lastWeek).toLocaleString()
                    : `${Math.round(metric.lastWeek)}${metric.unit}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
