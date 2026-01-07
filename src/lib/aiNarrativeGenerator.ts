import { generateAIContent } from './openai';
import type { RiskTrajectory, HRVClassification, DeepSleepClassification, HealthIntakeData, PhysiologicalClassification } from '../types';

interface NarrativeGenerationInput {
  classification: PhysiologicalClassification;
  avgHrv: number;
  avgDeepSleep: number;
  intake: HealthIntakeData;
  projections: {
    dementia: RiskTrajectory;
    cardiovascular: RiskTrajectory;
    heartFailure: RiskTrajectory;
    cognitiveDecline: RiskTrajectory;
    metabolic: RiskTrajectory;
  };
  templateNarrative: string;
}

interface WhatIfExplanationInput {
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

function buildNarrativePrompt(input: NarrativeGenerationInput): string {
  const { classification, avgHrv, avgDeepSleep, intake, projections, templateNarrative } = input;

  const conditions: string[] = [];
  if (intake.hasHeartFailure) conditions.push('heart failure');
  if (intake.hasDiabetes) conditions.push('diabetes');
  if (intake.hasChronicKidneyDisease) conditions.push('chronic kidney disease');

  const conditionsText = conditions.length > 0
    ? `Medical conditions: ${conditions.join(', ')}`
    : 'No significant medical conditions';

  return `You are a clinical health analyst generating a personalized biosimulation narrative for a patient. Your role is to communicate serious health information with clinical precision while being direct and personal.

PATIENT PROFILE:
- Age: ${intake.age} years old
- Sex: ${intake.sex}
- ${conditionsText}

PHYSIOLOGICAL DATA:
- Average HRV: ${avgHrv.toFixed(0)}ms (Classification: ${classification.hrv.classification}, ${classification.hrv.percentile}th percentile for age)
- Average Deep Sleep: ${avgDeepSleep.toFixed(0)} minutes (Classification: ${classification.deepSleep.classification}, ${classification.deepSleep.percentile}th percentile for age)

5-YEAR RISK PROJECTIONS:
- Dementia Risk: ${projections.dementia.fiveYears.toFixed(1)}% (Level: ${projections.dementia.riskLevel})
- Cardiovascular Disease Risk: ${projections.cardiovascular.fiveYears.toFixed(1)}% (Level: ${projections.cardiovascular.riskLevel})
- Heart Failure Progression Risk: ${projections.heartFailure.fiveYears.toFixed(1)}% (Level: ${projections.heartFailure.riskLevel})
- Cognitive Decline Risk: ${projections.cognitiveDecline.fiveYears.toFixed(1)}% (Level: ${projections.cognitiveDecline.riskLevel})
- Metabolic Dysfunction Risk: ${projections.metabolic.fiveYears.toFixed(1)}% (Level: ${projections.metabolic.riskLevel})

REFERENCE NARRATIVE (for clinical accuracy):
${templateNarrative}

INSTRUCTIONS:
Generate a personalized clinical narrative that:
1. Addresses the patient directly using "you" and "your"
2. References their specific age (${intake.age}) and how it relates to their biological markers
3. Explains what their physiological data means for THEM specifically, given their age and conditions
4. If they have medical conditions, explain how their HRV and sleep patterns interact with those conditions
5. Uses specific numbers and percentages from their data
6. Maintains the clinical gravity of the template but personalizes it
7. Mentions how their markers compare to others their age (using percentile data)
8. Closes with actionable awareness without being preachy

Write 4-5 paragraphs. Be direct, clinical, and personal. Do not use bullet points. Do not use phrases like "I'm here to help" or similar platitudes. Speak as a clinical expert delivering important health information.`;
}

function buildWhatIfPrompt(input: WhatIfExplanationInput): string {
  const { intake, baselineHrv, baselineDeepSleep, adjustedHrv, adjustedDeepSleep, baselineProjections, adjustedProjections } = input;

  const hrvChange = adjustedHrv - baselineHrv;
  const deepSleepChange = adjustedDeepSleep - baselineDeepSleep;
  const hrvChangedSignificantly = Math.abs(hrvChange) > 1;
  const deepSleepChangedSignificantly = Math.abs(deepSleepChange) > 1;

  const conditions: string[] = [];
  if (intake.hasHeartFailure) conditions.push('heart failure');
  if (intake.hasDiabetes) conditions.push('diabetes');
  if (intake.hasChronicKidneyDisease) conditions.push('chronic kidney disease');

  const conditionsText = conditions.length > 0
    ? `They have: ${conditions.join(', ')}`
    : 'No significant medical conditions';

  let metricsDescription = '';
  if (hrvChangedSignificantly && deepSleepChangedSignificantly) {
    metricsDescription = `BOTH HRV (${baselineHrv.toFixed(0)}ms → ${adjustedHrv.toFixed(0)}ms, ${hrvChange > 0 ? '+' : ''}${hrvChange.toFixed(0)}ms) AND Deep Sleep (${baselineDeepSleep.toFixed(0)}min → ${adjustedDeepSleep.toFixed(0)}min, ${deepSleepChange > 0 ? '+' : ''}${deepSleepChange.toFixed(0)}min)`;
  } else if (hrvChangedSignificantly) {
    metricsDescription = `HRV from ${baselineHrv.toFixed(0)}ms to ${adjustedHrv.toFixed(0)}ms (${hrvChange > 0 ? '+' : ''}${hrvChange.toFixed(0)}ms)`;
  } else {
    metricsDescription = `Deep Sleep from ${baselineDeepSleep.toFixed(0)}min to ${adjustedDeepSleep.toFixed(0)}min (${deepSleepChange > 0 ? '+' : ''}${deepSleepChange.toFixed(0)}min)`;
  }

  const riskChanges = [
    `Dementia: ${baselineProjections.dementia.fiveYears.toFixed(1)}% → ${adjustedProjections.dementia.fiveYears.toFixed(1)}%`,
    `Cardiovascular: ${baselineProjections.cardiovascular.fiveYears.toFixed(1)}% → ${adjustedProjections.cardiovascular.fiveYears.toFixed(1)}%`,
    `Heart Failure: ${baselineProjections.heartFailure.fiveYears.toFixed(1)}% → ${adjustedProjections.heartFailure.fiveYears.toFixed(1)}%`,
    `Cognitive Decline: ${baselineProjections.cognitiveDecline.fiveYears.toFixed(1)}% → ${adjustedProjections.cognitiveDecline.fiveYears.toFixed(1)}%`,
    `Metabolic: ${baselineProjections.metabolic.fiveYears.toFixed(1)}% → ${adjustedProjections.metabolic.fiveYears.toFixed(1)}%`,
  ].join('\n');

  return `You are a clinical health analyst explaining the biological mechanisms behind projected health improvements to a patient. Be scientifically accurate but accessible.

PATIENT: ${intake.age}-year-old ${intake.sex}. ${conditionsText}.

METRIC CHANGES: ${metricsDescription}

5-YEAR RISK CHANGES:
${riskChanges}

INSTRUCTIONS:
Explain in 2-3 sentences WHY these specific changes to ${hrvChangedSignificantly && deepSleepChangedSignificantly ? 'both HRV and deep sleep' : hrvChangedSignificantly ? 'HRV' : 'deep sleep'} lead to these risk reductions for THIS patient.

${hrvChangedSignificantly && deepSleepChangedSignificantly ? `Focus on the SYNERGISTIC effect: how improving both metrics together creates compounding benefits. Explain how better HRV and better deep sleep reinforce each other physiologically.` : ''}

${intake.hasHeartFailure ? 'Given their heart failure, emphasize the cardiac implications.' : ''}
${intake.hasDiabetes ? 'Given their diabetes, emphasize metabolic and autonomic implications.' : ''}

Use their specific age and numbers. Be direct and clinical. No fluff, no encouragement, just explain the mechanism.`;
}

export async function generateAIPersonalizedNarrative(
  input: NarrativeGenerationInput
): Promise<{ narrative: string; tokensUsed: number }> {
  const prompt = buildNarrativePrompt(input);

  const result = await generateAIContent({
    prompt,
    maxTokens: 1500,
  });

  return {
    narrative: result.content,
    tokensUsed: result.tokensUsed,
  };
}

export async function generateWhatIfExplanation(
  input: WhatIfExplanationInput
): Promise<{ explanation: string; tokensUsed: number }> {
  const prompt = buildWhatIfPrompt(input);

  const result = await generateAIContent({
    prompt,
    maxTokens: 300,
  });

  return {
    explanation: result.content,
    tokensUsed: result.tokensUsed,
  };
}

export function createExplanationCacheKey(
  userId: string,
  baselineHrv: number,
  baselineDeepSleep: number,
  adjustedHrv: number,
  adjustedDeepSleep: number
): string {
  return `${userId}-${Math.round(baselineHrv)}-${Math.round(baselineDeepSleep)}-${Math.round(adjustedHrv)}-${Math.round(adjustedDeepSleep)}`;
}
