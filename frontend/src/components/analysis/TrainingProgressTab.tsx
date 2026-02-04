import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from 'recharts';
import MetricCard from './MetricCard';
import {
  trainingRuns,
  trainingOptions,
  eraOptions,
  trainingMetadata
} from '../../mock/trainingData';

export default function TrainingProgressTab() {
  const [selectedTraining, setSelectedTraining] = useState(trainingRuns[0].training_id);
  const [selectedEra, setSelectedEra] = useState('1');

  const currentTraining = trainingRuns.find(t => t.training_id === selectedTraining);
  const currentMetadata = trainingMetadata.find(m => m.training_id === selectedTraining);

  if (!currentTraining || !currentMetadata) return null;

  const chartData = currentTraining.epochs.map(epoch => ({
    epoch: `Epoch ${epoch.epoch}`,
    passAt1: (epoch.pass_at_1 * 100).toFixed(1),
    passAtK: (epoch.pass_at_k * 100).toFixed(1),
    reward: epoch.avg_reward.toFixed(2),
    successRate: (epoch.success_rate * 100).toFixed(1)
  }));

  const lastEpoch = currentTraining.epochs[currentTraining.epochs.length - 1];

  const successBreakdown = currentTraining.epochs.map(epoch => {
    const success = epoch.success_rate * 100;
    const failure = 100 - success;
    return {
      epoch: epoch.epoch,
      Success: success.toFixed(1),
      Failure: failure.toFixed(1)
    };
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Training Run
          </label>
          <select
            value={selectedTraining}
            onChange={(e) => setSelectedTraining(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {trainingOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Era
          </label>
          <select
            value={selectedEra}
            onChange={(e) => setSelectedEra(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {eraOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Pass@1"
          value={`${(lastEpoch.pass_at_1 * 100).toFixed(1)}%`}
          delta={currentMetadata.delta_pass_at_1}
          color="blue"
        />
        <MetricCard
          title="Pass@K"
          value={`${(lastEpoch.pass_at_k * 100).toFixed(1)}%`}
          delta={currentMetadata.delta_pass_at_k}
          color="emerald"
        />
        <MetricCard
          title="Avg Reward"
          value={lastEpoch.avg_reward.toFixed(2)}
          delta={currentMetadata.delta_avg_reward}
          color="amber"
        />
        <MetricCard
          title="Success Rate"
          value={`${(lastEpoch.success_rate * 100).toFixed(1)}%`}
          delta={currentMetadata.delta_success_rate}
          color="rose"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pass@1 Over Epochs */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Pass@1 Over Epochs</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="epoch" />
              <YAxis label={{ value: 'Pass@1 (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="passAt1"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pass@K Over Epochs */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Pass@K Over Epochs</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="epoch" />
              <YAxis label={{ value: 'Pass@K (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="passAtK"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reward Trend */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Average Reward Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rewardGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="epoch" />
              <YAxis label={{ value: 'Reward', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="reward"
                stroke="#f59e0b"
                fillOpacity={1}
                fill="url(#rewardGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Success Rate */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Success Rate</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="epoch" />
              <YAxis label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" label="Target 80%" />
              <Line
                type="monotone"
                dataKey="successRate"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Success Rate Breakdown */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Success Rate Breakdown</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={successBreakdown}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="epoch" label={{ value: 'Epoch', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Success" stackId="a" fill="#10b981" />
            <Bar dataKey="Failure" stackId="a" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
