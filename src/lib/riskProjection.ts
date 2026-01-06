import type { RiskTrajectory, HRVClassification, DeepSleepClassification, HealthIntakeData } from '../types';

interface RiskProjectionInput {
  hrvClassification: HRVClassification;
  deepSleepClassification: DeepSleepClassification;
  avgHrv: number;
  avgDeepSleep: number;
  intake: HealthIntakeData;
}

function getRiskLevel(score: number): RiskTrajectory['riskLevel'] {
  if (score < 15) return 'low';
  if (score < 30) return 'moderate';
  if (score < 50) return 'elevated';
  if (score < 70) return 'high';
  return 'critical';
}

function calculateAgeRiskMultiplier(age: number, baseAge: number = 40): number {
  const ageExcess = Math.max(0, age - baseAge);
  return 1 + (ageExcess * 0.025);
}

function projectTrajectory(
  baseRisk: number,
  annualProgression: number,
  intake: HealthIntakeData
): { sixMonths: number; oneYear: number; fiveYears: number; tenYears: number } {
  const ageMultiplier = calculateAgeRiskMultiplier(intake.age);
  const adjustedProgression = annualProgression * ageMultiplier;

  return {
    sixMonths: Math.min(95, baseRisk + (adjustedProgression * 0.5)),
    oneYear: Math.min(95, baseRisk + adjustedProgression),
    fiveYears: Math.min(95, baseRisk + (adjustedProgression * 4.2)),
    tenYears: Math.min(95, baseRisk + (adjustedProgression * 7.5)),
  };
}

export function calculateDementiaRisk(input: RiskProjectionInput): RiskTrajectory {
  const { deepSleepClassification, avgDeepSleep, intake, avgHrv } = input;

  let baseRisk = 8;
  const drivers: string[] = [];

  const deepSleepTarget = intake.age < 30 ? 90 : intake.age < 45 ? 75 : intake.age < 60 ? 60 : 50;
  const deepSleepDeficit = Math.max(0, deepSleepTarget - avgDeepSleep);
  const deepSleepRiskContribution = (deepSleepDeficit / deepSleepTarget) * 30;
  baseRisk += deepSleepRiskContribution;

  if (deepSleepClassification === 'inadequate') {
    drivers.push('Severely inadequate deep sleep');
  } else if (deepSleepClassification === 'borderline') {
    drivers.push('Suboptimal deep sleep duration');
  }

  if (avgDeepSleep < 45) {
    baseRisk += 8;
    drivers.push('Critical deep sleep deficit');
  }

  if (input.hrvClassification === 'low') {
    baseRisk += 10;
    drivers.push('Low HRV indicating autonomic dysfunction');
  }

  const ageRisk = Math.max(0, (intake.age - 45) * 0.8);
  baseRisk += ageRisk;
  if (intake.age > 55) {
    drivers.push('Age-related baseline risk');
  }

  if (intake.hasHeartFailure) {
    baseRisk += 12;
    drivers.push('Cardiovascular comorbidity');
  }
  if (intake.hasDiabetes) {
    baseRisk += 15;
    drivers.push('Metabolic dysfunction (diabetes)');
  }

  baseRisk = Math.min(85, baseRisk);

  const sleepFactor = Math.max(0.5, avgDeepSleep / deepSleepTarget);
  const baseProgression = 3.5;
  const annualProgression = baseProgression * (1 / sleepFactor);

  const trajectory = projectTrajectory(baseRisk, annualProgression, intake);

  return {
    current: baseRisk,
    ...trajectory,
    riskLevel: getRiskLevel(trajectory.fiveYears),
    primaryDrivers: drivers.slice(0, 3),
    trend: deepSleepClassification === 'inadequate' ? 'worsening' :
           deepSleepClassification === 'borderline' ? 'worsening' : 'stable',
  };
}

