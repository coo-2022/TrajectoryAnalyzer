import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { AlertCircle, CheckCircle, Clock, StopCircle } from 'lucide-react';

interface CategoryData {
  count: number;
  ratio: number;
}

interface TerminationStats {
  total: number;
  categories: {
    env_done: CategoryData;
    truncation: CategoryData;
    timeout: CategoryData;
    finish: CategoryData;
  };
  unexpected: {
    count: number;
    ratio: number;
  };
}

const COLORS = {
  env_done: '#10b981',    // emerald-500
  truncation: '#f59e0b',  // amber-500
  timeout: '#ef4444',     // red-500
  finish: '#3b82f6'       // blue-500
};

const CATEGORY_LABELS = {
  env_done: 'Environment Done',
  truncation: 'Truncation',
  timeout: 'Timeout',
  finish: 'Finish'
};

const CATEGORY_ICONS = {
  env_done: CheckCircle,
  truncation: StopCircle,
  timeout: Clock,
  finish: CheckCircle
};

export default function TerminationStatsCard() {
  const [stats, setStats] = useState<TerminationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analysis-stats/termination-stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch termination stats:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Termination Statistics</h3>
        <div className="animate-pulse h-48 bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Termination Statistics</h3>
        <p className="text-slate-500">Failed to load data</p>
      </div>
    );
  }

  const chartData = Object.entries(stats.categories)
    .filter(([_, data]) => data.count > 0)
    .map(([key, data]) => ({
      name: CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS],
      value: data.count,
      ratio: data.ratio
    }));

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Termination Statistics</h3>
        <span className="text-sm text-slate-500">Total: {stats.total}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name}: ${(entry.ratio * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name.split(' ')[0].toLowerCase() as keyof typeof COLORS] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-3">
          {Object.entries(stats.categories).map(([key, data]) => {
            const Icon = CATEGORY_ICONS[key as keyof typeof CATEGORY_ICONS];
            return (
              <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" style={{ color: COLORS[key as keyof typeof COLORS] }} />
                  <span className="text-sm font-medium text-slate-700">
                    {CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-slate-800">{data.count}</div>
                  <div className="text-xs text-slate-500">{(data.ratio * 100).toFixed(1)}%</div>
                </div>
              </div>
            );
          })}

          {/* Unexpected Termination */}
          {stats.unexpected.count > 0 && (
            <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <span className="text-sm font-medium text-rose-700">Unexpected</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-rose-600">{stats.unexpected.count}</div>
                <div className="text-xs text-rose-500">{(stats.unexpected.ratio * 100).toFixed(1)}%</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
