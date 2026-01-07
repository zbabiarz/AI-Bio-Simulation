import { useState, useEffect } from 'react';
import { X, User, Mail, Calendar, Brain, Activity, Heart, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserProfile } from '../../types';
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

interface UserDetailsModalProps {
  user: UserProfile;
  onClose: () => void;
  onDeleteUser: (user: UserProfile) => void;
}

export default function UserDetailsModal({ user, onClose, onDeleteUser }: UserDetailsModalProps) {
  const [sessions, setSessions] = useState<BiosimulationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<BiosimulationSession | null>(null);

  useEffect(() => {
    fetchUserSessions();
  }, [user.id]);

  async function fetchUserSessions() {
    const { data, error } = await supabase
      .from('biosimulation_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSessions(data);
      if (data.length > 0) {
        setSelectedSession(data[0]);
      }
    }
    setLoading(false);
  }

  function getClassificationColor(classification: string): string {
    switch (classification) {
      case 'favorable':
      case 'adequate':
        return 'text-emerald-500 bg-emerald-500/20';
      case 'moderate':
      case 'borderline':
        return 'text-amber-500 bg-amber-500/20';
      case 'low':
      case 'inadequate':
        return 'text-red-500 bg-red-500/20';
      default:
        return 'text-gray-500 bg-gray-500/20';
    }
  }

  function getRiskLevel(risk: Record<string, unknown>): { level: string; color: string } {
    const currentRisk = (risk as { current?: number })?.current || 0;
    if (currentRisk >= 70) return { level: 'High', color: 'text-red-500' };
    if (currentRisk >= 40) return { level: 'Moderate', color: 'text-amber-500' };
    return { level: 'Low', color: 'text-emerald-500' };
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-slate-700 shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primaryAccent rounded-full flex items-center justify-center text-white text-lg font-bold">
              {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-primaryDeep dark:text-white">
                {user.full_name || 'No name'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                  <User className="w-4 h-4" />
                  <span>Name</span>
                </div>
                <p className="text-primaryDeep dark:text-white font-medium truncate">
                  {user.full_name || 'Not provided'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                  <Mail className="w-4 h-4" />
                  <span>Email</span>
                </div>
                <p className="text-primaryDeep dark:text-white font-medium truncate">
                  {user.email}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined</span>
                </div>
                <p className="text-primaryDeep dark:text-white font-medium">
                  {format(parseISO(user.created_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm mb-1">
                  <Brain className="w-4 h-4" />
                  <span>Simulations</span>
                </div>
                <p className="text-primaryDeep dark:text-white font-medium">
                  {sessions.length}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Biosimulation Reports
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <Brain className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400">No simulation reports available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {sessions.map((session, index) => (
                        <button
                          key={session.id}
                          onClick={() => setSelectedSession(session)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                            selectedSession?.id === session.id
                              ? 'bg-primary text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          Report {index + 1} - {format(parseISO(session.created_at), 'MMM d, yyyy')}
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedSession && (
                    <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400 text-sm">
                          Generated on {format(parseISO(selectedSession.created_at), 'MMMM d, yyyy h:mm a')}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400 text-sm">
                          {selectedSession.data_days_analyzed} days analyzed
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-600">
                          <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-4 h-4 text-primary" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">HRV Classification</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getClassificationColor(selectedSession.hrv_classification)}`}>
                              {selectedSession.hrv_classification}
                            </span>
                            <span className="text-primaryDeep dark:text-white font-semibold">
                              {selectedSession.avg_hrv.toFixed(1)} ms
                            </span>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-600">
                          <div className="flex items-center gap-2 mb-2">
                            <Heart className="w-4 h-4 text-primary" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">Deep Sleep</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getClassificationColor(selectedSession.deep_sleep_classification)}`}>
                              {selectedSession.deep_sleep_classification}
                            </span>
                            <span className="text-primaryDeep dark:text-white font-semibold">
                              {selectedSession.avg_deep_sleep_minutes} min
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Risk Assessments
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {[
                            { label: 'Dementia', risk: selectedSession.dementia_risk },
                            { label: 'Cardiovascular', risk: selectedSession.cardiovascular_risk },
                            { label: 'Heart Failure', risk: selectedSession.heart_failure_risk },
                            { label: 'Cognitive', risk: selectedSession.cognitive_decline_risk },
                            { label: 'Metabolic', risk: selectedSession.metabolic_risk },
                          ].map((item) => {
                            const { level, color } = getRiskLevel(item.risk);
                            return (
                              <div key={item.label} className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-600 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{item.label}</p>
                                <p className={`font-semibold text-sm ${color}`}>{level}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {selectedSession.clinical_narrative && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Clinical Narrative</h4>
                          <p className="text-primaryDeep dark:text-white text-sm leading-relaxed bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-600">
                            {selectedSession.clinical_narrative}
                          </p>
                        </div>
                      )}

                      {selectedSession.recommendations && selectedSession.recommendations.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Recommendations</h4>
                          <ul className="space-y-2">
                            {selectedSession.recommendations.map((rec, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-primaryDeep dark:text-white bg-white dark:bg-slate-800 rounded-lg p-3 border border-gray-200 dark:border-slate-600">
                                <span className="w-5 h-5 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                                  {index + 1}
                                </span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <button
            onClick={() => onDeleteUser(user)}
            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg font-medium text-sm transition-colors"
          >
            Remove User
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