export function calculateCardiovascularRisk(input: RiskProjectionInput): RiskTrajectory {
  const { hrvClassification, avgHrv, intake } = input;

  let baseRisk = 6;
  const drivers: string[] = [];

  const hrvTarget = intake.age < 30 ? 60 : intake.age < 40 ? 48 : intake.age < 50 ? 38 : intake.age < 60 ? 30 : 24;
  const hrvDeficit = Math.max(0, hrvTarget - avgHrv);
  const hrvRiskContribution = (hrvDeficit / hrvTarget) * 28;
  baseRisk += hrvRiskContribution;

  if (hrvClassification === 'low') {
    drivers.push('Low HRV - reduced cardiac autonomic control');
  } else if (hrvClassification === 'moderate') {
    drivers.push('Suboptimal HRV levels');
  }

  if (avgHrv < 25) {
    baseRisk += 10;
    drivers.push('Critically depressed HRV');
  }

  if (input.deepSleepClassification === 'inadequate') {
    baseRisk += 8;
    drivers.push('Poor sleep quality affecting cardiovascular recovery');
  }

  const ageRisk = Math.max(0, (intake.age - 40) * 0.7);
  baseRisk += ageRisk;

  if (intake.sex === 'male') {
    baseRisk += 5;
    drivers.push('Male sex baseline risk');
  }

  if (intake.hasHeartFailure) {
    baseRisk += 25;
    drivers.push('Existing heart failure');
  }
  if (intake.hasDiabetes) {
    baseRisk += 18;
    drivers.push('Diabetes accelerating vascular damage');
  }
  if (intake.hasChronicKidneyDisease) {
    baseRisk += 15;
    drivers.push('CKD-associated cardiovascular burden');
  }

  baseRisk = Math.min(90, baseRisk);

  const hrvFactor = Math.max(0.4, avgHrv / hrvTarget);
  const baseProgression = 4.0;
  const annualProgression = baseProgression * (1 / hrvFactor);

  const trajectory = projectTrajectory(baseRisk, annualProgression, intake);

  return {
    current: baseRisk,
    ...trajectory,
    riskLevel: getRiskLevel(trajectory.fiveYears),
    primaryDrivers: drivers.slice(0, 3),
    trend: hrvClassification === 'low' ? 'worsening' :
           hrvClassification === 'moderate' ? 'worsening' : 'stable',
  };
}

export function calculateHeartFailureRisk(input: RiskProjectionInput): RiskTrajectory {
  const { hrvClassification, avgHrv, intake } = input;

  let baseRisk = intake.hasHeartFailure ? 45 : 4;
  const drivers: string[] = [];

  const hrvTarget = intake.age < 30 ? 60 : intake.age < 40 ? 48 : intake.age < 50 ? 38 : intake.age < 60 ? 30 : 24;

  if (intake.hasHeartFailure) {
    drivers.push('Existing heart failure diagnosis');

    const hrvDeficit = Math.max(0, hrvTarget - avgHrv);
    const hrvRiskContribution = (hrvDeficit / hrvTarget) * 22;
    baseRisk += hrvRiskContribution;

    if (hrvClassification === 'low') {
      drivers.push('Low HRV indicating poor prognosis');
    } else if (hrvClassification === 'moderate') {
      drivers.push('Suboptimal HRV levels');
    }

    if (avgHrv < 20) {
      baseRisk += 12;
      drivers.push('Severely depressed autonomic function');
    }
  } else {
    const hrvDeficit = Math.max(0, hrvTarget - avgHrv);
    const hrvRiskContribution = (hrvDeficit / hrvTarget) * 14;
    baseRisk += hrvRiskContribution;

    if (hrvClassification === 'low') {
      drivers.push('Low HRV - precursor to cardiac dysfunction');
    } else if (hrvClassification === 'moderate') {
      drivers.push('Suboptimal cardiac autonomic reserve');
    }
  }

  if (input.deepSleepClassification === 'inadequate') {
    baseRisk += 6;
    drivers.push('Inadequate restorative sleep');
  }

  const ageRisk = Math.max(0, (intake.age - 50) * 0.6);
  baseRisk += ageRisk;

  if (intake.hasDiabetes) {
    baseRisk += 12;
    drivers.push('Diabetic cardiomyopathy risk');
  }
  if (intake.hasChronicKidneyDisease) {
    baseRisk += 10;
    drivers.push('Cardiorenal syndrome pathway');
  }

  baseRisk = Math.min(92, baseRisk);

  const hrvFactor = Math.max(0.4, avgHrv / hrvTarget);
  const baseProgression = intake.hasHeartFailure ? 6.5 : 2.8;
  const annualProgression = baseProgression * (1 / hrvFactor);

  const trajectory = projectTrajectory(baseRisk, annualProgression, intake);

  return {
    current: baseRisk,
    ...trajectory,
    riskLevel: getRiskLevel(intake.hasHeartFailure ? trajectory.oneYear : trajectory.fiveYears),
    primaryDrivers: drivers.slice(0, 3),
    trend: intake.hasHeartFailure && hrvClassification === 'low' ? 'worsening' :
           intake.hasHeartFailure ? 'worsening' :
           hrvClassification === 'low' ? 'worsening' : 'stable',
  };
}

