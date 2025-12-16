import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logPHIAccess, logSecurityEvent } from '../lib/audit';
import {
  User,
  Mail,
  Bell,
  Shield,
  Trash2,
  Save,
  AlertCircle,
  Check,
  Download,
  FileText,
  ExternalLink,
  Lock,
} from 'lucide-react';

export default function SettingsPage() {
  const { profile, updateProfile, user } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleSaveProfile() {
    setSaving(true);
    setMessage(null);

    const { error } = await updateProfile({ full_name: fullName });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    }
    setSaving(false);
  }

  async function handleExportData() {
    if (!user) return;

    setExporting(true);

    await logPHIAccess({
      userId: user.id,
      accessType: 'export',
      resourceType: 'all_data',
      metadata: { export_type: 'full_export' },
    });

    await logSecurityEvent({
      eventType: 'data_export',
      userId: user.id,
      details: { export_format: 'json' },
      severity: 'info',
    });

    const [metricsRes, goalsRes, simulationsRes, badgesRes, accessLogsRes] = await Promise.all([
      supabase.from('health_metrics').select('*').eq('user_id', user.id),
      supabase.from('health_goals').select('*').eq('user_id', user.id),
      supabase.from('simulations').select('*').eq('user_id', user.id),
      supabase.from('user_badges').select('*, badge:badges(*)').eq('user_id', user.id),
      supabase.from('phi_access_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
    ]);

    const exportData = {
      export_metadata: {
        exported_at: new Date().toISOString(),
        format_version: '1.0',
        user_id: user.id,
        hipaa_notice: 'This export contains Protected Health Information (PHI). Handle with care and store securely.',
      },
      profile: {
        ...profile,
        email: profile?.email,
        full_name: profile?.full_name,
        created_at: profile?.created_at,
      },
      health_metrics: metricsRes.data || [],
      goals: goalsRes.data || [],
      simulations: simulationsRes.data || [],
      badges: badgesRes.data || [],
      access_logs: accessLogsRes.data || [],
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aimd-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    setMessage({ type: 'success', text: 'Data exported successfully' });
  }

  async function handleDeleteAccount() {
    if (!user) return;

    await logSecurityEvent({
      eventType: 'account_deletion',
      userId: user.id,
      details: { initiated_by: 'user' },
      severity: 'critical',
    });

    await Promise.all([
      supabase.from('health_metrics').delete().eq('user_id', user.id),
      supabase.from('health_goals').delete().eq('user_id', user.id),
      supabase.from('simulations').delete().eq('user_id', user.id),
      supabase.from('chat_messages').delete().eq('user_id', user.id),
      supabase.from('user_badges').delete().eq('user_id', user.id),
      supabase.from('activity_logs').delete().eq('user_id', user.id),
      supabase.from('user_consents').delete().eq('user_id', user.id),
      supabase.from('data_retention_settings').delete().eq('user_id', user.id),
      supabase.from('data_access_requests').delete().eq('user_id', user.id),
      supabase.from('phi_access_logs').delete().eq('user_id', user.id),
      supabase.from('user_profiles').delete().eq('id', user.id),
    ]);

    await supabase.auth.signOut();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primaryDeep dark:text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your account and preferences</p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Profile Information
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg py-2.5 px-4 text-primaryDeep dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-gray-400" />
              <span className="text-gray-400">{profile?.email}</span>
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-primaryAccent hover:from-primaryDark hover:to-primaryAccent text-white font-semibold py-2.5 px-4 rounded-lg transition-all disabled:opacity-50"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          Notifications
        </h2>

        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-primaryDeep dark:text-white font-medium">Weekly Summary</p>
              <p className="text-gray-400 text-sm">Receive a weekly email with your health insights</p>
            </div>
            <div className="w-12 h-7 bg-primary rounded-full p-1 cursor-pointer">
              <div className="w-5 h-5 bg-white rounded-full ml-auto" />
            </div>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-primaryDeep dark:text-white font-medium">Goal Reminders</p>
              <p className="text-gray-400 text-sm">Get notified about goal progress</p>
            </div>
            <div className="w-12 h-7 bg-gray-200 rounded-full p-1 cursor-pointer">
              <div className="w-5 h-5 bg-gray-600 rounded-full" />
            </div>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-primaryDeep dark:text-white font-medium">New Badge Alerts</p>
              <p className="text-gray-400 text-sm">Celebrate when you earn new badges</p>
            </div>
            <div className="w-12 h-7 bg-primary rounded-full p-1 cursor-pointer">
              <div className="w-5 h-5 bg-white rounded-full ml-auto" />
            </div>
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          Data & Privacy
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primaryDeep dark:text-white font-medium">Export Your Data</p>
              <p className="text-gray-400 text-sm">Download all your health data in JSON format</p>
            </div>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-primaryDeep dark:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-primaryDeep dark:text-white font-medium">Privacy Policy & Data Rights</p>
              <p className="text-gray-400 text-sm">View policy, manage consents, and submit data requests</p>
            </div>
            <Link
              to="/privacy"
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-primaryDeep dark:text-white rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              View
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-lg p-4">
              <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-primaryDeep dark:text-white font-medium text-sm">HIPAA Compliant</p>
                <p className="text-gray-400 text-xs mt-1">
                  Your data is encrypted at rest (AES-256) and in transit (TLS 1.3). All access to your health information is logged and audited.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-red-500/10 rounded-xl p-6 border border-red-500/30">
        <h2 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Danger Zone
        </h2>

        <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
          Once you delete your account, there is no going back. All your health data, goals, badges, and history will be permanently removed. This action is logged for compliance purposes.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            Delete Account
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteAccount}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              Yes, Delete My Account
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-primaryDeep dark:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
