import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { HealthGoal } from '../types';
import {
  Target,
  Plus,
  X,
  Check,
  Pause,
  Play,
  Trash2,
  Edit2,
  Heart,
  Moon,
  Footprints,
  Battery,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

const goalTemplates = [
  { metric_type: 'steps', title: 'Daily Steps Goal', icon: Footprints, default_target: 10000, unit: 'steps' },
  { metric_type: 'sleep', title: 'Sleep Duration Goal', icon: Moon, default_target: 480, unit: 'minutes' },
  { metric_type: 'hrv', title: 'HRV Improvement', icon: Heart, default_target: 50, unit: 'ms' },
  { metric_type: 'recovery', title: 'Recovery Score Goal', icon: Battery, default_target: 80, unit: '%' },
  { metric_type: 'activity', title: 'Active Minutes Goal', icon: TrendingUp, default_target: 30, unit: 'minutes' },
];

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<HealthGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<HealthGoal | null>(null);

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  async function fetchGoals() {
    const { data } = await supabase
      .from('health_goals')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) {
      setGoals(data);
    }
    setLoading(false);
  }

  async function createGoal(goal: Partial<HealthGoal>) {
    if (!user) return;

    const { error } = await supabase.from('health_goals').insert({
      user_id: user.id,
      ...goal,
    });

    if (!error) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'create_goal',
        details: { goal_type: goal.metric_type },
      });
      fetchGoals();
      setShowCreateModal(false);
    }
  }

  async function updateGoal(id: string, updates: Partial<HealthGoal>) {
    const { error } = await supabase
      .from('health_goals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      fetchGoals();
      setEditingGoal(null);
    }
  }

  async function deleteGoal(id: string) {
    const { error } = await supabase.from('health_goals').delete().eq('id', id);
    if (!error) {
      fetchGoals();
    }
  }

  async function toggleGoalStatus(goal: HealthGoal) {
    const newStatus = goal.status === 'active' ? 'paused' : 'active';
    await updateGoal(goal.id, { status: newStatus });
  }

  async function completeGoal(goal: HealthGoal) {
    await updateGoal(goal.id, { status: 'completed', current_value: goal.target_value });

    if (user) {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'complete_goal',
        details: { goal_id: goal.id, goal_type: goal.metric_type },
      });
    }
  }

  const activeGoals = goals.filter((g) => g.status === 'active');
  const pausedGoals = goals.filter((g) => g.status === 'paused');
  const completedGoals = goals.filter((g) => g.status === 'completed');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primaryDeep dark:text-white mb-2">Health Goals</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Track your progress and achieve your health objectives</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primaryDark text-white font-semibold py-2.5 px-4 rounded-lg transition-all min-h-[44px] w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5" />
          New Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-gray-200 dark:border-slate-700 text-center">
          <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-primaryDeep dark:text-white mb-2">No Goals Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
            Set your first health goal to start tracking your progress
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary font-medium py-2 px-4 rounded-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Your First Goal
          </button>
        </div>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-primary" />
                Active Goals ({activeGoals.length})
              </h2>
              <div className="grid gap-3 sm:gap-4">
                {activeGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onToggle={() => toggleGoalStatus(goal)}
                    onComplete={() => completeGoal(goal)}
                    onEdit={() => setEditingGoal(goal)}
                    onDelete={() => deleteGoal(goal.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {pausedGoals.length > 0 && (
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
                <Pause className="w-5 h-5 text-amber-400" />
                Paused Goals ({pausedGoals.length})
              </h2>
              <div className="grid gap-3 sm:gap-4">
                {pausedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onToggle={() => toggleGoalStatus(goal)}
                    onComplete={() => completeGoal(goal)}
                    onEdit={() => setEditingGoal(goal)}
                    onDelete={() => deleteGoal(goal.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {completedGoals.length > 0 && (
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
                <Check className="w-5 h-5 text-primary" />
                Completed Goals ({completedGoals.length})
              </h2>
              <div className="grid gap-3 sm:gap-4">
                {completedGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    onDelete={() => deleteGoal(goal.id)}
                    completed
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showCreateModal && (
        <CreateGoalModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createGoal}
        />
      )}

      {editingGoal && (
        <EditGoalModal
          goal={editingGoal}
          onClose={() => setEditingGoal(null)}
          onSave={(updates) => updateGoal(editingGoal.id, updates)}
        />
      )}
    </div>
  );
}

interface GoalCardProps {
  goal: HealthGoal;
  onToggle?: () => void;
  onComplete?: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  completed?: boolean;
}

function GoalCard({ goal, onToggle, onComplete, onEdit, onDelete, completed }: GoalCardProps) {
  const progress = Math.min((goal.current_value / goal.target_value) * 100, 100);
  const template = goalTemplates.find((t) => t.metric_type === goal.metric_type);
  const Icon = template?.icon || Target;

  const daysRemaining = goal.end_date
    ? differenceInDays(parseISO(goal.end_date), new Date())
    : null;

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-5 border ${completed ? 'border-primary/30' : 'border-gray-200 dark:border-slate-700'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${completed ? 'bg-primary/20' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${completed ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base text-primaryDeep dark:text-white font-semibold truncate">{goal.title}</h3>
            {goal.description && (
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm truncate">{goal.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {!completed && (
            <>
              <button
                onClick={onToggle}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-primaryDeep dark:hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title={goal.status === 'active' ? 'Pause' : 'Resume'}
              >
                {goal.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={onEdit}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-primaryDeep dark:hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={onDelete}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-400 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600 dark:text-gray-400 text-sm">
            {goal.current_value.toLocaleString()} / {goal.target_value.toLocaleString()} {goal.unit}
          </span>
          <span className={`text-sm font-medium ${completed ? 'text-primary' : 'text-primaryDeep dark:text-white'}`}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${completed ? 'bg-primary' : 'bg-primary'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Started {format(parseISO(goal.start_date), 'MMM d')}
          </span>
          {daysRemaining !== null && daysRemaining > 0 && (
            <span>{daysRemaining} days remaining</span>
          )}
        </div>
        {!completed && progress < 100 && onComplete && (
          <button
            onClick={onComplete}
            className="text-xs text-primary hover:text-primaryDark flex items-center gap-1 min-h-[44px]"
          >
            <Check className="w-3 h-3" />
            Mark Complete
          </button>
        )}
        {completed && (
          <span className="text-xs text-primary flex items-center gap-1">
            <Check className="w-3 h-3" />
            Completed
          </span>
        )}
      </div>
    </div>
  );
}

interface CreateGoalModalProps {
  onClose: () => void;
  onCreate: (goal: Partial<HealthGoal>) => void;
}

function CreateGoalModal({ onClose, onCreate }: CreateGoalModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<typeof goalTemplates[0] | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [endDate, setEndDate] = useState('');

  function handleCreate() {
    if (!selectedTemplate || !title || !targetValue) return;

    onCreate({
      metric_type: selectedTemplate.metric_type,
      title,
      description: description || null,
      target_value: parseFloat(targetValue),
      unit: selectedTemplate.unit,
      end_date: endDate || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 w-full max-w-lg border border-gray-200 dark:border-slate-700 my-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-primaryDeep dark:text-white">Create New Goal</h2>
          <button onClick={onClose} className="text-gray-600 dark:text-gray-400 hover:text-primaryDeep dark:hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Goal Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {goalTemplates.map((template) => (
                <button
                  key={template.metric_type}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setTitle(template.title);
                    setTargetValue(template.default_target.toString());
                  }}
                  className={`p-2 sm:p-3 rounded-lg border text-left transition-all min-h-[44px] ${
                    selectedTemplate?.metric_type === template.metric_type
                      ? 'bg-primary/20 border-primary/50'
                      : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 hover:border-gray-400'
                  }`}
                >
                  <template.icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-1 ${selectedTemplate?.metric_type === template.metric_type ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`} />
                  <p className="text-primaryDeep dark:text-white text-xs sm:text-sm">{template.title.split(' ')[0]}</p>
                </button>
              ))}
            </div>
          </div>

          {selectedTemplate && (
            <>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Goal Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg py-3 px-4 text-primaryDeep dark:text-white focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Improve cardiovascular health"
                  className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg py-3 px-4 text-primaryDeep dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Target ({selectedTemplate.unit})
                  </label>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg py-3 px-4 text-primaryDeep dark:text-white focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date (optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg py-3 px-4 text-primaryDeep dark:text-white focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-100 dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-primaryDeep dark:text-white rounded-lg transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedTemplate || !title || !targetValue}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primaryDark text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            Create Goal
          </button>
        </div>
      </div>
    </div>
  );
}

interface EditGoalModalProps {
  goal: HealthGoal;
  onClose: () => void;
  onSave: (updates: Partial<HealthGoal>) => void;
}

function EditGoalModal({ goal, onClose, onSave }: EditGoalModalProps) {
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description || '');
  const [targetValue, setTargetValue] = useState(goal.target_value.toString());
  const [currentValue, setCurrentValue] = useState(goal.current_value.toString());

  function handleSave() {
    onSave({
      title,
      description: description || null,
      target_value: parseFloat(targetValue),
      current_value: parseFloat(currentValue),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 w-full max-w-lg border border-gray-200 dark:border-slate-700 my-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-primaryDeep dark:text-white">Edit Goal</h2>
          <button onClick={onClose} className="text-gray-600 dark:text-gray-400 hover:text-primaryDeep dark:hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Goal Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg py-3 px-4 text-primaryDeep dark:text-white focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg py-3 px-4 text-primaryDeep dark:text-white focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current Progress</label>
              <input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg py-3 px-4 text-primaryDeep dark:text-white focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Target ({goal.unit})</label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg py-3 px-4 text-primaryDeep dark:text-white focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-100 dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-primaryDeep dark:text-white rounded-lg transition-colors min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 px-4 bg-primary hover:bg-primaryDark text-white font-semibold rounded-lg transition-all min-h-[44px]"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
