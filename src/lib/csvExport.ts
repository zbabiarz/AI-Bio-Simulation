import { UserProfile } from '../types';
import { format, parseISO, getWeek, getYear } from 'date-fns';

export type ExportFormat = 'basic' | 'standard' | 'research';

interface HealthMetricRow {
  date: string;
  hrv: number | null;
  resting_hr: number | null;
  deep_sleep_minutes: number | null;
  sleep_score: number | null;
  recovery_score: number | null;
  steps: number | null;
}

interface HealthScoreRow {
  date: string;
  overall_score: number;
  hrv_score: number | null;
  sleep_score: number | null;
  recovery_score: number | null;
  activity_score: number | null;
  hrv_weight: number | null;
  sleep_weight: number | null;
  recovery_weight: number | null;
  activity_weight: number | null;
  ai_reasoning: string | null;
}

interface AnomalyRow {
  detected_at: string;
  metric_type: string;
  detected_value: number;
  baseline_value: number;
  deviation_amount: number;
  severity: string;
}

interface PersonalRecordRow {
  metric_type: string;
  record_value: number;
  previous_record: number | null;
  achieved_date: string;
  record_scope: string;
}

interface AIInsightRow {
  generated_at: string;
  insight_type: string;
  insight_text: string;
  source_metrics: string[];
  why_it_matters: string | null;
}

interface BiosimulationSession {
  id: string;
  hrv_classification: string;
  deep_sleep_classification: string;
  avg_hrv: number;
  avg_deep_sleep_minutes: number;
  data_days_analyzed: number;
  dementia_risk: Record<string, unknown>;
  cardiovascular_risk: Record<string, unknown>;
  heart_failure_risk: Record<string, unknown>;
  cognitive_decline_risk: Record<string, unknown>;
  metabolic_risk: Record<string, unknown>;
  clinical_narrative: string | null;
  recommendations: string[];
  created_at: string;
}

