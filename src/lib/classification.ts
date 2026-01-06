import type { HRVClassification, DeepSleepClassification, PhysiologicalClassification, HealthIntakeData } from '../types';

interface HRVReferenceRange {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

interface DeepSleepThresholds {
  inadequate: number;
  borderline: number;
}

function getHRVReferenceRange(age: number, sex: 'male' | 'female' | 'other'): HRVReferenceRange {
  const isMale = sex === 'male';

  if (age < 30) {
    return {
      p5: isMale ? 39 : 37,
      p25: isMale ? 55 : 52,
      p50: isMale ? 67.5 : 66,
      p75: isMale ? 80 : 78,
      p95: isMale ? 96 : 95,
    };
  } else if (age < 40) {
    return {
      p5: isMale ? 29 : 27,
      p25: isMale ? 40 : 37,
      p50: isMale ? 51 : 46.5,
      p75: isMale ? 62 : 56,
      p95: isMale ? 73 : 66,
    };
  } else if (age < 50) {
    return {
      p5: isMale ? 22 : 20,
      p25: isMale ? 30 : 28,
      p50: isMale ? 39.5 : 36,
      p75: isMale ? 48 : 44,
      p95: isMale ? 57 : 52,
    };
  } else if (age < 60) {
    return {
      p5: isMale ? 17 : 15,
      p25: isMale ? 24 : 22,
      p50: isMale ? 32.5 : 29,
      p75: isMale ? 40 : 36,
      p95: isMale ? 48 : 43,
    };
  } else if (age < 70) {
    return {
      p5: isMale ? 14 : 12,
      p25: isMale ? 20 : 18,
      p50: isMale ? 28 : 25,
      p75: isMale ? 36 : 32,
      p95: isMale ? 44 : 39,
    };
  } else {
    return {
      p5: isMale ? 12 : 10,
      p25: isMale ? 17 : 15,
      p50: isMale ? 24 : 21,
      p75: isMale ? 31 : 27,
      p95: isMale ? 38 : 33,
    };
  }
}

function getDeepSleepThresholds(age: number): DeepSleepThresholds {
  if (age < 30) {
    return {
      inadequate: 60,
      borderline: 90,
    };
  } else if (age < 45) {
    return {
      inadequate: 50,
      borderline: 75,
    };
  } else if (age < 60) {
    return {
      inadequate: 40,
      borderline: 60,
    };
  } else {
    return {
      inadequate: 30,
      borderline: 50,
    };
  }
}

function calculatePercentile(value: number, refRange: HRVReferenceRange): number {
  if (value <= refRange.p5) {
    return Math.max(1, Math.round((value / refRange.p5) * 5));
  } else if (value <= refRange.p25) {
    const range = refRange.p25 - refRange.p5;
    const position = value - refRange.p5;
    return 5 + Math.round((position / range) * 20);
  } else if (value <= refRange.p50) {
    const range = refRange.p50 - refRange.p25;
    const position = value - refRange.p25;
    return 25 + Math.round((position / range) * 25);
  } else if (value <= refRange.p75) {
    const range = refRange.p75 - refRange.p50;
    const position = value - refRange.p50;
    return 50 + Math.round((position / range) * 25);
  } else if (value <= refRange.p95) {
    const range = refRange.p95 - refRange.p75;
    const position = value - refRange.p75;
    return 75 + Math.round((position / range) * 20);
  } else {
    const excess = value - refRange.p95;
    const extraPoints = Math.min(4, Math.round((excess / refRange.p95) * 10));
    return Math.min(99, 95 + extraPoints);
  }
}

export function classifyHRV(
  hrvMs: number,
  intake: HealthIntakeData
): { classification: HRVClassification; percentile: number } {
  const refRange = getHRVReferenceRange(intake.age, intake.sex);

  let adjustedHrv = hrvMs;
  if (intake.hasHeartFailure) {
    adjustedHrv *= 0.85;
  }
  if (intake.hasDiabetes) {
    adjustedHrv *= 0.92;
  }
  if (intake.hasChronicKidneyDisease) {
    adjustedHrv *= 0.88;
  }

  const percentile = calculatePercentile(adjustedHrv, refRange);

  let classification: HRVClassification;
  if (percentile < 25) {
    classification = 'low';
  } else if (percentile < 60) {
    classification = 'moderate';
  } else {
    classification = 'favorable';
  }

  return { classification, percentile };
}

export function classifyDeepSleep(
  deepSleepMinutes: number,
  intake: HealthIntakeData
): { classification: DeepSleepClassification; percentile: number } {
  const thresholds = getDeepSleepThresholds(intake.age);

  let adjustedMinutes = deepSleepMinutes;
  if (intake.age > 60) {
    adjustedMinutes *= 1.1;
  }

  let classification: DeepSleepClassification;
  let percentile: number;

  if (adjustedMinutes < thresholds.inadequate) {
    classification = 'inadequate';
    percentile = Math.min(20, Math.round((adjustedMinutes / thresholds.inadequate) * 20));
  } else if (adjustedMinutes < thresholds.borderline) {
    classification = 'borderline';
    const range = thresholds.borderline - thresholds.inadequate;
    const position = adjustedMinutes - thresholds.inadequate;
    percentile = 20 + Math.round((position / range) * 40);
  } else {
    classification = 'adequate';
    const aboveBorderline = adjustedMinutes - thresholds.borderline;
    percentile = Math.min(99, 60 + Math.round((aboveBorderline / 60) * 39));
  }

  return { classification, percentile };
}

export function generatePhysiologicalClassification(
  avgHrv: number,
  avgDeepSleepMinutes: number,
  intake: HealthIntakeData
): PhysiologicalClassification {
  const hrvResult = classifyHRV(avgHrv, intake);
  const deepSleepResult = classifyDeepSleep(avgDeepSleepMinutes, intake);

  return {
    hrv: {
      value: avgHrv,
      classification: hrvResult.classification,
      percentile: hrvResult.percentile,
      ageAdjusted: true,
    },
    deepSleep: {
      value: avgDeepSleepMinutes,
      classification: deepSleepResult.classification,
      percentile: deepSleepResult.percentile,
      ageAdjusted: true,
    },
  };
}

export function getClassificationDescription(
  classification: PhysiologicalClassification,
  intake: HealthIntakeData
): { hrv: string; deepSleep: string } {
  const ageGroup = intake.age < 30 ? 'young adult' :
                   intake.age < 45 ? 'adult' :
                   intake.age < 60 ? 'middle-aged' : 'older adult';

  const refRange = getHRVReferenceRange(intake.age, intake.sex);
  const percentileText = `${classification.hrv.percentile}${getOrdinalSuffix(classification.hrv.percentile)} percentile`;

  const hrvDescriptions: Record<HRVClassification, string> = {
    low: `Your HRV of ${classification.hrv.value.toFixed(0)}ms falls in the low range (${percentileText}) for a ${ageGroup} ${intake.sex}. This is below the 25th percentile for your demographic (reference median: ${refRange.p50.toFixed(0)}ms), indicating reduced autonomic flexibility and compromised stress adaptation capacity.`,
    moderate: `Your HRV of ${classification.hrv.value.toFixed(0)}ms is in the moderate range (${percentileText}) for a ${ageGroup} ${intake.sex}. While not critically low, there is meaningful room for improvement toward the demographic median of ${refRange.p50.toFixed(0)}ms.`,
    favorable: `Your HRV of ${classification.hrv.value.toFixed(0)}ms is favorable (${percentileText}) for a ${ageGroup} ${intake.sex}, exceeding the demographic median of ${refRange.p50.toFixed(0)}ms. This indicates healthy autonomic nervous system function and good stress resilience.`,
  };

  const deepSleepDescriptions: Record<DeepSleepClassification, string> = {
    inadequate: `Your average deep sleep of ${classification.deepSleep.value} minutes is inadequate (${classification.deepSleep.percentile}${getOrdinalSuffix(classification.deepSleep.percentile)} percentile). Deep sleep is critical for cellular repair, memory consolidation, and metabolic waste clearance from the brain.`,
    borderline: `Your average deep sleep of ${classification.deepSleep.value} minutes is borderline (${classification.deepSleep.percentile}${getOrdinalSuffix(classification.deepSleep.percentile)} percentile). You are obtaining some restorative sleep, but falling short of optimal levels for long-term health protection.`,
    adequate: `Your average deep sleep of ${classification.deepSleep.value} minutes is adequate (${classification.deepSleep.percentile}${getOrdinalSuffix(classification.deepSleep.percentile)} percentile) for your age, supporting essential restorative processes.`,
  };

  return {
    hrv: hrvDescriptions[classification.hrv.classification],
    deepSleep: deepSleepDescriptions[classification.deepSleep.classification],
  };
}

function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

export function getHRVReferenceInfo(intake: HealthIntakeData): {
  range: HRVReferenceRange;
  description: string;
} {
  const range = getHRVReferenceRange(intake.age, intake.sex);
  const ageGroup = intake.age < 30 ? '20-30' :
                   intake.age < 40 ? '30-40' :
                   intake.age < 50 ? '40-50' :
                   intake.age < 60 ? '50-60' :
                   intake.age < 70 ? '60-70' : '70+';

  return {
    range,
    description: `Based on clinical reference data for ${intake.sex === 'male' ? 'men' : intake.sex === 'female' ? 'women' : 'adults'} aged ${ageGroup}, the median RMSSD HRV is ${range.p50.toFixed(0)}ms (5th-95th percentile: ${range.p5}-${range.p95}ms). HRV naturally declines with age, with 60-70 year olds showing approximately 60% of values seen in younger adults. Reference values are derived from 24-hour Holter recordings in healthy populations.`,
  };
}
