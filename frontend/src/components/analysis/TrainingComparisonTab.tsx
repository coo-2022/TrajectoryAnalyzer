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
  ResponsiveContainer
} from 'recharts';
import { trainingRuns, trainingMetadata } from '../../mock/trainingData';

const TRAINING_COLORS = [
  '#94a3b8', // slate-400 (train_1)
  '#8b5cf6', // violet-500 (train_2)
  '#3b82f6', // blue-500 (train_3)
  '#06b6d4', // cyan-500 (train_4)
  '#10b981'  // emerald-500 (train_5)
];

export default function TrainingComparisonTab() {
  const [selectedTrainings, setSelectedTrainings] = useState<string[]>(['train_1', 'train_2']);

  const toggleTraining = (trainingId: string) => {
    if (selectedTrainings.includes(trainingId)) {
      setSelectedTrainings(prev => prev.filter(id => id !== trainingId));
    } else if (selectedTrainings.length < 5) {
      setSelectedTrainings(prev => [...prev, trainingId]);
    }
  };

  const selectedRuns = trainingRuns.filter(t => selectedTrainings.includes(t.training_id));
  const selectedMetadata = trainingMetadata.filter(m => selectedTrainings.includes(m.training_id));

  // Prepare comparison chart data
  const comparisonData = selectedRuns.length > 0
    ? Array.from({ length: 10 }, (_, i) => {
        const epochNum = i + 1;
        const dataPoint: any = { epoch: `Epoch ${epochNum}` };

        selectedRuns.forEach(run => {
          const epoch = run.epochs[i];
          dataPoint[run.training_id] = {
            passAt1: epoch.pass_at_1 * 100,
            passAtK: epoch.pass_at_k * 100,
            reward: epoch.avg_reward,
            successRate: epoch.success_rate * 100
          };
        });

        return dataPoint;
      })
    : [];

  // Prepare line data for each metric
  const getPassAt1Data = () => comparisonData.map(d => {
    const obj: any = { epoch: d.epoch };
    selectedRuns.forEach(run => {
      obj[run.training_id] = d[run.training_id].passAt1.toFixed(1);
    });
    return obj;
  });

  const getPassAtKData = () => comparisonData.map(d => {
    const obj: any = { epoch: d.epoch };
    selectedRuns.forEach(run => {
      obj[run.training_id] = d[run.training_id].passAtK.toFixed(1);
    });
    return obj;
  });

  const getRewardData = () => comparisonData.map(d => {
    const obj: any = { epoch: d.epoch };
    selectedRuns.forEach(run => {
      obj[run.training_id] = d[run.training_id].reward.toFixed(2);
    });
    return obj;
  });

  const getSuccessRateData = () => comparisonData.map(d => {
    const obj: any = { epoch: d.epoch };
    selectedRuns.forEach(run => {
      obj[run.training_id] = d[run.training_id].successRate.toFixed(1);
    });
    return obj;
  });

  // Category distribution (by era)
  const categoryData = [1, 2].map(era => {
    const eraTrainings = selectedRuns.filter(t => {
      const meta = trainingMetadata.find(m => m.training_id === t.training_id);
      return meta?.era === era;
    });

    const avgPassAt1 = eraTrainings.reduce((sum, t) => {
      const meta = trainingMetadata.find(m => m.training_id === t.training_id);
      return sum + (meta?.final_pass_at_k || 0);
    }, 0) / Math.max(1, eraTrainings.length);

    return {
      era: `Era ${era}`,
      'Avg Pass@K': (avgPassAt1 * 100).toFixed(1),
      trainings: eraTrainings.length
    };
  });

  const getColor = (index: number) => TRAINING_COLORS[index % TRAINING_COLORS.length];

  return (
    <div className="space-y-6">
      {/* Training Selection */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Select Training Runs (max 5)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {trainingRuns.map((run, index) => (
            <label
              key={run.training_id}
              className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                selectedTrainings.includes(run.training_id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedTrainings.includes(run.training_id)}
                onChange={() => toggleTraining(run.training_id)}
                disabled={
                  !selectedTrainings.includes(run.training_id) && selectedTrainings.length >= 5
                }
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getColor(index) }}
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {run.training_id}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  Era {run.era}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Comparison Summary Table */}
      {selectedMetadata.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Comparison Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Training</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Era</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Pass@1</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Delta</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Pass@K</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Delta</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Reward</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Delta</th>
                </tr>
              </thead>
              <tbody>
                {selectedMetadata.map((meta, index) => (
                  <tr key={meta.training_id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getColor(index) }}
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {meta.training_id}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-slate-600">{meta.era}</td>
                    <td className="text-right py-3 px-4 text-sm text-slate-600">
                      {(meta.final_pass_at_1 * 100).toFixed(1)}%
                    </td>
                    <td className={`text-right py-3 px-4 text-sm font-medium ${
                      parseFloat(meta.delta_pass_at_1) > 0 ? 'text-emerald-600' :
                      parseFloat(meta.delta_pass_at_1) < 0 ? 'text-rose-600' :
                      'text-slate-500'
                    }`}>
                      {parseFloat(meta.delta_pass_at_1) > 0 ? '+' : ''}{meta.delta_pass_at_1}%
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-slate-600">
                      {(meta.final_pass_at_k * 100).toFixed(1)}%
                    </td>
                    <td className={`text-right py-3 px-4 text-sm font-medium ${
                      parseFloat(meta.delta_pass_at_k) > 0 ? 'text-emerald-600' :
                      parseFloat(meta.delta_pass_at_k) < 0 ? 'text-rose-600' :
                      'text-slate-500'
                    }`}>
                      {parseFloat(meta.delta_pass_at_k) > 0 ? '+' : ''}{meta.delta_pass_at_k}%
                    </td>
                    <td className="text-right py-3 px-4 text-sm text-slate-600">
                      {meta.final_avg_reward.toFixed(2)}
                    </td>
                    <td className={`text-right py-3 px-4 text-sm font-medium ${
                      parseFloat(meta.delta_avg_reward) > 0 ? 'text-emerald-600' :
                      parseFloat(meta.delta_avg_reward) < 0 ? 'text-rose-600' :
                      'text-slate-500'
                    }`}>
                      {parseFloat(meta.delta_avg_reward) > 0 ? '+' : ''}{meta.delta_avg_reward}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparison Charts */}
      {selectedTrainings.length > 0 && (
        <>
          {/* Pass@1 Comparison */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Pass@1 Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getPassAt1Data()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="epoch" />
                <YAxis label={{ value: 'Pass@1 (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {selectedRuns.map((run, index) => (
                  <Line
                    key={run.training_id}
                    type="monotone"
                    dataKey={run.training_id}
                    stroke={getColor(index)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={run.training_id}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pass@K Comparison */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Pass@K Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getPassAtKData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="epoch" />
                <YAxis label={{ value: 'Pass@K (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {selectedRuns.map((run, index) => (
                  <Line
                    key={run.training_id}
                    type="monotone"
                    dataKey={run.training_id}
                    stroke={getColor(index)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={run.training_id}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Reward Comparison */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Average Reward Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getRewardData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="epoch" />
                <YAxis label={{ value: 'Reward', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {selectedRuns.map((run, index) => (
                  <Line
                    key={run.training_id}
                    type="monotone"
                    dataKey={run.training_id}
                    stroke={getColor(index)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={run.training_id}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Success Rate Comparison */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Success Rate Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getSuccessRateData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="epoch" />
                <YAxis label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {selectedRuns.map((run, index) => (
                  <Line
                    key={run.training_id}
                    type="monotone"
                    dataKey={run.training_id}
                    stroke={getColor(index)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name={run.training_id}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Category Distribution */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Average Performance by Era</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="era" />
                <YAxis label={{ value: 'Avg Pass@K (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Avg Pass@K" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
