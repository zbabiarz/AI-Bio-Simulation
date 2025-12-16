import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserProfile, ActivityLog } from '../types';
import {
  Shield,
  Users,
  Activity,
  Brain,
  Target,
  Upload,
  MessageSquare,
  TrendingUp,
  Calendar,
  Search,
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalUploads: number;
  totalSimulations: number;
  totalGoals: number;
  totalChats: number;
}

interface ActionCount {
  action: string;
  count: number;
}

export default function AdminPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [actionCounts, setActionCounts] = useState<ActionCount[]>([]);
  const [userGrowth, setUserGrowth] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!profile?.is_admin) {
      navigate('/dashboard');
      return;
    }
    fetchAdminData();
  }, [profile, navigate]);

  async function fetchAdminData() {
    const [usersRes, uploadsRes, simulationsRes, goalsRes, chatsRes, activityRes] = await Promise.all([
      supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('activity_logs').select('id', { count: 'exact' }).eq('action', 'upload_data'),
      supabase.from('simulations').select('id', { count: 'exact' }),
      supabase.from('health_goals').select('id', { count: 'exact' }),
      supabase.from('activity_logs').select('id', { count: 'exact' }).eq('action', 'chat_with_coach'),
      supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (usersRes.data) {
      setUsers(usersRes.data);

      const thirtyDaysAgo = subDays(new Date(), 30);
      const activeCount = usersRes.data.filter(
        (u) => new Date(u.updated_at) >= thirtyDaysAgo
      ).length;

      setStats({
        totalUsers: usersRes.data.length,
        activeUsers: activeCount,
        totalUploads: uploadsRes.count || 0,
        totalSimulations: simulationsRes.count || 0,
        totalGoals: goalsRes.count || 0,
        totalChats: chatsRes.count || 0,
      });

      const growth = generateUserGrowth(usersRes.data);
      setUserGrowth(growth);
    }

    if (activityRes.data) {
      setRecentActivity(activityRes.data);

      const counts: Record<string, number> = {};
      activityRes.data.forEach((a) => {
        counts[a.action] = (counts[a.action] || 0) + 1;
      });
      setActionCounts(
        Object.entries(counts).map(([action, count]) => ({ action, count }))
      );
    }

    setLoading(false);
  }

  function generateUserGrowth(users: UserProfile[]): { date: string; count: number }[] {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      return format(date, 'yyyy-MM-dd');
    });

    const growthData = last30Days.map((date) => {
      const count = users.filter(
        (u) => format(parseISO(u.created_at), 'yyyy-MM-dd') <= date
      ).length;
      return { date: format(parseISO(date), 'MMM d'), count };
    });

    return growthData;
  }

  function getActionIcon(action: string) {
    switch (action) {
      case 'upload_data':
        return <Upload className="w-4 h-4 text-primary" />;
      case 'run_simulation':
        return <Brain className="w-4 h-4 text-blue-400" />;
      case 'create_goal':
      case 'complete_goal':
        return <Target className="w-4 h-4 text-amber-400" />;
      case 'chat_with_coach':
        return <MessageSquare className="w-4 h-4 text-primaryAccent" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  }

  function formatAction(action: string): string {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-orange-500 rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-primaryDeep dark:text-white">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Monitor platform usage and user activity</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Total Users" value={stats?.totalUsers || 0} color="blue" />
        <StatCard icon={Activity} label="Active Users" value={stats?.activeUsers || 0} color="emerald" />
        <StatCard icon={Upload} label="Data Uploads" value={stats?.totalUploads || 0} color="teal" />
        <StatCard icon={Brain} label="Simulations" value={stats?.totalSimulations || 0} color="amber" />
        <StatCard icon={Target} label="Goals Created" value={stats?.totalGoals || 0} color="rose" />
        <StatCard icon={MessageSquare} label="Coach Chats" value={stats?.totalChats || 0} color="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-slate-700">
          <h3 className="text-base sm:text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            User Growth (30 Days)
          </h3>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-slate-700">
          <h3 className="text-base sm:text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Activity Distribution
          </h3>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionCounts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="action"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={formatAction}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [value, 'Count']}
                  labelFormatter={formatAction}
                />
                <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-primaryDeep dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            User Management
          </h3>
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 dark:text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg py-2 pl-10 pr-4 text-primaryDeep dark:text-white placeholder-gray-600 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-gray-600 dark:text-gray-400 text-xs sm:text-sm border-b border-gray-200 dark:border-slate-700">
                  <th className="pb-3 pl-4 sm:pl-0 font-medium">User</th>
                  <th className="pb-3 font-medium hidden sm:table-cell">Email</th>
                  <th className="pb-3 font-medium hidden md:table-cell">Joined</th>
                  <th className="pb-3 font-medium hidden lg:table-cell">Last Active</th>
                  <th className="pb-3 pr-4 sm:pr-0 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm">
              {filteredUsers.slice(0, 10).map((user) => (
                <tr key={user.id} className="border-b border-gray-200 dark:border-slate-700">
                  <td className="py-3 pl-4 sm:pl-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-primary to-primaryAccent rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-primaryDeep dark:text-white block truncate">{user.full_name || 'No name'}</span>
                        <span className="text-gray-600 dark:text-gray-400 text-xs block truncate sm:hidden">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{user.email}</td>
                  <td className="py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">
                    {format(parseISO(user.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                    {format(parseISO(user.updated_at), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 pr-4 sm:pr-0">
                    {user.is_admin ? (
                      <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-xs rounded-full whitespace-nowrap">
                        Admin
                      </span>
                    ) : user.onboarding_completed ? (
                      <span className="px-2 py-1 bg-primary/20 text-primary text-xs rounded-full whitespace-nowrap">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full whitespace-nowrap">
                        New
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-slate-700">
        <h3 className="text-base sm:text-lg font-semibold text-primaryDeep dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-400" />
          Recent Activity
        </h3>

        <div className="space-y-3">
          {recentActivity.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 sm:gap-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3"
            >
              {getActionIcon(activity.action)}
              <div className="flex-1 min-w-0">
                <p className="text-primaryDeep dark:text-white text-xs sm:text-sm truncate">{formatAction(activity.action)}</p>
                <p className="text-gray-600 dark:text-gray-400 text-xs truncate">
                  User: {activity.user_id.slice(0, 8)}...
                </p>
              </div>
              <span className="text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                {format(parseISO(activity.created_at), 'MMM d, h:mm a')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: 'blue' | 'emerald' | 'teal' | 'amber' | 'rose' | 'cyan';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-400',
    emerald: 'from-primary/20 to-primary/5 text-primary',
    teal: 'from-primaryAccent/20 to-primaryAccent/5 text-primaryAccent',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-400',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-400',
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-3 sm:p-4 border border-gray-200 dark:border-slate-700`}>
      <Icon className="w-4 h-4 sm:w-5 sm:h-5 mb-2" />
      <p className="text-lg sm:text-2xl font-bold text-primaryDeep dark:text-white">{value.toLocaleString()}</p>
      <p className="text-gray-600 dark:text-gray-400 text-xs">{label}</p>
    </div>
  );
}
