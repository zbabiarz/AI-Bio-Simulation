import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, AlertCircle, Database } from 'lucide-react';
import { generateWhatIfExplanation, createExplanationCacheKey } from '../lib/aiNarrativeGenerator';
import type { RiskTrajectory, HealthIntakeData, PhysiologicalClassification } from '../types';

interface WhatIfExplanationPanelProps {
  userId: string;
  intake: HealthIntakeData;
  classification: PhysiologicalClassification;
  baselineHrv: number;
  baselineDeepSleep: number;
  adjustedHrv: number;
  adjustedDeepSleep: number;
  baselineProjections: {
    dementia: RiskTrajectory;
    cardiovascular: RiskTrajectory;
    heartFailure: RiskTrajectory;
    cognitiveDecline: RiskTrajectory;
    metabolic: RiskTrajectory;
  };
  adjustedProjections: {
    dementia: RiskTrajectory;
    cardiovascular: RiskTrajectory;
    heartFailure: RiskTrajectory;
    cognitiveDecline: RiskTrajectory;
    metabolic: RiskTrajectory;
  };
}

interface CacheEntry {
  explanation: string;
  timestamp: number;
}

const CACHE_EXPIRY_MS = 1000 * 60 * 60;
const explanationCache = new Map<string, CacheEntry>();

export default function WhatIfExplanationPanel({
  userId,
  intake,
  classification,
  baselineHrv,
  baselineDeepSleep,
  adjustedHrv,
  adjustedDeepSleep,
  baselineProjections,
  adjustedProjections,
}: WhatIfExplanationPanelProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const hasSignificantChange =
    Math.abs(adjustedHrv - baselineHrv) > 1 ||
    Math.abs(adjustedDeepSleep - baselineDeepSleep) > 1;

  const generateExplanation = useCallback(async () => {
    if (!hasSignificantChange) {
      setExplanation(null);
      return;
    }

    const cacheKey = createExplanationCacheKey(
      userId,
      baselineHrv,
      baselineDeepSleep,
      adjustedHrv,
      adjustedDeepSleep
    );

    const cached = explanationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
      setExplanation(cached.explanation);
      setFromCache(true);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setFromCache(false);

    try {
      const result = await generateWhatIfExplanation({
        intake,
        classification,
        baselineHrv,
        baselineDeepSleep,
        adjustedHrv,
        adjustedDeepSleep,
        baselineProjections,
        adjustedProjections,
      });

      explanationCache.set(cacheKey, {
        explanation: result.explanation,
        timestamp: Date.now(),
      });

      setExplanation(result.explanation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate explanation');
    } finally {
      setIsLoading(false);
    }
  }, [
    userId,
    hasSignificantChange,
    intake,
    classification,
    baselineHrv,
    baselineDeepSleep,
    adjustedHrv,
    adjustedDeepSleep,
    baselineProjections,
    adjustedProjections,
  ]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!hasSignificantChange) {
      setExplanation(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      generateExplanation();
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [adjustedHrv, adjustedDeepSleep, generateExplanation, hasSignificantChange]);

  if (!hasSignificantChange) {
    return null;
  }

  return (
    <div className="mt-4 bg-gradient-to-r from-primary/5 to-blue-50 dark:from-primary/10 dark:to-slate-800/50 rounded-lg border border-primary/20 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {isLoading ? (
            <div className="w-8 h-8 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
          ) : (
            <div className="w-8 h-8 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Why This Matters
            </h4>
            {fromCache && !isLoading && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Database className="w-3 h-3" />
                cached
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-full" />
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-3/4" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : explanation ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {explanation}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
