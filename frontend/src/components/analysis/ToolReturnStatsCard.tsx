import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';

interface CategoryData {
  count: number;
  ratio: number;
}

interface ToolReturnStats {
  total_tool_calls: number;
  categories: {
    normal: CategoryData;
    empty: CategoryData;
    timeout: CategoryData;
    connection_error: CategoryData;
  };
  unexpected: {
    count: number;
    ratio: number;
  };
}

const COLORS = {
  normal: '#10b981',        // emerald-500
  empty: '#94a3b8',         // slate-400
  timeout: '#f59e0b',       // amber-500
  connection_error: '#ef4444' // red-500
};

const CATEGORY_LABELS = {
  normal: 'Normal',
  empty: 'Empty',
  timeout: 'Timeout',
  connection_error: 'Connection Error'
};

const CATEGORY_ICONS = {
  normal: CheckCircle,
  empty: Minus,
  timeout: Clock,
  connection_error: XCircle
};

import { Minus } from 'lucide-react';

export default function ToolReturnStatsCard() {
  const [stats, setStats] = useState<ToolReturnStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analysis-stats/tool-return-stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch tool return stats:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Tool Return Statistics</h3>
        <div className="animate-pulse h-48 bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Tool Return Statistics</h3>
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
        <h3 className="text-lg font-semibold text-slate-800">Tool Return Statistics</h3>
        <span className="text-sm text-slate-500">Total Calls: {stats.total_tool_calls}</span>
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
                {chartData.map((entry, index) => {
                  const key = Object.keys(COLORS).find(k => entry.name.toLowerCase().includes(k)) || 'normal';
                  return <Cell key={`cell-${index}`} fill={COLORS[key as keyof typeof COLORS]} />;
                })}
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
            const color = COLORS[key as keyof typeof COLORS];
            const isUnexpected = key !== 'normal';

            return (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isUnexpected ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" style={{ color }} />
                  <span
                    className={`text-sm font-medium ${
                      isUnexpected ? 'text-amber-700' : 'text-slate-700'
                    }`}
                  >
                    {CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]}
                  </span>
                </div>
                <div className="text-right">
                  <div
                    className={`text-lg font-semibold ${
                      isUnexpected ? 'text-amber-600' : 'text-slate-800'
                    }`}
                  >
                    {data.count}
                  </div>
                  <div className="text-xs text-slate-500">{(data.ratio * 100).toFixed(1)}%</div>
                </div>
              </div>
            );
          })}

          {/* Unexpected Returns Summary */}
          {stats.unexpected.count > 0 && (
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">Unexpected Returns</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-amber-600">{stats.unexpected.count}</div>
                <div className="text-xs text-amber-500">{(stats.unexpected.ratio * 100).toFixed(1)}%</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