interface UserWithSessions {
  user: UserProfile;
  sessions: BiosimulationSession[];
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function getRiskValue(risk: Record<string, unknown>): number {
  return (risk as { current?: number })?.current || 0;
}

export function generateUserCSV(users: UserProfile[]): string {
  const headers = [
    'User ID',
    'Full Name',
    'Email',
    'Admin',
    'Onboarding Completed',
    'Created Date',
    'Last Updated',
  ];

  const rows = users.map((user) => [
    escapeCSV(user.id),
    escapeCSV(user.full_name),
    escapeCSV(user.email),
    escapeCSV(user.is_admin ? 'Yes' : 'No'),
    escapeCSV(user.onboarding_completed ? 'Yes' : 'No'),
    escapeCSV(format(parseISO(user.created_at), 'yyyy-MM-dd HH:mm:ss')),
    escapeCSV(format(parseISO(user.updated_at), 'yyyy-MM-dd HH:mm:ss')),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function generateUserWithSimulationsCSV(usersWithSessions: UserWithSessions[]): string {
  const headers = [
    'User ID',
    'Full Name',
    'Email',
    'Admin',
    'Onboarding Completed',
    'Created Date',
    'Last Updated',
    'Simulation ID',
    'Simulation Date',
    'Days Analyzed',
    'HRV Classification',
    'Avg HRV (ms)',
    'Deep Sleep Classification',
    'Avg Deep Sleep (min)',
    'Dementia Risk (%)',
    'Cardiovascular Risk (%)',
    'Heart Failure Risk (%)',
    'Cognitive Decline Risk (%)',
    'Metabolic Risk (%)',
    'Clinical Narrative',
    'Recommendations',
  ];

  const rows: string[][] = [];

  usersWithSessions.forEach(({ user, sessions }) => {
    if (sessions.length === 0) {
      rows.push([
        escapeCSV(user.id),
        escapeCSV(user.full_name),
        escapeCSV(user.email),
        escapeCSV(user.is_admin ? 'Yes' : 'No'),
        escapeCSV(user.onboarding_completed ? 'Yes' : 'No'),
        escapeCSV(format(parseISO(user.created_at), 'yyyy-MM-dd HH:mm:ss')),
        escapeCSV(format(parseISO(user.updated_at), 'yyyy-MM-dd HH:mm:ss')),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ]);
    } else {
      sessions.forEach((session) => {
        rows.push([
          escapeCSV(user.id),
          escapeCSV(user.full_name),
          escapeCSV(user.email),
          escapeCSV(user.is_admin ? 'Yes' : 'No'),
          escapeCSV(user.onboarding_completed ? 'Yes' : 'No'),
          escapeCSV(format(parseISO(user.created_at), 'yyyy-MM-dd HH:mm:ss')),
          escapeCSV(format(parseISO(user.updated_at), 'yyyy-MM-dd HH:mm:ss')),
          escapeCSV(session.id),
          escapeCSV(format(parseISO(session.created_at), 'yyyy-MM-dd HH:mm:ss')),
          escapeCSV(session.data_days_analyzed),
          escapeCSV(session.hrv_classification),
          escapeCSV(session.avg_hrv.toFixed(2)),
          escapeCSV(session.deep_sleep_classification),
          escapeCSV(session.avg_deep_sleep_minutes),
          escapeCSV(getRiskValue(session.dementia_risk).toFixed(1)),
          escapeCSV(getRiskValue(session.cardiovascular_risk).toFixed(1)),
          escapeCSV(getRiskValue(session.heart_failure_risk).toFixed(1)),
          escapeCSV(getRiskValue(session.cognitive_decline_risk).toFixed(1)),
          escapeCSV(getRiskValue(session.metabolic_risk).toFixed(1)),
          escapeCSV(session.clinical_narrative),
          escapeCSV(session.recommendations?.join('; ')),
        ]);
      });
    }
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function generateHealthMetricsCSV(
  metrics: HealthMetricRow[],
  scores: HealthScoreRow[],
  anomalies: AnomalyRow[],
  exportFormat: ExportFormat = 'standard'
): string {
  const scoreMap = new Map(scores.map((s) => [s.date, s]));
  const anomalyMap = new Map<string, AnomalyRow[]>();
  anomalies.forEach((a) => {
    const date = a.detected_at.split('T')[0];
    if (!anomalyMap.has(date)) anomalyMap.set(date, []);
    anomalyMap.get(date)!.push(a);
  });

  let headers: string[];

  if (exportFormat === 'basic') {
    headers = [
      'Date',
      'HRV (ms)',
      'Resting HR (bpm)',
      'Deep Sleep (min)',
      'Sleep Score',
      'Recovery Score',
      'Steps',
    ];
  } else if (exportFormat === 'standard') {
    headers = [
      'Date',
      'Week Number',
      'HRV (ms)',
      'Resting HR (bpm)',
      'Deep Sleep (min)',
      'Sleep Score',
      'Recovery Score',
      'Steps',
      'Health Score',
      'HRV Component Score',
      'Sleep Component Score',
      'Recovery Component Score',
      'Activity Component Score',
    ];
  } else {
    headers = [
      'Date',
      'Week Number',
      'Year',
      'HRV (ms)',
      'Resting HR (bpm)',
      'Deep Sleep (min)',
      'Sleep Score',
      'Recovery Score',
      'Steps',
      'Health Score',
      'HRV Component Score',
      'Sleep Component Score',
      'Recovery Component Score',
      'Activity Component Score',
      'HRV Weight',
      'Sleep Weight',
      'Recovery Weight',
      'Activity Weight',
      'AI Reasoning',
      'Has Anomaly',
      'Anomaly Types',
      'Anomaly Severities',
    ];
  }

  const rows = metrics.map((metric) => {
    const parsedDate = parseISO(metric.date);
    const score = scoreMap.get(metric.date);
    const dayAnomalies = anomalyMap.get(metric.date) || [];

    if (exportFormat === 'basic') {
      return [
        escapeCSV(format(parsedDate, 'yyyy-MM-dd')),
        escapeCSV(metric.hrv?.toFixed(1)),
        escapeCSV(metric.resting_hr?.toFixed(0)),
        escapeCSV(metric.deep_sleep_minutes?.toFixed(0)),
        escapeCSV(metric.sleep_score?.toFixed(0)),
        escapeCSV(metric.recovery_score?.toFixed(0)),
        escapeCSV(metric.steps?.toFixed(0)),
      ];
    } else if (exportFormat === 'standard') {
      return [
        escapeCSV(format(parsedDate, 'yyyy-MM-dd')),
        escapeCSV(getWeek(parsedDate)),
        escapeCSV(metric.hrv?.toFixed(1)),
        escapeCSV(metric.resting_hr?.toFixed(0)),
        escapeCSV(metric.deep_sleep_minutes?.toFixed(0)),
        escapeCSV(metric.sleep_score?.toFixed(0)),
        escapeCSV(metric.recovery_score?.toFixed(0)),
        escapeCSV(metric.steps?.toFixed(0)),
        escapeCSV(score?.overall_score),
        escapeCSV(score?.hrv_score),
        escapeCSV(score?.sleep_score),
        escapeCSV(score?.recovery_score),
        escapeCSV(score?.activity_score),
      ];
    } else {
      return [
        escapeCSV(format(parsedDate, 'yyyy-MM-dd')),
        escapeCSV(getWeek(parsedDate)),
        escapeCSV(getYear(parsedDate)),
        escapeCSV(metric.hrv?.toFixed(1)),
        escapeCSV(metric.resting_hr?.toFixed(0)),
        escapeCSV(metric.deep_sleep_minutes?.toFixed(0)),
        escapeCSV(metric.sleep_score?.toFixed(0)),
        escapeCSV(metric.recovery_score?.toFixed(0)),
        escapeCSV(metric.steps?.toFixed(0)),
        escapeCSV(score?.overall_score),
        escapeCSV(score?.hrv_score),
        escapeCSV(score?.sleep_score),
        escapeCSV(score?.recovery_score),
        escapeCSV(score?.activity_score),
        escapeCSV(score?.hrv_weight?.toFixed(3)),
        escapeCSV(score?.sleep_weight?.toFixed(3)),
        escapeCSV(score?.recovery_weight?.toFixed(3)),
        escapeCSV(score?.activity_weight?.toFixed(3)),
        escapeCSV(score?.ai_reasoning),
        escapeCSV(dayAnomalies.length > 0 ? 'Yes' : 'No'),
        escapeCSV(dayAnomalies.map((a) => a.metric_type).join('; ')),
        escapeCSV(dayAnomalies.map((a) => a.severity).join('; ')),
      ];
    }
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function generatePersonalRecordsCSV(records: PersonalRecordRow[]): string {
  const headers = [
    'Metric Type',
    'Record Value',
    'Previous Record',
    'Improvement (%)',
    'Achieved Date',
    'Record Scope',
  ];

  const rows = records.map((record) => {
    const improvement = record.previous_record !== null
      ? ((record.record_value - record.previous_record) / record.previous_record * 100).toFixed(1)
      : '';

    return [
      escapeCSV(record.metric_type),
      escapeCSV(record.record_value),
      escapeCSV(record.previous_record),
      escapeCSV(improvement),
      escapeCSV(format(parseISO(record.achieved_date), 'yyyy-MM-dd')),
      escapeCSV(record.record_scope),
    ];
  });

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function generateAnomaliesCSV(anomalies: AnomalyRow[]): string {
  const headers = [
    'Detected At',
    'Metric Type',
    'Detected Value',
    'Baseline Value',
    'Deviation (Std Dev)',
    'Severity',
  ];

  const rows = anomalies.map((anomaly) => [
    escapeCSV(format(parseISO(anomaly.detected_at), 'yyyy-MM-dd HH:mm:ss')),
    escapeCSV(anomaly.metric_type),
    escapeCSV(anomaly.detected_value.toFixed(2)),
    escapeCSV(anomaly.baseline_value.toFixed(2)),
    escapeCSV(anomaly.deviation_amount.toFixed(2)),
    escapeCSV(anomaly.severity),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function generateAIInsightsCSV(insights: AIInsightRow[]): string {
  const headers = [
    'Generated At',
    'Type',
    'Insight',
    'Source Metrics',
    'Why It Matters',
  ];

  const rows = insights.map((insight) => [
    escapeCSV(format(parseISO(insight.generated_at), 'yyyy-MM-dd HH:mm:ss')),
    escapeCSV(insight.insight_type),
    escapeCSV(insight.insight_text),
    escapeCSV(insight.source_metrics.join('; ')),
    escapeCSV(insight.why_it_matters),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

export function generateComprehensiveExportCSV(data: {
  metrics: HealthMetricRow[];
  scores: HealthScoreRow[];
  anomalies: AnomalyRow[];
  records: PersonalRecordRow[];
  insights: AIInsightRow[];
  profile: {
    email?: string;
    full_name?: string;
    age?: number;
    sex?: string;
  };
  exportFormat: ExportFormat;
}): string {
  const sections: string[] = [];

  sections.push('# AIMD Health Data Export');
  sections.push(`# Export Date: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`);
  sections.push(`# Export Format: ${data.exportFormat}`);
  sections.push(`# User: ${data.profile.full_name || 'N/A'} (${data.profile.email || 'N/A'})`);
  sections.push(`# Age: ${data.profile.age || 'N/A'}, Sex: ${data.profile.sex || 'N/A'}`);
  sections.push('');

  sections.push('## HEALTH METRICS');
  sections.push(generateHealthMetricsCSV(data.metrics, data.scores, data.anomalies, data.exportFormat));
  sections.push('');

  if (data.exportFormat !== 'basic' && data.records.length > 0) {
    sections.push('## PERSONAL RECORDS');
    sections.push(generatePersonalRecordsCSV(data.records));
    sections.push('');
  }

  if (data.exportFormat === 'research' && data.anomalies.length > 0) {
    sections.push('## ANOMALY HISTORY');
    sections.push(generateAnomaliesCSV(data.anomalies));
    sections.push('');
  }

  if (data.exportFormat === 'research' && data.insights.length > 0) {
    sections.push('## AI INSIGHTS');
    sections.push(generateAIInsightsCSV(data.insights));
  }

  return sections.join('\n');
}

export function getExportFilename(
  exportFormat: ExportFormat,
  userName?: string,
  dateRange?: { start: string; end: string }
): string {
  const sanitizedName = userName?.replace(/[^a-zA-Z0-9]/g, '_') || 'export';
  const dateStr = exportFormat === 'research' && dateRange
    ? `_${dateRange.start}_to_${dateRange.end}`
    : `_${format(new Date(), 'yyyy-MM-dd')}`;

  return `aimd_${sanitizedName}_${exportFormat}${dateStr}.csv`;
}
