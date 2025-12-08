import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { recordConsent, submitDataRequest, logSecurityEvent } from '../lib/audit';
import { UserConsent, DataAccessRequest, DataRetentionSettings } from '../types';
import {
  Shield,
  Lock,
  Eye,
  FileText,
  Download,
  Trash2,
  Edit,
  Clock,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const POLICY_VERSION = '1.0.0';

export default function PrivacyPage() {
  const { user } = useAuth();
  const [consents, setConsents] = useState<UserConsent[]>([]);
  const [requests, setRequests] = useState<DataAccessRequest[]>([]);
  const [retentionSettings, setRetentionSettings] = useState<DataRetentionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    collection: true,
    usage: false,
    storage: false,
    rights: false,
    security: false,
  });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<'export' | 'deletion' | 'amendment' | 'access'>('export');
  const [requestDescription, setRequestDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  async function fetchData() {
    const [consentsRes, requestsRes, retentionRes] = await Promise.all([
      supabase
        .from('user_consents')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('data_access_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('requested_at', { ascending: false }),
      supabase
        .from('data_retention_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle(),
    ]);

    if (consentsRes.data) setConsents(consentsRes.data);
    if (requestsRes.data) setRequests(requestsRes.data);
    if (retentionRes.data) setRetentionSettings(retentionRes.data);
    setLoading(false);
  }

  async function handleConsent(consentType: UserConsent['consent_type'], consented: boolean) {
    if (!user) return;

    await recordConsent({
      userId: user.id,
      consentType,
      consented,
      version: POLICY_VERSION,
    });

    fetchData();
  }

  async function handleSubmitRequest() {
    if (!user) return;

    setSubmitting(true);
    const { error } = await submitDataRequest({
      userId: user.id,
      requestType,
      description: requestDescription,
    });

    if (!error) {
      await logSecurityEvent({
        eventType: requestType === 'deletion' ? 'account_deletion' : 'data_export',
        userId: user.id,
        details: { request_type: requestType },
        severity: requestType === 'deletion' ? 'warning' : 'info',
      });

      setShowRequestModal(false);
      setRequestDescription('');
      fetchData();
    }
    setSubmitting(false);
  }

  async function updateRetentionDays(days: number) {
    if (!user) return;

    await supabase.from('data_retention_settings').upsert({
      user_id: user.id,
      retention_days: days,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    fetchData();
  }

  function toggleSection(section: string) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  const hasConsented = (type: UserConsent['consent_type']) => {
    const consent = consents.find((c) => c.consent_type === type && c.version === POLICY_VERSION && !c.revoked_at);
    return consent?.consented || false;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 px-4">
      <div className="flex items-center gap-4 mb-8">
        <Link to={user ? '/settings' : '/'} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Privacy Policy & Data Rights</h1>
          <p className="text-slate-400 text-sm">Version {POLICY_VERSION} - Last updated December 2024</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-6 border border-emerald-500/30">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">HIPAA Compliance</h2>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          AIMD is designed with HIPAA compliance in mind. We implement administrative, physical, and technical safeguards to protect your Protected Health Information (PHI). Your health data is encrypted both in transit and at rest, and access is strictly controlled through role-based permissions.
        </p>
      </div>

      <div className="space-y-4">
        <PolicySection
          title="Data We Collect"
          icon={Eye}
          expanded={expandedSections.collection}
          onToggle={() => toggleSection('collection')}
        >
          <ul className="space-y-2 text-slate-300 text-sm">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Health Metrics:</strong> HRV, sleep data, steps, activity levels, recovery scores, and other wearable data you upload</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Account Information:</strong> Email address, name, and authentication credentials</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Usage Data:</strong> How you interact with the app, simulations run, and goals set</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Device Information:</strong> Browser type and device identifiers for security purposes</span>
            </li>
          </ul>
        </PolicySection>

        <PolicySection
          title="How We Use Your Data"
          icon={FileText}
          expanded={expandedSections.usage}
          onToggle={() => toggleSection('usage')}
        >
          <ul className="space-y-2 text-slate-300 text-sm">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Provide personalized health insights and recommendations</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Run bio-simulations to predict health outcomes</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Track your progress toward health goals</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Improve our AI coaching algorithms (with anonymized data only)</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <span><strong>We never sell your personal health data to third parties</strong></span>
            </li>
          </ul>
        </PolicySection>

        <PolicySection
          title="Data Storage & Security"
          icon={Lock}
          expanded={expandedSections.storage}
          onToggle={() => toggleSection('storage')}
        >
          <ul className="space-y-2 text-slate-300 text-sm">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Encryption:</strong> All data is encrypted using AES-256 at rest and TLS 1.3 in transit</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Access Control:</strong> Role-based access control (RBAC) limits who can access your data</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Audit Logging:</strong> All access to PHI is logged and monitored</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Data Minimization:</strong> Raw uploaded files are deleted after processing; only essential metrics are stored</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Secure Infrastructure:</strong> Hosted on HIPAA-compliant infrastructure with BAAs in place</span>
            </li>
          </ul>
        </PolicySection>

        <PolicySection
          title="Your Rights (HIPAA)"
          icon={Shield}
          expanded={expandedSections.rights}
          onToggle={() => toggleSection('rights')}
        >
          <ul className="space-y-2 text-slate-300 text-sm">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Right to Access:</strong> You can view and export all your health data at any time</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Right to Amendment:</strong> You can request corrections to your health information</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Right to Deletion:</strong> You can request permanent deletion of your account and all associated data</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Right to Restriction:</strong> You can limit how your data is used</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span><strong>Breach Notification:</strong> You will be notified within 60 days if a data breach affects your information</span>
            </li>
          </ul>
        </PolicySection>
      </div>

      {user && (
        <>
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              Data Retention Settings
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Keep my data for
                </label>
                <select
                  value={retentionSettings?.retention_days || 365}
                  onChange={(e) => updateRetentionDays(parseInt(e.target.value))}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value={90}>90 days</option>
                  <option value={180}>6 months</option>
                  <option value={365}>1 year</option>
                  <option value={730}>2 years</option>
                  <option value={1825}>5 years</option>
                  <option value={2555}>7 years (HIPAA recommended)</option>
                </select>
                <p className="text-slate-500 text-xs mt-2">
                  HIPAA requires covered entities to retain health records for 6 years. We recommend keeping data for at least 7 years.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Your Consents
              </h2>
            </div>

            <div className="space-y-3">
              <ConsentRow
                label="Privacy Policy"
                description="Agreement to how we collect and use your data"
                consented={hasConsented('privacy_policy')}
                onConsent={(value) => handleConsent('privacy_policy', value)}
              />
              <ConsentRow
                label="HIPAA Authorization"
                description="Authorization for us to process your health information"
                consented={hasConsented('hipaa_authorization')}
                onConsent={(value) => handleConsent('hipaa_authorization', value)}
              />
              <ConsentRow
                label="Data Processing"
                description="Consent for AI analysis of your health data"
                consented={hasConsented('data_processing')}
                onConsent={(value) => handleConsent('data_processing', value)}
              />
              <ConsentRow
                label="Marketing Communications"
                description="Receive tips and updates about new features"
                consented={hasConsented('marketing')}
                onConsent={(value) => handleConsent('marketing', value)}
                optional
              />
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                Data Access Requests
              </h2>
              <button
                onClick={() => setShowRequestModal(true)}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors text-sm"
              >
                New Request
              </button>
            </div>

            {requests.length === 0 ? (
              <p className="text-slate-400 text-sm">No data access requests submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="bg-slate-700/30 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {request.request_type === 'export' && <Download className="w-4 h-4 text-blue-400" />}
                        {request.request_type === 'deletion' && <Trash2 className="w-4 h-4 text-red-400" />}
                        {request.request_type === 'amendment' && <Edit className="w-4 h-4 text-amber-400" />}
                        {request.request_type === 'access' && <Eye className="w-4 h-4 text-emerald-400" />}
                        <span className="text-white font-medium capitalize">{request.request_type} Request</span>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        request.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                        request.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                        request.status === 'denied' ? 'bg-red-500/20 text-red-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                    {request.description && (
                      <p className="text-slate-400 text-sm mb-2">{request.description}</p>
                    )}
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <Calendar className="w-3 h-3" />
                      Submitted {format(parseISO(request.requested_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Submit Data Request</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Request Type</label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as typeof requestType)}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="export">Export My Data</option>
                  <option value="access">Access Log Request</option>
                  <option value="amendment">Request Data Amendment</option>
                  <option value="deletion">Delete My Account</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description (optional)</label>
                <textarea
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="Provide any additional details..."
                  rows={3}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg py-2.5 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {requestType === 'deletion' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-400 text-sm">
                    Warning: Account deletion is permanent and cannot be undone. All your health data, goals, and history will be permanently removed.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className={`flex-1 py-2.5 px-4 font-semibold rounded-lg transition-all disabled:opacity-50 ${
                  requestType === 'deletion'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white'
                }`}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PolicySectionProps {
  title: string;
  icon: React.ElementType;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function PolicySection({ title, icon: Icon, expanded, onToggle, children }: PolicySectionProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-emerald-400" />
          <span className="text-white font-semibold">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

interface ConsentRowProps {
  label: string;
  description: string;
  consented: boolean;
  onConsent: (value: boolean) => void;
  optional?: boolean;
}

function ConsentRow({ label, description, consented, onConsent, optional }: ConsentRowProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
      <div>
        <p className="text-white font-medium text-sm">
          {label}
          {optional && <span className="text-slate-500 ml-2">(Optional)</span>}
        </p>
        <p className="text-slate-400 text-xs">{description}</p>
      </div>
      <button
        onClick={() => onConsent(!consented)}
        className={`w-12 h-7 rounded-full p-1 transition-colors ${
          consented ? 'bg-emerald-500' : 'bg-slate-600'
        }`}
      >
        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${consented ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}
