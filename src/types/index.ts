export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  onboarding_completed: boolean;
  age: number | null;
  sex: 'male' | 'female' | 'other' | null;
  has_heart_failure: boolean;
  has_diabetes: boolean;
  has_chronic_kidney_disease: boolean;
  intake_completed: boolean;
  install_prompt_count: number;
  created_at: string;
  updated_at: string;
}

export interface HealthMetric {
  id: string;
  user_id: string;
  date: string;
  hrv: number | null;
  resting_heart_rate: number | null;
  sleep_duration_minutes: number | null;
  sleep_efficiency: number | null;
  deep_sleep_minutes: number | null;
  rem_sleep_minutes: number | null;
  light_sleep_minutes: number | null;
  steps: number | null;
  active_calories: number | null;
  total_calories: number | null;
  activity_minutes: number | null;
  stress_level: number | null;
  recovery_score: number | null;
  body_battery: number | null;
  weight_kg: number | null;
  body_fat_percentage: number | null;
  source: string;
  created_at: string;
}

export type HRVClassification = 'low' | 'moderate' | 'favorable';
export type DeepSleepClassification = 'inadequate' | 'borderline' | 'adequate';

export interface RiskTrajectory {
  current: number;
  sixMonths: number;
  oneYear: number;
  fiveYears: number;
  tenYears: number;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
  primaryDrivers: string[];
  trend: 'improving' | 'stable' | 'worsening';
}

export interface BiosimulationSession {
  id: string;
  user_id: string;
  hrv_classification: HRVClassification;
  deep_sleep_classification: DeepSleepClassification;
  avg_hrv: number;
  avg_deep_sleep_minutes: number;
  data_days_analyzed: number;
  dementia_risk: RiskTrajectory;
  cardiovascular_risk: RiskTrajectory;
  heart_failure_risk: RiskTrajectory;
  cognitive_decline_risk: RiskTrajectory;
  metabolic_risk: RiskTrajectory;
  clinical_narrative: string | null;
  ai_narrative: string | null;
  ai_narrative_tokens_used: number;
  recommendations: string[];
  created_at: string;
}

export interface AIExplanationCache {
  id: string;
  user_id: string;
  explanation_type: 'narrative' | 'whatif';
  input_hash: string;
  prompt: string;
  response: string;
  tokens_used: number;
  created_at: string;
}

export interface PhysiologicalClassification {
  hrv: {
    value: number;
    classification: HRVClassification;
    percentile: number;
    ageAdjusted: boolean;
  };
  deepSleep: {
    value: number;
    classification: DeepSleepClassification;
    percentile: number;
    ageAdjusted: boolean;
  };
}

export interface HealthIntakeData {
  age: number;
  sex: 'male' | 'female' | 'other';
  hasHeartFailure: boolean;
  hasDiabetes: boolean;
  hasChronicKidneyDisease: boolean;
}

export interface MetricsSummary {
  avgHrv: number | null;
  avgRestingHr: number | null;
  avgSleepDuration: number | null;
  avgSleepEfficiency: number | null;
  avgDeepSleep: number | null;
  avgSteps: number | null;
  avgRecoveryScore: number | null;
  totalActiveDays: number;
}

export interface PHIAccessLog {
  id: string;
  user_id: string;
  target_user_id: string | null;
  access_type: 'view' | 'create' | 'update' | 'delete' | 'export';
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  event_type: 'login' | 'logout' | 'failed_login' | 'password_change' | 'data_export' | 'account_deletion' | 'suspicious_activity' | 'mfa_enabled' | 'mfa_disabled' | 'session_timeout';
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

export interface DataRetentionSettings {
  id: string;
  user_id: string;
  retention_days: number;
  auto_delete_enabled: boolean;
  last_activity_at: string;
  scheduled_deletion_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserConsent {
  id: string;
  user_id: string;
  consent_type: 'privacy_policy' | 'terms_of_service' | 'data_processing' | 'hipaa_authorization' | 'marketing';
  consented: boolean;
  version: string;
  ip_address: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface DataAccessRequest {
  id: string;
  user_id: string;
  request_type: 'export' | 'deletion' | 'amendment' | 'access';
  status: 'pending' | 'processing' | 'completed' | 'denied';
  description: string | null;
  requested_at: string;
  completed_at: string | null;
  processed_by: string | null;
  notes: string | null;
}
