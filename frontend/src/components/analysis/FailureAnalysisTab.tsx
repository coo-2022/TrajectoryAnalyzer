import { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart
} from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { failureCases, failureStats } from '../../mock/trainingData';

const FAILURE_COLORS = {
  'Timeout': '#f43f5e',      // rose-500
  'Truncation': '#f59e0b',   // amber-500
  'Unexpected Tool': '#8b5cf6', // violet-500
  'Other': '#94a3b8'         // slate-400
};

const REWARD_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

interface ExpandedCase {
  [key: string]: boolean;
}

export default function FailureAnalysisTab() {
  const [expandedCase, setExpandedCase] = useState<ExpandedCase>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const toggleCase = (caseId: string) => {
    setExpandedCase(prev => ({
      ...prev,
      [caseId]: !prev[caseId]
    }));
  };

  // Prepare pie chart data
  const reasonData = Object.entries(failureStats.by_reason).map(([name, value]) => ({
    name,
    value,
    percentage: ((value / failureStats.total) * 100).toFixed(1)
  }));

  const rewardRangeData = Object.entries(failureStats.by_reward_range).map(([name, value]) => ({
    name: name.includes('+') ? `${name}+` : name,
    value,
    percentage: ((value / failureStats.total) * 100).toFixed(1)
  }));

  const toolData = Object.entries(failureStats.by_tool)
    .map(([name, value]) => ({
      name,
      value,
      percentage: ((value / failureStats.total) * 100).toFixed(1)
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Failure trend data
  const trendData = failureStats.failure_trend.map(d => ({
    epoch: `Epoch ${d.epoch}`,
    failures: d.failures,
    'Failure Rate': (d.failure_rate * 100).toFixed(1)
  }));

  // Top reason
  const topReason = Object.entries(failureStats.by_reason)
    .sort(([, a], [, b]) => b - a)[0];

  // Average reward
  const avgReward = (failureCases.reduce((sum, c) => sum + c.reward, 0) / failureCases.length).toFixed(2);

  // Paginated failure cases
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = failureCases.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(failureCases.length / itemsPerPage);

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm font-medium text-slate-600">Total Failures</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{failureStats.total}</p>
          <p className="text-sm text-slate-500 mt-1">Across 4 training runs</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm font-medium text-slate-600">Top Reason</p>
          <p className="text-3xl font-bold text-rose-600 mt-2">{topReason[0]}</p>
          <p className="text-sm text-slate-500 mt-1">{topReason[1]} cases ({((topReason[1] / failureStats.total) * 100).toFixed(1)}%)</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm font-medium text-slate-600">Avg Reward</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{avgReward}</p>
          <p className="text-sm text-slate-500 mt-1">At failure point</p>
        </div>
      </div>

      {/* Distribution Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Reason */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Failures by Reason</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={reasonData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name}: ${entry.percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {reasonData.map((_, index) => {
                  const entry = reasonData[index];
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={FAILURE_COLORS[entry.name as keyof typeof FAILURE_COLORS] || '#94a3b8'}
                    />
                  );
                })}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By Reward Range */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Failures by Reward Range</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={rewardRangeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name}: ${entry.percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {rewardRangeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={REWARD_COLORS[index % REWARD_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribution Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Tool Usage */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Top 5 Tools in Failures</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={toolData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {toolData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'][index]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Failure Trend */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Failure Trend Over Epochs</h3>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="epoch" />
              <YAxis yAxisId="left" label={{ value: 'Failures', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Rate (%)', angle: -90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="failures" fill="#f43f5e" opacity={0.5} name="Failure Count" />
              <Line yAxisId="right" type="monotone" dataKey="Failure Rate" stroke="#ef4444" strokeWidth={2} name="Failure Rate" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Failure Cases List */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Failure Cases</h3>

        <div className="space-y-3">
          {currentItems.map((failure) => (
            <div key={failure.case_id} className="border border-slate-200 rounded-lg">
              {/* Summary Row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                onClick={() => toggleCase(failure.case_id)}
              >
                <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Case ID</p>
                    <p className="text-sm font-medium text-slate-700">{failure.case_id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Reason</p>
                    <p className="text-sm font-medium text-slate-700 capitalize">{failure.reason.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Reward</p>
                    <p className="text-sm font-medium text-slate-700">{failure.reward.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Epoch</p>
                    <p className="text-sm font-medium text-slate-700">{failure.epoch}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Timestamp</p>
                    <p className="text-sm font-medium text-slate-700">{formatDate(failure.timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tools Used</p>
                    <p className="text-sm font-medium text-slate-700">{failure.tools.length}</p>
                  </div>
                </div>
                {expandedCase[failure.case_id] ? (
                  <ChevronUp className="w-5 h-5 text-slate-400 ml-4" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 ml-4" />
                )}
              </div>

              {/* Expanded Details */}
              {expandedCase[failure.case_id] && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Tools Used</h4>
                      <div className="flex flex-wrap gap-2">
                        {failure.tools.map((tool, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-md"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Details</h4>
                      <div className="space-y-1 text-sm text-slate-600">
                        <p><span className="font-medium">Training:</span> {failure.training_id}</p>
                        <p><span className="font-medium">Case ID:</span> {failure.case_id}</p>
                        <p><span className="font-medium">Reason:</span> {failure.reason.replace('_', ' ')}</p>
                        <p><span className="font-medium">Reward at failure:</span> {failure.reward.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Simulated reward breakdown */}
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Reward Breakdown</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-slate-500">Step Penalty</p>
                        <p className="font-medium text-slate-700">-{(0.1 * failure.epoch).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Tool Efficiency</p>
                        <p className="font-medium text-slate-700">{(failure.reward * 0.3).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Progress Score</p>
                        <p className="font-medium text-slate-700">{(failure.reward * 0.4).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Base Reward</p>
                        <p className="font-medium text-slate-700">{(failure.reward * 0.3).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
          <p className="text-sm text-slate-600">
            Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, failureCases.length)} of {failureCases.length} cases
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
