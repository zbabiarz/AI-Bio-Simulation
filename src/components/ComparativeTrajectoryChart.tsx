import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Legend, Tooltip } from 'recharts';
import type { RiskTrajectory } from '../types';

interface ComparativeTrajectoryChartProps {
  baseline: RiskTrajectory;
  optimized: RiskTrajectory;
  title: string;
  color: string;
  timeHorizon: 'sixMonths' | 'oneYear' | 'fiveYears' | 'tenYears';
}

export default function ComparativeTrajectoryChart({
  baseline,
  optimized,
  title,
  color,
  timeHorizon
}: ComparativeTrajectoryChartProps) {
  const data = [
    {
      time: 'Now',
      baseline: baseline.current,
      optimized: optimized.current,
      label: 'Current'
    },
    {
      time: '6mo',
      baseline: baseline.sixMonths,
      optimized: optimized.sixMonths,
      label: '6 Months'
    },
    {
      time: '1yr',
      baseline: baseline.oneYear,
      optimized: optimized.oneYear,
      label: '1 Year'
    },
    {
      time: '5yr',
      baseline: baseline.fiveYears,
      optimized: optimized.fiveYears,
      label: '5 Years'
    },
    {
      time: '10yr',
      baseline: baseline.tenYears,
      optimized: optimized.tenYears,
      label: '10 Years'
    },
  ];

  const timeHorizonMap = {
    sixMonths: baseline.sixMonths,
    oneYear: baseline.oneYear,
    fiveYears: baseline.fiveYears,
    tenYears: baseline.tenYears,
  };

  const optimizedTimeHorizonMap = {
    sixMonths: optimized.sixMonths,
    oneYear: optimized.oneYear,
    fiveYears: optimized.fiveYears,
    tenYears: optimized.tenYears,
  };

  const selectedRisk = timeHorizonMap[timeHorizon];
  const selectedOptimized = optimizedTimeHorizonMap[timeHorizon];
  const improvement = selectedRisk - selectedOptimized;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <div className="flex items-center gap-4 mt-2">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Path</div>
              <span className="text-xl font-bold text-gray-700 dark:text-gray-300">
                {selectedRisk.toFixed(0)}%
              </span>
            </div>
            <div className="text-2xl text-gray-400">→</div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Optimized Path</div>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                {selectedOptimized.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
        {improvement > 0 && (
          <div className="bg-green-50 dark:bg-green-900/30 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800">
            <div className="text-xs text-green-700 dark:text-green-300 mb-0.5">Improvement</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              ↓ {improvement.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      <div className="h-64 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-baseline-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`gradient-optimized-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}%`,
                name === 'baseline' ? 'Current Path' : 'Optimized Path'
              ]}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="line"
              formatter={(value) => value === 'baseline' ? 'Current Path' : 'Optimized Path'}
            />
            <Area
              type="monotone"
              dataKey="baseline"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-baseline-${title.replace(/\s/g, '')})`}
              name="baseline"
            />
            <Area
              type="monotone"
              dataKey="optimized"
              stroke="#10b981"
              strokeWidth={2}
              fill={`url(#gradient-optimized-${title.replace(/\s/g, '')})`}
              name="optimized"
              strokeDasharray="5 5"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Current Drivers:</p>
            <ul className="space-y-1">
              {baseline.primaryDrivers.slice(0, 2).map((driver, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  {driver}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">After Optimization:</p>
            <ul className="space-y-1">
              {optimized.primaryDrivers.slice(0, 2).map((driver, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {driver}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
