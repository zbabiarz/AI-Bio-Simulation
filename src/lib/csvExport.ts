import { UserProfile } from '../types';
import { format, parseISO } from 'date-fns';

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
