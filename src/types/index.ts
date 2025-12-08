export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  onboarding_completed: boolean;
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

export interface HealthGoal {
  id: string;
  user_id: string;
  metric_type: string;
  target_value: number;
  current_value: number;
  unit: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'activity' | 'sleep' | 'consistency' | 'milestone' | 'simulation';
  requirement_type: string;
  requirement_value: number;
  points: number;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

export interface Simulation {
  id: string;
  user_id: string;
  input_metrics: Record<string, number>;
  changes: Record<string, number>;
  predictions: SimulationPrediction;
  recommendations: string[];
  created_at: string;
}

export interface SimulationPrediction {
  fitness_impact: number;
  stress_reduction: number;
  recovery_improvement: number;
  sleep_quality_change: number;
  energy_level_change: number;
  timeframe_days: number;
  confidence: number;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface MetricsSummary {
  avgHrv: number | null;
  avgRestingHr: number | null;
  avgSleepDuration: number | null;
  avgSleepEfficiency: number | null;
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
