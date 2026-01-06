import type { HRVClassification, DeepSleepClassification, PhysiologicalClassification, HealthIntakeData } from '../types';

interface AgeBasedThresholds {
  hrvLow: number;
  hrvModerate: number;
  deepSleepInadequate: number;
  deepSleepBorderline: number;
}

function getAgeBasedThresholds(age: number, sex: 'male' | 'female' | 'other'): AgeBasedThresholds {
  const sexMultiplier = sex === 'female' ? 1.05 : 1.0;

  if (age < 30) {
    return {
      hrvLow: 35 * sexMultiplier,
      hrvModerate: 55 * sexMultiplier,
      deepSleepInadequate: 60,
      deepSleepBorderline: 90,
    };
  } else if (age < 45) {
    return {
      hrvLow: 30 * sexMultiplier,
      hrvModerate: 45 * sexMultiplier,
      deepSleepInadequate: 50,
      deepSleepBorderline: 75,
    };
  } else if (age < 60) {
    return {
      hrvLow: 25 * sexMultiplier,
      hrvModerate: 38 * sexMultiplier,
      deepSleepInadequate: 40,
      deepSleepBorderline: 60,
    };
  } else {
    return {
      hrvLow: 20 * sexMultiplier,
      hrvModerate: 32 * sexMultiplier,
      deepSleepInadequate: 30,
      deepSleepBorderline: 50,
    };
  }
}

export function classifyHRV(
  hrvMs: number,
  intake: HealthIntakeData
): { classification: HRVClassification; percentile: number } {
  const thresholds = getAgeBasedThresholds(intake.age, intake.sex);

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

  let classification: HRVClassification;
  let percentile: number;

  if (adjustedHrv < thresholds.hrvLow) {
    classification = 'low';
    percentile = Math.min(25, Math.round((adjustedHrv / thresholds.hrvLow) * 25));
  } else if (adjustedHrv < thresholds.hrvModerate) {
    classification = 'moderate';
    const range = thresholds.hrvModerate - thresholds.hrvLow;
    const position = adjustedHrv - thresholds.hrvLow;
    percentile = 25 + Math.round((position / range) * 35);
  } else {
    classification = 'favorable';
    const aboveModerate = adjustedHrv - thresholds.hrvModerate;
    percentile = Math.min(99, 60 + Math.round((aboveModerate / 30) * 39));
  }

  return { classification, percentile };
}

export function classifyDeepSleep(
  deepSleepMinutes: number,
  intake: HealthIntakeData
): { classification: DeepSleepClassification; percentile: number } {
  const thresholds = getAgeBasedThresholds(intake.age, intake.sex);

  let adjustedMinutes = deepSleepMinutes;
  if (intake.age > 60) {
    adjustedMinutes *= 1.1;
  }

  let classification: DeepSleepClassification;
  let percentile: number;

  if (adjustedMinutes < thresholds.deepSleepInadequate) {
    classification = 'inadequate';
    percentile = Math.min(20, Math.round((adjustedMinutes / thresholds.deepSleepInadequate) * 20));
  } else if (adjustedMinutes < thresholds.deepSleepBorderline) {
    classification = 'borderline';
    const range = thresholds.deepSleepBorderline - thresholds.deepSleepInadequate;
    const position = adjustedMinutes - thresholds.deepSleepInadequate;
    percentile = 20 + Math.round((position / range) * 40);
  } else {
    classification = 'adequate';
    const aboveBorderline = adjustedMinutes - thresholds.deepSleepBorderline;
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

  const hrvDescriptions: Record<HRVClassification, string> = {
    low: `Your HRV of ${classification.hrv.value.toFixed(0)}ms falls in the low range for a ${ageGroup}. This indicates reduced autonomic flexibility and compromised stress adaptation capacity.`,
    moderate: `Your HRV of ${classification.hrv.value.toFixed(0)}ms is in the moderate range for a ${ageGroup}. While not critically low, there is meaningful room for improvement in your autonomic function.`,
    favorable: `Your HRV of ${classification.hrv.value.toFixed(0)}ms is favorable for a ${ageGroup}, indicating healthy autonomic nervous system function and good stress resilience.`,
  };

  const deepSleepDescriptions: Record<DeepSleepClassification, string> = {
    inadequate: `Your average deep sleep of ${classification.deepSleep.value} minutes is inadequate. Deep sleep is critical for cellular repair, memory consolidation, and metabolic waste clearance from the brain.`,
    borderline: `Your average deep sleep of ${classification.deepSleep.value} minutes is borderline. You are obtaining some restorative sleep, but falling short of optimal levels for long-term health protection.`,
    adequate: `Your average deep sleep of ${classification.deepSleep.value} minutes is adequate for your age, supporting essential restorative processes.`,
  };

  return {
    hrv: hrvDescriptions[classification.hrv.classification],
    deepSleep: deepSleepDescriptions[classification.deepSleep.classification],
  };
}
