import { useEffect, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Target, Zap } from 'lucide-react';

interface ProcessRewardCorrelation {
  kendall_tau: number;
  p_value: number;
  sample_size: number;
  interpretation: string;
  suggested_strategy: string;
  scatter_data: {
    x: number[];
    y: number[];
    trajectory_ids: string[];
  };
}

const INTERPRETATION_LABELS: Record<string, string> = {
  strong_positive_correlation: 'Strong Positive Correlation',
  moderate_positive_correlation: 'Moderate Positive Correlation',
  weak_positive_correlation: 'Weak Positive Correlation',
  strong_negative_correlation: 'Strong Negative Correlation',
  moderate_negative_correlation: 'Moderate Negative Correlation',
  weak_negative_correlation: 'Weak Negative Correlation',
  no_correlation: 'No Correlation',
  insufficient_data: 'Insufficient Data'
};

const STRATEGY_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  beam_search: { label: 'Beam Search', color: 'text-emerald-600', icon: Target },
  '2.0': { label: 'Exploratory Search (2.0)', color: 'text-blue-600', icon: Zap },
  insufficient_data: { label: 'Need More Data', color: 'text-slate-500', icon: null },
  need_more_samples: { label: 'Need More Samples', color: 'text-slate-500', icon: null }
};

export default function ProcessRewardCorrelationCard() {
  const [data, setData] = useState<ProcessRewardCorrelation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analysis-stats/process-reward-correlation')
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch correlation data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Process vs Final Reward Correlation</h3>
        <div className="animate-pulse h-64 bg-slate-100 rounded"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Process vs Final Reward Correlation</h3>
        <p className="text-slate-500">Failed to load data</p>
      </div>
    );
  }

  // Prepare scatter plot data
  const scatterData = data.scatter_data.x.map((x, i) => ({
    x: x,
    y: data.scatter_data.y[i],
    trajectory_id: data.scatter_data.trajectory_ids[i]
  }));

  const interpretationLabel = INTERPRETATION_LABELS[data.interpretation] || data.interpretation;
  const strategyConfig = STRATEGY_LABELS[data.suggested_strategy] || {
    label: data.suggested_strategy,
    color: 'text-slate-600',
    icon: null
  };
  const StrategyIcon = strategyConfig.icon;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Process vs Final Reward Correlation</h3>
        <span className="text-sm text-slate-500">N = {data.sample_size}</span>
      </div>

      {/* Correlation Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-4 bg-slate-50 rounded-lg">
          <div className="text-xs text-slate-500 mb-1">Kendall's Tau (τ)</div>
          <div className={`text-2xl font-bold ${
            data.kendall_tau >= 0.3 ? 'text-emerald-600' :
            data.kendall_tau <= -0.3 ? 'text-rose-600' :
            'text-slate-600'
          }`}>
            {data.kendall_tau.toFixed(3)}
          </div>
          <div className="text-xs text-slate-500 mt-1">{interpretationLabel}</div>
        </div>

        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
          {StrategyIcon ? (
            <div className="flex items-center justify-center gap-2 mb-1">
              <StrategyIcon className="w-4 h-4" />
              <div className="text-xs text-blue-600">Suggested Strategy</div>
            </div>
          ) : (
            <div className="text-xs text-blue-600 mb-1">Suggested Strategy</div>
          )}
          <div className={`text-lg font-bold ${strategyConfig.color}`}>
            {strategyConfig.label}
          </div>
          <div className="text-xs text-slate-500 mt-1">p-value: {data.p_value.toFixed(4)}</div>
        </div>
      </div>

      {/* Scatter Plot */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="x"
              type="number"
              name="Avg Process Reward"
              label={{ value: 'Average Process Reward', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              dataKey="y"
              type="number"
              name="Final Reward"
              label={{ value: 'Final Reward', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                      <p className="text-xs text-slate-500">Trajectory: {data.trajectory_id}</p>
                      <p className="text-sm font-semibold">Avg Process: {data.x.toFixed(3)}</p>
                      <p className="text-sm font-semibold">Final: {data.y.toFixed(3)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter name="Trajectories" data={scatterData} fill="#3b82f6" opacity={0.6} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Interpretation Note */}
      {data.kendall_tau >= 0.7 && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm text-emerald-700">
            <strong>High positive correlation detected!</strong> Process rewards are strong predictors of final outcomes.
            Consider using beam search strategy to optimize based on intermediate rewards.
          </p>
        </div>
      )}
      {data.kendall_tau < 0.3 && data.kendall_tau > -0.3 && data.sample_size >= 10 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Low correlation detected.</strong> Process rewards don't strongly predict final outcomes.
            Exploratory search strategies may be more effective.
          </p>
        </div>
      )}
    </div>
  );
}
