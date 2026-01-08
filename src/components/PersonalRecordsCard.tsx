import { useState } from 'react';
import { Trophy, ChevronDown, Calendar, TrendingUp } from 'lucide-react';
import { formatMetricName, formatMetricValue } from '../lib/analytics';
import type { PersonalRecord } from '../lib/analytics';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface PersonalRecordsCardProps {
  records: PersonalRecord[];
  loading?: boolean;
}

export default function PersonalRecordsCard({ records, loading = false }: PersonalRecordsCardProps) {
  const [expanded, setExpanded] = useState(false);

  const allTimeRecords = records.filter((r) => r.recordScope === 'all_time');
  const displayRecords = expanded ? allTimeRecords : allTimeRecords.slice(0, 3);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Records</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-200 dark:bg-slate-700 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (allTimeRecords.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
            <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Records</h3>
        </div>
        <div className="text-center py-8">
          <Trophy className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Start tracking your health data to set personal records!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
          <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Records</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">All-time bests</p>
        </div>
      </div>

      <div className="space-y-3">
        {displayRecords.map((record, index) => {
          const improvement =
            record.previousRecord !== null
              ? ((record.recordValue - record.previousRecord) / record.previousRecord) * 100
              : null;

          const isRecentRecord = new Date(record.achievedDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          return (
            <div
              key={record.id}
              className={`p-4 rounded-lg border transition-all ${
                isRecentRecord
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                  : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0
                        ? 'bg-yellow-400 text-yellow-900'
                        : index === 1
                        ? 'bg-gray-300 text-gray-700'
                        : index === 2
                        ? 'bg-amber-600 text-amber-100'
                        : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {index < 3 ? ['1', '2', '3'][index] : index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatMetricName(record.metricType)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(parseISO(record.achievedDate), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatMetricValue(record.metricType, record.recordValue)}
                  </p>
                  {improvement !== null && (
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      <span className="text-xs text-green-600 dark:text-green-400">
                        +{Math.abs(improvement).toFixed(1)}% improvement
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {isRecentRecord && (
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-xs px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded-full font-medium">
                    New Record!
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {allTimeRecords.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          {expanded ? 'Show Less' : `Show ${allTimeRecords.length - 3} More`}
          <ChevronDown
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
}
