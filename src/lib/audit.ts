import { supabase } from './supabase';

type AccessType = 'view' | 'create' | 'update' | 'delete' | 'export';
type EventType = 'login' | 'logout' | 'failed_login' | 'password_change' | 'data_export' | 'account_deletion' | 'suspicious_activity' | 'mfa_enabled' | 'mfa_disabled' | 'session_timeout';
type Severity = 'info' | 'warning' | 'critical';

export async function logPHIAccess(params: {
  userId: string;
  targetUserId?: string;
  accessType: AccessType;
  resourceType: string;
  resourceId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from('phi_access_logs').insert({
      user_id: params.userId,
      target_user_id: params.targetUserId || null,
      access_type: params.accessType,
      resource_type: params.resourceType,
      resource_id: params.resourceId || null,
      reason: params.reason || null,
      metadata: params.metadata || {},
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    console.error('Failed to log PHI access:', error);
  }
}

export async function logSecurityEvent(params: {
  eventType: EventType;
  userId?: string;
  details?: Record<string, unknown>;
  severity?: Severity;
}) {
  try {
    await supabase.from('security_events').insert({
      event_type: params.eventType,
      user_id: params.userId || null,
      details: params.details || {},
      severity: params.severity || 'info',
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

export async function updateLastActivity(userId: string) {
  try {
    await supabase
      .from('data_retention_settings')
      .upsert({
        user_id: userId,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
  } catch (error) {
    console.error('Failed to update last activity:', error);
  }
}

export async function recordConsent(params: {
  userId: string;
  consentType: 'privacy_policy' | 'terms_of_service' | 'data_processing' | 'hipaa_authorization' | 'marketing';
  consented: boolean;
  version: string;
}) {
  try {
    await supabase.from('user_consents').insert({
      user_id: params.userId,
      consent_type: params.consentType,
      consented: params.consented,
      version: params.version,
    });
  } catch (error) {
    console.error('Failed to record consent:', error);
  }
}

export async function submitDataRequest(params: {
  userId: string;
  requestType: 'export' | 'deletion' | 'amendment' | 'access';
  description?: string;
}) {
  try {
    const { data, error } = await supabase.from('data_access_requests').insert({
      user_id: params.userId,
      request_type: params.requestType,
      description: params.description || null,
    }).select().single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}
