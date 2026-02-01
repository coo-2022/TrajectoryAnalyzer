import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CategoryData {
  count: number;
  ratio: number;
}

interface RewardCategoryStats {
  total: number;
  max_reward: number;
  min_reward: number;
  avg_reward: number;
  categories: {
    perfect_score: CategoryData;
    complete_failure: CategoryData;
    partial_success: CategoryData;
  };
}

const COLORS = {
  perfect_score: '#10b981',    // emerald-500
  complete_failure: '#ef4444', // red-500
  partial_success: '#f59e0b'   // amber-500
};

const CATEGORY_CONFIG = {
  perfect_score: {
    label: 'Perfect Score',
    icon: TrendingUp,
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700'
  },
  complete_failure: {
    label: 'Complete Failure',
    icon: TrendingDown,
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-700'
  },
  partial_success: {
    label: 'Partial Success',
    icon: Minus,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700'
  }
};

export default function RewardCategoryStatsCard() {
  const [stats, setStats] = useState<RewardCategoryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analysis-stats/reward-category-stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch reward stats:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Reward Distribution</h3>
        <div className="animate-pulse h-48 bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Reward Distribution</h3>
        <p className="text-slate-500">Failed to load data</p>
      </div>
    );
  }

  const chartData = Object.entries(stats.categories)
    .filter(([_, data]) => data.count > 0)
    .map(([key, data]) => ({
      name: CATEGORY_CONFIG[key as keyof typeof CATEGORY_CONFIG].label,
      value: data.count,
      ratio: data.ratio,
      key
    }));

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Reward Distribution</h3>
        <span className="text-sm text-slate-500">Total: {stats.total}</span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Max</div>
          <div className="text-lg font-semibold text-emerald-600">{stats.max_reward}</div>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Avg</div>
          <div className="text-lg font-semibold text-blue-600">{stats.avg_reward}</div>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Min</div>
          <div className="text-lg font-semibold text-rose-600">{stats.min_reward}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.key as keyof typeof COLORS]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-3">
          {Object.entries(stats.categories).map(([key, data]) => {
            const config = CATEGORY_CONFIG[key as keyof typeof CATEGORY_CONFIG];
            const Icon = config.icon;
            return (
              <div key={key} className={`flex items-center justify-between p-3 rounded-lg border ${config.bgColor} ${config.borderColor}`}>
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${config.textColor}`} />
                  <span className={`text-sm font-medium ${config.textColor}`}>
                    {config.label}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-semibold ${config.textColor}`}>{data.count}</div>
                  <div className="text-xs text-slate-500">{(data.ratio * 100).toFixed(1)}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
