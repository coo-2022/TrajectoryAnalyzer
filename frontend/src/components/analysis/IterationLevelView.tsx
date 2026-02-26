import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { CheckSquare, Target, Award, Activity, GitCommit } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface TrainingRun {
  training_id: string;
  label: string;
}

interface IterationData {
  iteration: number;
  pass_at_1: number;
  pass_at_k: number;
  avg_reward: number;
  success_rate: number;
}

interface EpochData {
  epoch_id: number;
  iterations: IterationData[];
}

interface IterationLevelViewProps {
  trainingRuns: TrainingRun[];
}

// 颜色方案
const COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#ec4899', // pink
  '#6366f1', // indigo
];

export default function IterationLevelView({ trainingRuns }: IterationLevelViewProps) {
  const [selectedTraining, setSelectedTraining] = useState<string>('');
  const [selectedEpochs, setSelectedEpochs] = useState<number[]>([]);
  const [epochData, setEpochData] = useState<EpochData[]>([]);
  const [loading, setLoading] = useState(false);

  // 默认选中第一个 training
  useEffect(() => {
    if (trainingRuns.length > 0 && !selectedTraining) {
      setSelectedTraining(trainingRuns[0].training_id);
    }
  }, [trainingRuns, selectedTraining]);

  // 获取数据
  useEffect(() => {
    if (!selectedTraining) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${API_BASE}/training-stats/iteration-level?training_id=${selectedTraining}`
        );
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setEpochData(data.epochs);

        // 默认选中前4个epoch
        if (data.epochs.length > 0) {
          const allEpochIds = data.epochs.map((e: EpochData) => e.epoch_id);
          setSelectedEpochs(allEpochIds.slice(0, 4));
        }
      } catch (error) {
        console.error('Failed to fetch iteration stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedTraining]);

  // 构建图表数据
  const chartData = useMemo(() => {
    if (epochData.length === 0 || selectedEpochs.length === 0) return [];

    // 获取所有iteration
    const allIterations = new Set<number>();
    epochData.forEach(e => {
      if (selectedEpochs.includes(e.epoch_id)) {
        e.iterations.forEach(i => allIterations.add(i.iteration));
      }
    });
    const sortedIterations = Array.from(allIterations).sort((a, b) => a - b);

    // 构建数据点
    return sortedIterations.map(iteration => {
      const point: any = { iteration: `Iter ${iteration}` };
      epochData.forEach(e => {
        if (selectedEpochs.includes(e.epoch_id)) {
          const iterData = e.iterations.find(i => i.iteration === iteration);
          if (iterData) {
            point[`epoch_${e.epoch_id}_pass_at_1`] = (iterData.pass_at_1 * 100).toFixed(1);
            point[`epoch_${e.epoch_id}_pass_at_k`] = (iterData.pass_at_k * 100).toFixed(1);
            point[`epoch_${e.epoch_id}_avg_reward`] = iterData.avg_reward.toFixed(2);
            point[`epoch_${e.epoch_id}_success_rate`] = (iterData.success_rate * 100).toFixed(1);
          }
        }
      });
      return point;
    });
  }, [epochData, selectedEpochs]);

  const toggleEpoch = (epochId: number) => {
    setSelectedEpochs(prev =>
      prev.includes(epochId)
        ? prev.filter(id => id !== epochId)
        : [...prev, epochId]
    );
  };

  const selectAllEpochs = () => {
    setSelectedEpochs(epochData.map(e => e.epoch_id));
  };

  const clearAllEpochs = () => {
    setSelectedEpochs([]);
  };

  if (trainingRuns.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <p className="text-slate-500">No training data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        {/* Training Selector */}
        <div className="flex items-center gap-4">
          <GitCommit className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Training:</span>
          <select
            value={selectedTraining}
            onChange={(e) => setSelectedTraining(e.target.value)}
            className="flex-1 max-w-md px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {trainingRuns.map(run => (
              <option key={run.training_id} value={run.training_id}>
                {run.label}
              </option>
            ))}
          </select>
        </div>

        {/* Epoch Selector */}
        {epochData.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-sm font-medium text-slate-700">Select Epochs to Display:</span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllEpochs}
                  className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                >
                  Select All
                </button>
                <button
                  onClick={clearAllEpochs}
                  className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {epochData.map((epoch, index) => (
                <button
                  key={epoch.epoch_id}
                  onClick={() => toggleEpoch(epoch.epoch_id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedEpochs.includes(epoch.epoch_id)
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedEpochs.includes(epoch.epoch_id) ? COLORS[index % COLORS.length] : '#cbd5e1' }}
                  />
                  Epoch {epoch.epoch_id}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">Loading data...</div>
        </div>
      ) : (
        <>
          {/* Charts Row 1: Pass@1 & Pass@K */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pass@1 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-slate-800">Pass@1 by Iteration</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="iteration" />
                  <YAxis label={{ value: 'Pass@1 (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {epochData.map((e, index) => (
                    selectedEpochs.includes(e.epoch_id) && (
                      <Line
                        key={e.epoch_id}
                        type="monotone"
                        dataKey={`epoch_${e.epoch_id}_pass_at_1`}
                        name={`Epoch ${e.epoch_id}`}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    )
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pass@K */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-semibold text-slate-800">Pass@K by Iteration</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="iteration" />
                  <YAxis label={{ value: 'Pass@K (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {epochData.map((e, index) => (
                    selectedEpochs.includes(e.epoch_id) && (
                      <Line
                        key={e.epoch_id}
                        type="monotone"
                        dataKey={`epoch_${e.epoch_id}_pass_at_k`}
                        name={`Epoch ${e.epoch_id}`}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    )
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts Row 2: Average Reward & Success Rate */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Average Reward */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-semibold text-slate-800">Average Reward by Iteration</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="iteration" />
                  <YAxis label={{ value: 'Reward', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {epochData.map((e, index) => (
                    selectedEpochs.includes(e.epoch_id) && (
                      <Line
                        key={e.epoch_id}
                        type="monotone"
                        dataKey={`epoch_${e.epoch_id}_avg_reward`}
                        name={`Epoch ${e.epoch_id}`}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    )
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Success Rate */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-violet-500" />
                <h3 className="text-lg font-semibold text-slate-800">Success Rate by Iteration</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="iteration" />
                  <YAxis label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {epochData.map((e, index) => (
                    selectedEpochs.includes(e.epoch_id) && (
                      <Line
                        key={e.epoch_id}
                        type="monotone"
                        dataKey={`epoch_${e.epoch_id}_success_rate`}
                        name={`Epoch ${e.epoch_id}`}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    )
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