export function calculateCognitiveDeclineRisk(input: RiskProjectionInput): RiskTrajectory {
  const { deepSleepClassification, avgDeepSleep, hrvClassification, intake, avgHrv } = input;

  let baseRisk = 5;
  const drivers: string[] = [];

  const deepSleepTarget = intake.age < 30 ? 90 : intake.age < 45 ? 75 : intake.age < 60 ? 60 : 50;
  const deepSleepDeficit = Math.max(0, deepSleepTarget - avgDeepSleep);
  const deepSleepRiskContribution = (deepSleepDeficit / deepSleepTarget) * 25;
  baseRisk += deepSleepRiskContribution;

  if (deepSleepClassification === 'inadequate') {
    drivers.push('Inadequate deep sleep - impaired glymphatic clearance');
  } else if (deepSleepClassification === 'borderline') {
    drivers.push('Borderline deep sleep affecting brain restoration');
  }

  if (avgDeepSleep < 40) {
    baseRisk += 8;
    drivers.push('Severely reduced slow-wave sleep');
  }

  const hrvTarget = intake.age < 30 ? 60 : intake.age < 40 ? 48 : intake.age < 50 ? 38 : intake.age < 60 ? 30 : 24;
  const hrvDeficit = Math.max(0, hrvTarget - avgHrv);
  const hrvRiskContribution = (hrvDeficit / hrvTarget) * 10;
  baseRisk += hrvRiskContribution;

  if (hrvClassification === 'low') {
    drivers.push('Autonomic dysfunction affecting cerebral perfusion');
  }

  const ageRisk = Math.max(0, (intake.age - 40) * 0.9);
  baseRisk += ageRisk;
  if (intake.age > 50) {
    drivers.push('Age-related cognitive vulnerability');
  }

  if (intake.hasDiabetes) {
    baseRisk += 14;
    drivers.push('Diabetes-associated cognitive impairment');
  }
  if (intake.hasHeartFailure) {
    baseRisk += 10;
    drivers.push('Reduced cerebral perfusion from cardiac dysfunction');
  }

  baseRisk = Math.min(88, baseRisk);

  const sleepFactor = Math.max(0.5, avgDeepSleep / deepSleepTarget);
  const baseProgression = 3.0;
  const annualProgression = baseProgression * (1 / sleepFactor);

  const trajectory = projectTrajectory(baseRisk, annualProgression, intake);

  return {
    current: baseRisk,
    ...trajectory,
    riskLevel: getRiskLevel(trajectory.fiveYears),
    primaryDrivers: drivers.slice(0, 3),
    trend: deepSleepClassification === 'inadequate' ? 'worsening' :
           deepSleepClassification === 'borderline' ? 'worsening' : 'stable',
  };
}

