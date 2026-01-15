import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  TrendingUp,
  Award,
  RefreshCw,
  ChevronDown,
  Database,
} from 'lucide-react';
import type { AIInsight } from '../lib/analytics';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface AIInsightsCarouselProps {
  insights: AIInsight[];
  loading?: boolean;
  onRefresh: () => void;
  refreshLoading?: boolean;
  lastRefreshBlocked?: boolean;
  hasHealthData?: boolean;
}

export default function AIInsightsCarousel({
  insights,
  loading = false,
  onRefresh,
  refreshLoading = false,
  lastRefreshBlocked = false,
  hasHealthData = true,
}: AIInsightsCarouselProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWhyItMatters, setShowWhyItMatters] = useState(false);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? insights.length - 1 : prev - 1));
    setShowWhyItMatters(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === insights.length - 1 ? 0 : prev + 1));
    setShowWhyItMatters(false);
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'celebration':
        return Award;
      case 'recommendation':
        return Lightbulb;
      default:
        return TrendingUp;
    }
  };

  const getInsightColors = (type: string) => {
    switch (type) {
      case 'celebration':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          icon: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400',
          text: 'text-green-900 dark:text-green-100',
          badge: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
        };
      case 'recommendation':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400',
          text: 'text-blue-900 dark:text-blue-100',
          badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-slate-700/50',
          border: 'border-gray-200 dark:border-slate-600',
          icon: 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-400',
          text: 'text-gray-900 dark:text-white',
          badge: 'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300',
        };
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Insights</h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 dark:bg-slate-700 rounded-lg" />
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-gray-300 dark:bg-slate-600" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Insights</h3>
          </div>
        </div>
        <div className="text-center py-8">
          {!hasHealthData ? (
            <>
              <Database className="w-12 h-12 text-amber-500 dark:text-amber-400 mx-auto mb-3" />
              <p className="text-gray-900 dark:text-white font-medium mb-2">
                No Health Data Available
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                Sync your wearable device first to generate personalized AI insights.
              </p>
              <button
                onClick={() => navigate('/devices')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primaryDark text-white rounded-lg transition-colors"
              >
                <Database className="w-4 h-4" />
                Sync Your Device
              </button>
            </>
          ) : (
            <>
              <Sparkles className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                No insights available yet. Generate personalized insights based on your health data.
              </p>
              <button
                onClick={onRefresh}
                disabled={refreshLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primaryDark text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {refreshLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Insights
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const currentInsight = insights[currentIndex];
  const InsightIcon = getInsightIcon(currentInsight.type);
  const colors = getInsightColors(currentInsight.type);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Insights</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Updated {formatDistanceToNow(parseISO(currentInsight.generatedAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshLoading || lastRefreshBlocked}
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          title={lastRefreshBlocked ? 'Limited to once per day' : 'Generate new insights'}
        >
          <RefreshCw className={`w-5 h-5 text-gray-500 dark:text-gray-400 ${refreshLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className={`p-5 rounded-lg border ${colors.bg} ${colors.border}`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.icon}`}>
            <InsightIcon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                {currentInsight.type === 'celebration'
                  ? 'Achievement'
                  : currentInsight.type === 'recommendation'
                  ? 'Recommendation'
                  : 'Observation'}
              </span>
            </div>
            <p className={`text-base font-medium ${colors.text}`}>{currentInsight.text}</p>

            {currentInsight.whyItMatters && (
              <div className="mt-3">
                <button
                  onClick={() => setShowWhyItMatters(!showWhyItMatters)}
                  className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showWhyItMatters ? 'rotate-180' : ''}`} />
                  Why this matters
                </button>
                {showWhyItMatters && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 pl-5 border-l-2 border-gray-200 dark:border-slate-600">
                    {currentInsight.whyItMatters}
                  </p>
                )}
              </div>
            )}

            {currentInsight.sources.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {currentInsight.sources.map((source) => (
                  <span
                    key={source}
                    className="text-xs px-2 py-1 bg-white/50 dark:bg-black/20 rounded text-gray-600 dark:text-gray-400"
                  >
                    {source.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {insights.length > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={goToPrevious}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>

          <div className="flex gap-2">
            {insights.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  setShowWhyItMatters(false);
                }}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-primary w-6'
                    : 'bg-gray-300 dark:bg-slate-600 hover:bg-gray-400 dark:hover:bg-slate-500'
                }`}
              />
            ))}
          </div>

          <button
            onClick={goToNext}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      )}

      {lastRefreshBlocked && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-3">
          New insights available tomorrow
        </p>
      )}
    </div>
  );
}
