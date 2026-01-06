import type { HRVClassification, DeepSleepClassification } from '../types';

interface ClassificationBadgeProps {
  type: 'hrv' | 'deepSleep';
  classification: HRVClassification | DeepSleepClassification;
  value: number;
  percentile: number;
}

export default function ClassificationBadge({ type, classification, value, percentile }: ClassificationBadgeProps) {
  const getConfig = () => {
    if (type === 'hrv') {
      switch (classification as HRVClassification) {
        case 'low':
          return {
            label: 'Low',
            bg: 'bg-red-100 dark:bg-red-900/30',
            border: 'border-red-300 dark:border-red-700',
            text: 'text-red-700 dark:text-red-300',
            indicator: 'bg-red-500',
          };
        case 'moderate':
          return {
            label: 'Moderate',
            bg: 'bg-amber-100 dark:bg-amber-900/30',
            border: 'border-amber-300 dark:border-amber-700',
            text: 'text-amber-700 dark:text-amber-300',
            indicator: 'bg-amber-500',
          };
        case 'favorable':
          return {
            label: 'Favorable',
            bg: 'bg-green-100 dark:bg-green-900/30',
            border: 'border-green-300 dark:border-green-700',
            text: 'text-green-700 dark:text-green-300',
            indicator: 'bg-green-500',
          };
      }
    } else {
      switch (classification as DeepSleepClassification) {
        case 'inadequate':
          return {
            label: 'Inadequate',
            bg: 'bg-red-100 dark:bg-red-900/30',
            border: 'border-red-300 dark:border-red-700',
            text: 'text-red-700 dark:text-red-300',
            indicator: 'bg-red-500',
          };
        case 'borderline':
          return {
            label: 'Borderline',
            bg: 'bg-amber-100 dark:bg-amber-900/30',
            border: 'border-amber-300 dark:border-amber-700',
            text: 'text-amber-700 dark:text-amber-300',
            indicator: 'bg-amber-500',
          };
        case 'adequate':
          return {
            label: 'Adequate',
            bg: 'bg-green-100 dark:bg-green-900/30',
            border: 'border-green-300 dark:border-green-700',
            text: 'text-green-700 dark:text-green-300',
            indicator: 'bg-green-500',
          };
      }
    }
  };

  const config = getConfig();
  const metricLabel = type === 'hrv' ? 'HRV' : 'Deep Sleep';
  const unit = type === 'hrv' ? 'ms' : 'min';

  return (
    <div className={`rounded-xl border ${config.bg} ${config.border} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{metricLabel}</span>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} border ${config.border}`}>
          <span className={`w-2 h-2 rounded-full ${config.indicator}`} />
          <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${config.text}`}>{value.toFixed(0)}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">{unit}</span>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Age-adjusted percentile</span>
          <span className={`font-medium ${config.text}`}>{percentile}th</span>
        </div>
      </div>
    </div>
  );
}
