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
import { CheckSquare, Target, Award, Activity, Filter } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface TrainingRun {
  training_id: string;
  label: string;
}

interface EpochData {
  epoch: number;
  pass_at_1: number;
  pass_at_k: number;
  avg_reward: number;
  success_rate: number;
}

interface TrainingData {
  training_id: string;
  epochs: EpochData[];
}

interface EpochLevelViewProps {
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
];

export default function EpochLevelView({ trainingRuns }: EpochLevelViewProps) {
  const [selectedTrainings, setSelectedTrainings] = useState<string[]>([]);
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [loading, setLoading] = useState(false);

  // 默认选中前3个training
  useEffect(() => {
    if (trainingRuns.length > 0 && selectedTrainings.length === 0) {
      setSelectedTrainings(trainingRuns.slice(0, 3).map(t => t.training_id));
    }
  }, [trainingRuns]);

  // 获取数据
  useEffect(() => {
    if (selectedTrainings.length === 0) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const idsParam = selectedTrainings.join(',');
        const response = await fetch(`${API_BASE}/training-stats/epoch-level?training_ids=${idsParam}`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        setTrainingData(data.trainings);
      } catch (error) {
        console.error('Failed to fetch epoch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedTrainings]);

  // 构建图表数据
  const chartData = useMemo(() => {
    if (trainingData.length === 0) return [];

    // 获取所有epoch
    const allEpochs = new Set<number>();
    trainingData.forEach(t => {
      t.epochs.forEach(e => allEpochs.add(e.epoch));
    });
    const sortedEpochs = Array.from(allEpochs).sort((a, b) => a - b);

    // 构建数据点
    return sortedEpochs.map(epoch => {
      const point: any = { epoch: `Epoch ${epoch}` };
      trainingData.forEach(t => {
        const epochData = t.epochs.find(e => e.epoch === epoch);
        if (epochData) {
          point[`${t.training_id}_pass_at_1`] = (epochData.pass_at_1 * 100).toFixed(1);
          point[`${t.training_id}_pass_at_k`] = (epochData.pass_at_k * 100).toFixed(1);
          point[`${t.training_id}_avg_reward`] = epochData.avg_reward.toFixed(2);
          point[`${t.training_id}_success_rate`] = (epochData.success_rate * 100).toFixed(1);
        }
      });
      return point;
    });
  }, [trainingData]);

  const toggleTraining = (trainingId: string) => {
    setSelectedTrainings(prev =>
      prev.includes(trainingId)
        ? prev.filter(id => id !== trainingId)
        : [...prev, trainingId]
    );
  };

  const selectAll = () => {
    setSelectedTrainings(trainingRuns.map(t => t.training_id));
  };

  const clearAll = () => {
    setSelectedTrainings([]);
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
      {/* Training Selector */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-4 mb-3">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Select Trainings to Compare:</span>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="text-xs px-2 py-1 text-slate-600 hover:bg-slate-100 rounded"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {trainingRuns.map((run, index) => (
            <button
              key={run.training_id}
              onClick={() => toggleTraining(run.training_id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                selectedTrainings.includes(run.training_id)
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedTrainings.includes(run.training_id) ? COLORS[index % COLORS.length] : '#cbd5e1' }}
              />
              {run.label}
            </button>
          ))}
        </div>
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
                <h3 className="text-lg font-semibold text-slate-800">Pass@1 by Epoch</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis label={{ value: 'Pass@1 (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {trainingData.map((t, index) => (
                    <Line
                      key={t.training_id}
                      type="monotone"
                      dataKey={`${t.training_id}_pass_at_1`}
                      name={t.training_id}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pass@K */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-semibold text-slate-800">Pass@K by Epoch</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis label={{ value: 'Pass@K (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {trainingData.map((t, index) => (
                    <Line
                      key={t.training_id}
                      type="monotone"
                      dataKey={`${t.training_id}_pass_at_k`}
                      name={t.training_id}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
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
                <h3 className="text-lg font-semibold text-slate-800">Average Reward by Epoch</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis label={{ value: 'Reward', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {trainingData.map((t, index) => (
                    <Line
                      key={t.training_id}
                      type="monotone"
                      dataKey={`${t.training_id}_avg_reward`}
                      name={t.training_id}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Success Rate */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-violet-500" />
                <h3 className="text-lg font-semibold text-slate-800">Success Rate by Epoch</h3>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {trainingData.map((t, index) => (
                    <Line
                      key={t.training_id}
                      type="monotone"
                      dataKey={`${t.training_id}_success_rate`}
                      name={t.training_id}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls
                    />
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
