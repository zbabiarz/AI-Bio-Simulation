import type { RiskTrajectory, HRVClassification, DeepSleepClassification, HealthIntakeData } from '../types';

interface NarrativeInput {
  hrvClassification: HRVClassification;
  deepSleepClassification: DeepSleepClassification;
  avgHrv: number;
  avgDeepSleep: number;
  intake: HealthIntakeData;
  dementia: RiskTrajectory;
  cardiovascular: RiskTrajectory;
  heartFailure: RiskTrajectory;
  cognitiveDecline: RiskTrajectory;
  metabolic: RiskTrajectory;
}

function getHighestRisk(input: NarrativeInput): { name: string; risk: RiskTrajectory } {
  const risks = [
    { name: 'dementia', risk: input.dementia },
    { name: 'cardiovascular disease', risk: input.cardiovascular },
    { name: 'heart failure progression', risk: input.heartFailure },
    { name: 'cognitive decline', risk: input.cognitiveDecline },
    { name: 'metabolic dysfunction', risk: input.metabolic },
  ];

  return risks.reduce((highest, current) =>
    current.risk.fiveYears > highest.risk.fiveYears ? current : highest
  );
}

function getSecondHighestRisk(input: NarrativeInput): { name: string; risk: RiskTrajectory } {
  const risks = [
    { name: 'dementia', risk: input.dementia },
    { name: 'cardiovascular disease', risk: input.cardiovascular },
    { name: 'heart failure progression', risk: input.heartFailure },
    { name: 'cognitive decline', risk: input.cognitiveDecline },
    { name: 'metabolic dysfunction', risk: input.metabolic },
  ];

  const sorted = risks.sort((a, b) => b.risk.fiveYears - a.risk.fiveYears);
  return sorted[1];
}

function generateOpeningStatement(input: NarrativeInput): string {
  const highest = getHighestRisk(input);
  const criticalCount = [input.dementia, input.cardiovascular, input.heartFailure, input.cognitiveDecline, input.metabolic]
    .filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;

  if (criticalCount >= 3) {
    return `Your biosimulation results indicate a concerning pattern across multiple health domains. Your current physiological state places you on trajectories that, if unchanged, lead to significant health deterioration.`;
  }

  if (highest.risk.riskLevel === 'critical') {
    return `Your data reveals a critical risk trajectory for ${highest.name}. This is not a distant possibility - it is the direction your body is heading based on measurable physiological markers.`;
  }

  if (highest.risk.riskLevel === 'high') {
    return `The simulation has identified elevated risk trajectories that warrant immediate attention. Your current physiological patterns are consistent with accelerated health decline in key areas.`;
  }

  if (highest.risk.riskLevel === 'elevated') {
    return `Your biosimulation reveals trajectories that deserve attention. While not yet critical, the patterns in your data indicate a gradual drift toward outcomes you likely want to avoid.`;
  }

  return `Your biosimulation results show areas for optimization. While your immediate risk profile is manageable, certain patterns in your data suggest opportunities for meaningful intervention.`;
}

function generateDeepSleepNarrative(input: NarrativeInput): string {
  const { deepSleepClassification, avgDeepSleep, intake } = input;

  if (deepSleepClassification === 'inadequate') {
    const dementiaRisk = input.dementia.fiveYears;
    return `Your deep sleep duration of ${avgDeepSleep} minutes is inadequate. During deep sleep, your brain's glymphatic system clears metabolic waste including amyloid-beta, the protein implicated in Alzheimer's disease. With your current deep sleep deficit, this clearance process is compromised. Published research demonstrates that individuals with chronically low deep sleep have significantly higher rates of cognitive decline and dementia. At your current trajectory, your five-year dementia risk projection is ${dementiaRisk.toFixed(0)}%. This is not speculation - it is the mathematical consequence of insufficient neural restoration, night after night.`;
  }

  if (deepSleepClassification === 'borderline') {
    return `Your deep sleep duration of ${avgDeepSleep} minutes is borderline. You are obtaining some restorative sleep, but falling short of the threshold needed for optimal brain waste clearance and memory consolidation. Over time, this gap compounds. Your cognitive decline trajectory shows a ${input.cognitiveDecline.fiveYears.toFixed(0)}% five-year risk - a figure that could be substantially reduced with improved deep sleep architecture.`;
  }

  return `Your deep sleep duration of ${avgDeepSleep} minutes is adequate for your age. This supports essential restorative processes including glymphatic clearance and memory consolidation.`;
}

