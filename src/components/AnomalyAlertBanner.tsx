import { useState } from 'react';
import { AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { formatMetricName, formatMetricValue } from '../lib/analytics';
import type { AnomalyAlert } from '../lib/analytics';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface AnomalyAlertBannerProps {
  alerts: AnomalyAlert[];
  onDismiss: (alertId: string) => void;
  onDismissAll: () => void;
}

export default function AnomalyAlertBanner({
  alerts,
  onDismiss,
  onDismissAll,
}: AnomalyAlertBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) return null;

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  const hasCritical = criticalAlerts.length > 0;

  const primaryAlert = hasCritical ? criticalAlerts[0] : warningAlerts[0];
  const remainingAlerts = alerts.filter((a) => a.id !== primaryAlert.id);

  const getDeviationText = (alert: AnomalyAlert): string => {
    const direction = alert.deviationAmount > 0 ? 'above' : 'below';
    const magnitude = Math.abs(alert.deviationAmount).toFixed(1);
    return `${magnitude} standard deviations ${direction} your baseline`;
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        hasCritical
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              hasCritical
                ? 'bg-red-100 dark:bg-red-900/50'
                : 'bg-amber-100 dark:bg-amber-900/50'
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 ${
                hasCritical
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4
                  className={`font-semibold ${
                    hasCritical
                      ? 'text-red-900 dark:text-red-200'
                      : 'text-amber-900 dark:text-amber-200'
                  }`}
                >
                  {hasCritical ? 'Unusual Reading Detected' : 'Notable Change Detected'}
                </h4>
                <p
                  className={`text-sm mt-1 ${
                    hasCritical
                      ? 'text-red-800 dark:text-red-300'
                      : 'text-amber-800 dark:text-amber-300'
                  }`}
                >
                  Your <strong>{formatMetricName(primaryAlert.metricType)}</strong> reading of{' '}
                  <strong>{formatMetricValue(primaryAlert.metricType, primaryAlert.detectedValue)}</strong>{' '}
                  is {getDeviationText(primaryAlert)} (baseline: {formatMetricValue(primaryAlert.metricType, primaryAlert.baselineValue)})
                </p>
                {primaryAlert.insight && (
                  <p
                    className={`text-sm mt-2 ${
                      hasCritical
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {primaryAlert.insight}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Detected {formatDistanceToNow(parseISO(primaryAlert.detectedAt), { addSuffix: true })}
                </p>
              </div>

              <button
                onClick={() => onDismiss(primaryAlert.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  hasCritical
                    ? 'hover:bg-red-200 dark:hover:bg-red-800'
                    : 'hover:bg-amber-200 dark:hover:bg-amber-800'
                }`}
                title="Dismiss"
              >
                <X
                  className={`w-4 h-4 ${
                    hasCritical
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                />
              </button>
            </div>

            {remainingAlerts.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-1 mt-3 text-sm font-medium ${
                  hasCritical
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide {remainingAlerts.length} more alert{remainingAlerts.length > 1 ? 's' : ''}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Show {remainingAlerts.length} more alert{remainingAlerts.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {expanded && remainingAlerts.length > 0 && (
          <div className="mt-4 space-y-3 pl-14">
            {remainingAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg flex items-start justify-between ${
                  alert.severity === 'critical'
                    ? 'bg-red-100 dark:bg-red-900/40'
                    : 'bg-amber-100 dark:bg-amber-900/40'
                }`}
              >
                <div>
                  <p
                    className={`text-sm font-medium ${
                      alert.severity === 'critical'
                        ? 'text-red-900 dark:text-red-200'
                        : 'text-amber-900 dark:text-amber-200'
                    }`}
                  >
                    {formatMetricName(alert.metricType)}:{' '}
                    {formatMetricValue(alert.metricType, alert.detectedValue)}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      alert.severity === 'critical'
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {getDeviationText(alert)}
                  </p>
                </div>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="p-1 hover:bg-white/50 dark:hover:bg-black/20 rounded"
                  title="Dismiss"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {alerts.length > 1 && (
        <div
          className={`px-4 py-2 border-t ${
            hasCritical
              ? 'border-red-200 dark:border-red-800 bg-red-100/50 dark:bg-red-900/30'
              : 'border-amber-200 dark:border-amber-800 bg-amber-100/50 dark:bg-amber-900/30'
          }`}
        >
          <button
            onClick={onDismissAll}
            className={`text-sm font-medium ${
              hasCritical
                ? 'text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100'
                : 'text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100'
            }`}
          >
            Dismiss All ({alerts.length})
          </button>
        </div>
      )}
    </div>
  );
}
