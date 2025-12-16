import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Badge, UserBadge } from '../types';
import {
  Award,
  Trophy,
  Star,
  Lock,
  CheckCircle,
  Footprints,
  Moon,
  Heart,
  Target,
  Brain,
  Calendar,
  TrendingUp,
  Battery,
  Compass,
  Flame,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const iconMap: Record<string, React.ElementType> = {
  footprints: Footprints,
  compass: Compass,
  calendar: Calendar,
  moon: Moon,
  'trending-up': TrendingUp,
  'heart-pulse': Heart,
  brain: Brain,
  target: Target,
  'battery-charging': Battery,
  award: Award,
};

export default function AchievementsPage() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  async function fetchData() {
    const [badgesRes, earnedRes] = await Promise.all([
      supabase.from('badges').select('*').order('points', { ascending: true }),
      supabase
        .from('user_badges')
        .select('*, badge:badges(*)')
        .eq('user_id', user!.id)
        .order('earned_at', { ascending: false }),
    ]);

    if (badgesRes.data) setBadges(badgesRes.data);
    if (earnedRes.data) {
      setEarnedBadges(earnedRes.data);
      const points = earnedRes.data.reduce((sum, ub) => sum + (ub.badge?.points || 0), 0);
      setTotalPoints(points);
    }
    setLoading(false);
  }

  const earnedBadgeIds = new Set(earnedBadges.map((ub) => ub.badge_id));

  const categories = [...new Set(badges.map((b) => b.category))];

  const filteredBadges = selectedCategory
    ? badges.filter((b) => b.category === selectedCategory)
    : badges;

  const levelThresholds = [
    { level: 1, name: 'Beginner', points: 0, color: 'slate' },
    { level: 2, name: 'Explorer', points: 50, color: 'emerald' },
    { level: 3, name: 'Achiever', points: 150, color: 'blue' },
    { level: 4, name: 'Champion', points: 300, color: 'amber' },
    { level: 5, name: 'Legend', points: 500, color: 'rose' },
  ];

  const currentLevel = levelThresholds.reduce((lvl, threshold) => {
    return totalPoints >= threshold.points ? threshold : lvl;
  }, levelThresholds[0]);

  const nextLevel = levelThresholds.find((t) => t.points > totalPoints);
  const progressToNextLevel = nextLevel
    ? ((totalPoints - currentLevel.points) / (nextLevel.points - currentLevel.points)) * 100
    : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-primaryDeep dark:text-white mb-2">Achievements</h1>
        <p className="text-gray-400">Track your progress and earn badges for healthy habits</p>
      </div>

      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-800/50 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center bg-gradient-to-br ${
              currentLevel.color === 'slate' ? 'from-gray-600 to-gray-200' :
              currentLevel.color === 'emerald' ? 'from-primary to-primaryAccent' :
              currentLevel.color === 'blue' ? 'from-blue-500 to-cyan-600' :
              currentLevel.color === 'amber' ? 'from-amber-500 to-orange-600' :
              'from-rose-500 to-pink-600'
            }`}>
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Current Level</p>
              <h2 className="text-2xl font-bold text-primaryDeep dark:text-white">{currentLevel.name}</h2>
              <p className="text-primary font-semibold">{totalPoints} points</p>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Progress to {nextLevel?.name || 'Max Level'}</span>
              <span className="text-primaryDeep dark:text-white text-sm font-medium">
                {nextLevel ? `${nextLevel.points - totalPoints} pts to go` : 'Max Level!'}
              </span>
            </div>
            <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primaryAccent rounded-full transition-all"
                style={{ width: `${progressToNextLevel}%` }}
              />
            </div>
          </div>

          <div className="text-center">
            <p className="text-3xl font-bold text-primaryDeep dark:text-white">{earnedBadges.length}</p>
            <p className="text-gray-400 text-sm">Badges Earned</p>
          </div>
        </div>
      </div>

      {earnedBadges.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            Recently Earned
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {earnedBadges.slice(0, 4).map((ub) => {
              const Icon = iconMap[ub.badge?.icon || ''] || Award;
              return (
                <div
                  key={ub.id}
                  className="bg-gradient-to-br from-primary/20 to-primaryAccent/20 rounded-xl p-4 border border-primary/30 text-center"
                >
                  <div className="w-14 h-14 bg-primary/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-primaryDeep dark:text-white font-semibold text-sm mb-1">{ub.badge?.name}</h3>
                  <p className="text-primary text-xs mb-1">{ub.badge?.points} pts</p>
                  <p className="text-gray-400 text-xs">
                    {format(parseISO(ub.earned_at), 'MMM d, yyyy')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-primaryDeep dark:text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            All Badges
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedCategory === null
                  ? 'bg-primary/20 text-primary'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:text-primaryDeep dark:hover:text-white'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                  selectedCategory === cat
                    ? 'bg-primary/20 text-primary'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:text-primaryDeep dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredBadges.map((badge) => {
            const isEarned = earnedBadgeIds.has(badge.id);
            const Icon = iconMap[badge.icon] || Award;

            return (
              <div
                key={badge.id}
                className={`relative rounded-xl p-4 border text-center transition-all ${
                  isEarned
                    ? 'bg-white dark:bg-slate-800 border-primary/30'
                    : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 opacity-60'
                }`}
              >
                {!isEarned && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                    isEarned ? 'bg-primary/20' : 'bg-gray-100 dark:bg-slate-700'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isEarned ? 'text-primary' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-semibold text-sm mb-1 ${isEarned ? 'text-primaryDeep dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                  {badge.name}
                </h3>
                <p className="text-gray-400 text-xs mb-2 line-clamp-2">{badge.description}</p>
                <div className="flex items-center justify-center gap-1">
                  <Star className={`w-3 h-3 ${isEarned ? 'text-amber-400' : 'text-gray-200'}`} />
                  <span className={`text-xs font-medium ${isEarned ? 'text-amber-400' : 'text-gray-200'}`}>
                    {badge.points} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          How to Earn Badges
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-4">
            <h4 className="text-primaryDeep dark:text-white font-medium mb-2">Activity Badges</h4>
            <p className="text-gray-400">Hit daily step goals and maintain active minutes to unlock activity achievements.</p>
          </div>
          <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-4">
            <h4 className="text-primaryDeep dark:text-white font-medium mb-2">Sleep Badges</h4>
            <p className="text-gray-400">Achieve optimal sleep duration and efficiency consistently to earn sleep badges.</p>
          </div>
          <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-4">
            <h4 className="text-primaryDeep dark:text-white font-medium mb-2">Consistency Badges</h4>
            <p className="text-gray-400">Track your health data daily to build streaks and unlock consistency rewards.</p>
          </div>
          <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-4">
            <h4 className="text-primaryDeep dark:text-white font-medium mb-2">Milestone Badges</h4>
            <p className="text-gray-400">Complete significant achievements like improving HRV or reaching goal targets.</p>
          </div>
          <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-4">
            <h4 className="text-primaryDeep dark:text-white font-medium mb-2">Simulation Badges</h4>
            <p className="text-gray-400">Run bio-simulations and explore how changes can impact your health outcomes.</p>
          </div>
          <div className="bg-gray-100 dark:bg-slate-700 rounded-lg p-4">
            <h4 className="text-primaryDeep dark:text-white font-medium mb-2">Level Up</h4>
            <p className="text-gray-400">Earn points from badges to increase your level from Beginner to Legend status.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