function generateHRVNarrative(input: NarrativeInput): string {
  const { hrvClassification, avgHrv, intake } = input;

  if (hrvClassification === 'low') {
    const cvRisk = input.cardiovascular.fiveYears;
    let narrative = `Your HRV of ${avgHrv.toFixed(0)}ms is low. Heart rate variability reflects your autonomic nervous system's ability to adapt to stress and maintain cardiovascular homeostasis. Low HRV is not merely a fitness metric - it is a validated predictor of cardiovascular events, all-cause mortality, and accelerated aging.`;

    if (intake.hasHeartFailure) {
      narrative += ` Given your existing heart failure diagnosis, this finding is particularly significant. Low HRV in heart failure patients is associated with increased risk of hospitalization and adverse cardiac events. Your heart failure trajectory shows a ${input.heartFailure.fiveYears.toFixed(0)}% five-year risk of progression.`;
    } else {
      narrative += ` Your five-year cardiovascular risk projection is ${cvRisk.toFixed(0)}%. This represents the cumulative effect of chronic autonomic dysregulation on your vascular system.`;
    }

    return narrative;
  }

  if (hrvClassification === 'moderate') {
    return `Your HRV of ${avgHrv.toFixed(0)}ms is moderate. While not critically low, this level indicates reduced autonomic flexibility compared to optimal. Your cardiovascular risk trajectory of ${input.cardiovascular.fiveYears.toFixed(0)}% over five years reflects this suboptimal autonomic state.`;
  }

  return `Your HRV of ${avgHrv.toFixed(0)}ms is favorable for your age, indicating healthy autonomic function and cardiovascular resilience.`;
}

function generateConditionSpecificNarrative(input: NarrativeInput): string {
  const { intake } = input;
  const narratives: string[] = [];

  if (intake.hasHeartFailure) {
    narratives.push(`Your existing heart failure diagnosis means these physiological markers carry additional weight. Every point of HRV, every minute of deep sleep, directly influences your cardiac function and prognosis.`);
  }

  if (intake.hasDiabetes) {
    const metabolicRisk = input.metabolic.fiveYears;
    narratives.push(`Your diabetes diagnosis creates interconnected risk pathways. Poor sleep and low HRV both worsen glycemic control, while hyperglycemia further damages autonomic function. Your metabolic trajectory shows ${metabolicRisk.toFixed(0)}% five-year risk - this bidirectional relationship must be addressed.`);
  }

  if (intake.hasChronicKidneyDisease) {
    narratives.push(`Chronic kidney disease amplifies cardiovascular and metabolic risks. Your autonomic and sleep patterns directly affect renal perfusion and disease progression.`);
  }

  return narratives.join(' ');
}

function generateClosingStatement(input: NarrativeInput): string {
  const highest = getHighestRisk(input);
  const second = getSecondHighestRisk(input);

  if (highest.risk.riskLevel === 'critical' || highest.risk.riskLevel === 'high') {
    return `The trajectories shown are not predetermined. They represent what happens if nothing changes. Your ${highest.name} and ${second.name} risks are the most urgent areas requiring intervention. These projections are based on established clinical associations between physiological markers and disease outcomes. What you do next determines which trajectory you follow.`;
  }

  return `These projections represent your current trajectory based on measured physiological patterns. Strategic intervention in sleep architecture and autonomic function can meaningfully alter these outcomes. The data indicates where to focus.`;
}

export function generateClinicalNarrative(input: NarrativeInput): string {
  const sections = [
    generateOpeningStatement(input),
    '',
    generateDeepSleepNarrative(input),
    '',
    generateHRVNarrative(input),
  ];

  const conditionNarrative = generateConditionSpecificNarrative(input);
  if (conditionNarrative) {
    sections.push('', conditionNarrative);
  }

  sections.push('', generateClosingStatement(input));

  return sections.join('\n');
}

export function generateRecommendations(input: NarrativeInput): string[] {
  const recommendations: string[] = [];

  if (input.deepSleepClassification === 'inadequate' || input.deepSleepClassification === 'borderline') {
    recommendations.push('Prioritize deep sleep optimization through sleep hygiene, timing, and environmental factors');
    recommendations.push('Consider professional sleep assessment to identify barriers to restorative sleep');
  }

  if (input.hrvClassification === 'low') {
    recommendations.push('Address autonomic dysfunction through stress management and recovery protocols');
    recommendations.push('Evaluate cardiovascular status with a physician given low HRV findings');
  }

  if (input.hrvClassification === 'moderate') {
    recommendations.push('Implement HRV-guided training and recovery to improve autonomic flexibility');
  }

  if (input.intake.hasHeartFailure && input.hrvClassification === 'low') {
    recommendations.push('Urgent cardiology consultation recommended given HRV pattern with heart failure');
  }

  if (input.dementia.riskLevel === 'high' || input.dementia.riskLevel === 'critical') {
    recommendations.push('Cognitive baseline assessment and neuroprotective lifestyle intervention warranted');
  }

  if (input.metabolic.riskLevel === 'high' || input.metabolic.riskLevel === 'critical') {
    recommendations.push('Metabolic panel and glycemic management review with physician');
  }

  recommendations.push('Consider physician-guided intervention based on these simulation findings');

  return recommendations;
}
