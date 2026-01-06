import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { RiskTrajectory } from '../types';

interface RiskTrajectoryChartProps {
  trajectory: RiskTrajectory;
  title: string;
  color: string;
}

export default function RiskTrajectoryChart({ trajectory, title, color }: RiskTrajectoryChartProps) {
  const data = [
    { time: 'Now', risk: trajectory.current, label: 'Current' },
    { time: '6mo', risk: trajectory.sixMonths, label: '6 Months' },
    { time: '1yr', risk: trajectory.oneYear, label: '1 Year' },
    { time: '5yr', risk: trajectory.fiveYears, label: '5 Years' },
    { time: '10yr', risk: trajectory.tenYears, label: '10 Years' },
  ];

  const getRiskColor = (level: RiskTrajectory['riskLevel']) => {
    switch (level) {
      case 'critical': return 'text-red-600 dark:text-red-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'elevated': return 'text-amber-600 dark:text-amber-400';
      case 'moderate': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-green-600 dark:text-green-400';
    }
  };

  const getTrendIndicator = (trend: RiskTrajectory['trend']) => {
    switch (trend) {
      case 'worsening': return { icon: '↗', label: 'Worsening', color: 'text-red-600' };
      case 'stable': return { icon: '→', label: 'Stable', color: 'text-amber-600' };
      default: return { icon: '↘', label: 'Improving', color: 'text-green-600' };
    }
  };

  const trend = getTrendIndicator(trajectory.trend);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-2xl font-bold ${getRiskColor(trajectory.riskLevel)}`}>
              {trajectory.fiveYears.toFixed(0)}%
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">5-year projection</span>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 dark:bg-slate-700 ${trend.color}`}>
          <span className="text-lg">{trend.icon}</span>
          <span className="text-sm font-medium">{trend.label}</span>
        </div>
      </div>

      <div className="h-48 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickFormatter={(value) => `${value}%`}
            />
            <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="3 3" opacity={0.5} />
            <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} />
            <Area
              type="monotone"
              dataKey="risk"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${title.replace(/\s/g, '')})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Primary Drivers:</p>
        <ul className="space-y-1">
          {trajectory.primaryDrivers.map((driver, i) => (
            <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              {driver}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
