import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertCircle, ChevronRight, Heart, Activity, Brain } from 'lucide-react';

export default function IntakePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    age: profile?.age || '',
    sex: profile?.sex || '',
    hasHeartFailure: profile?.has_heart_failure || false,
    hasDiabetes: profile?.has_diabetes || false,
    hasChronicKidneyDisease: profile?.has_chronic_kidney_disease || false,
  });

  const isValid = formData.age && formData.sex;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !isValid) return;

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          age: Number(formData.age),
          sex: formData.sex,
          has_heart_failure: formData.hasHeartFailure,
          has_diabetes: formData.hasDiabetes,
          has_chronic_kidney_disease: formData.hasChronicKidneyDisease,
          intake_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      navigate('/simulation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save health profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Health Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This information calibrates your biosimulation to generate accurate, age-adjusted risk projections.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Demographics
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Age and sex significantly affect baseline physiological ranges. A 25-year-old and 65-year-old with identical HRV have very different risk profiles.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Age
                </label>
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter your age"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Biological Sex
                </label>
                <select
                  value={formData.sex}
                  onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Medical Conditions
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              These conditions materially alter your risk trajectories. Selecting applicable conditions enables more accurate projections.
            </p>

            <div className="space-y-4">
              <label className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.hasHeartFailure}
                  onChange={(e) => setFormData({ ...formData, hasHeartFailure: e.target.checked })}
                  className="mt-1 w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Heart Failure</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Diagnosed heart failure of any stage. This significantly impacts HRV interpretation and cardiovascular trajectory modeling.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.hasDiabetes}
                  onChange={(e) => setFormData({ ...formData, hasDiabetes: e.target.checked })}
                  className="mt-1 w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Diabetes</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Type 1 or Type 2 diabetes. Affects metabolic, cardiovascular, and cognitive risk pathways.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.hasChronicKidneyDisease}
                  onChange={(e) => setFormData({ ...formData, hasChronicKidneyDisease: e.target.checked })}
                  className="mt-1 w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Chronic Kidney Disease</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Any stage of CKD. Impacts cardiovascular risk and metabolic pathway modeling.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-6">
            <div className="flex gap-4">
              <Brain className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-900 dark:text-amber-200 mb-1">
                  Why This Matters
                </h3>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  The biosimulation uses established clinical relationships between physiological markers and disease outcomes. Your age, sex, and medical history determine the baseline risk curves and how your HRV and deep sleep data are interpreted. Accurate inputs enable accurate projections.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || saving}
            className="w-full py-4 px-6 bg-primary hover:bg-primaryDark text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Continue to Simulation
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