export function calculateMetabolicRisk(input: RiskProjectionInput): RiskTrajectory {
  const { hrvClassification, deepSleepClassification, intake, avgHrv, avgDeepSleep } = input;

  let baseRisk = intake.hasDiabetes ? 40 : 6;
  const drivers: string[] = [];

  if (intake.hasDiabetes) {
    drivers.push('Existing metabolic dysfunction');
  }

  const hrvTarget = intake.age < 30 ? 60 : intake.age < 40 ? 48 : intake.age < 50 ? 38 : intake.age < 60 ? 30 : 24;
  const hrvDeficit = Math.max(0, hrvTarget - avgHrv);
  const hrvRiskContribution = (hrvDeficit / hrvTarget) * 18;
  baseRisk += hrvRiskContribution;

  if (hrvClassification === 'low') {
    drivers.push('Autonomic imbalance affecting glucose regulation');
  } else if (hrvClassification === 'moderate') {
    drivers.push('Suboptimal autonomic metabolic control');
  }

  const deepSleepTarget = intake.age < 30 ? 90 : intake.age < 45 ? 75 : intake.age < 60 ? 60 : 50;
  const deepSleepDeficit = Math.max(0, deepSleepTarget - avgDeepSleep);
  const deepSleepRiskContribution = (deepSleepDeficit / deepSleepTarget) * 20;
  baseRisk += deepSleepRiskContribution;

  if (deepSleepClassification === 'inadequate') {
    drivers.push('Poor sleep disrupting metabolic hormones');
  } else if (deepSleepClassification === 'borderline') {
    drivers.push('Suboptimal sleep affecting insulin sensitivity');
  }

  const ageRisk = Math.max(0, (intake.age - 35) * 0.5);
  baseRisk += ageRisk;

  if (intake.hasChronicKidneyDisease) {
    baseRisk += 12;
    drivers.push('Renal dysfunction affecting metabolic clearance');
  }

  baseRisk = Math.min(85, baseRisk);

  const sleepFactor = Math.max(0.5, avgDeepSleep / deepSleepTarget);
  const hrvFactor = Math.max(0.4, avgHrv / hrvTarget);
  const combinedFactor = (sleepFactor + hrvFactor) / 2;
  const baseProgression = intake.hasDiabetes ? 4.5 : 2.5;
  const annualProgression = baseProgression * (1 / combinedFactor);

  const trajectory = projectTrajectory(baseRisk, annualProgression, intake);

  return {
    current: baseRisk,
    ...trajectory,
    riskLevel: getRiskLevel(intake.hasDiabetes ? trajectory.oneYear : trajectory.fiveYears),
    primaryDrivers: drivers.slice(0, 3),
    trend: (hrvClassification === 'low' || deepSleepClassification === 'inadequate') ? 'worsening' :
           (hrvClassification === 'moderate' || deepSleepClassification === 'borderline') ? 'worsening' : 'stable',
  };
}

export function generateAllRiskProjections(input: RiskProjectionInput): {
  dementia: RiskTrajectory;
  cardiovascular: RiskTrajectory;
  heartFailure: RiskTrajectory;
  cognitiveDecline: RiskTrajectory;
  metabolic: RiskTrajectory;
} {
  return {
    dementia: calculateDementiaRisk(input),
    cardiovascular: calculateCardiovascularRisk(input),
    heartFailure: calculateHeartFailureRisk(input),
    cognitiveDecline: calculateCognitiveDeclineRisk(input),
    metabolic: calculateMetabolicRisk(input),
  };
}

export function getWorstTrajectories(projections: ReturnType<typeof generateAllRiskProjections>): string[] {
  const sorted = Object.entries(projections)
    .map(([key, value]) => ({ key, fiveYear: value.fiveYears, level: value.riskLevel }))
    .sort((a, b) => b.fiveYear - a.fiveYear);

  return sorted.slice(0, 2).map(item => {
    const names: Record<string, string> = {
      dementia: 'Dementia',
      cardiovascular: 'Cardiovascular Disease',
      heartFailure: 'Heart Failure',
      cognitiveDecline: 'Cognitive Decline',
      metabolic: 'Metabolic Dysfunction',
    };
    return names[item.key] || item.key;
  });
}
